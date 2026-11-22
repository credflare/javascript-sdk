import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { CredflareSession, CredflareError } from '../dist/index.js';
let server, base;
const calls = [];
before(async () => {
  server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    calls.push({ url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() });
    const body = Buffer.concat(chunks).toString();
    const subtype = body.match(/name="type"\r\n\r\n([a-z_]+)/)?.[1];
    const submitted = req.url.endsWith('/submit') ? JSON.parse(body).type : undefined;
    const rejection = req.headers.authorization?.match(/^Bearer reject:([a-z_.]+)$/)?.[1];
    if (rejection && req.method === 'POST') {
      res.writeHead(422, { 'Content-Type': 'application/json' });
      return res.end(await readFile(new URL(`./fixtures/rejections/${rejection}.json`, import.meta.url)));
    }
    const fixture = req.headers.authorization === 'Bearer wrong' ? 'unauthorized'
      : /\/(email|phone)-codes\/confirm$/.test(req.url) ? 'email-code-confirm'
      : req.url.endsWith('/email-codes') ? 'email-code-request'
      : req.url.endsWith('/phone-codes') ? 'phone-code-request'
      : req.headers.authorization === 'Bearer hidden-answer' && submitted === 'form_submission' ? 'questionnaire-hidden-answer'
      : req.headers.authorization === 'Bearer reject-location' && submitted === 'location_verification' ? 'location-rejection'
      : req.url.endsWith('/liveness-challenges') ? 'liveness-challenge'
      : submitted === 'facial_verification' ? 'facial-submission'
      : submitted === 'location_verification' ? 'location-submission'
      : req.url.endsWith('/submit') ? 'submission'
      : req.url.endsWith('/uploads/biometrics') ? ({gesture: 'gesture-upload', liveness_video: 'video-upload', selfie: 'selfie-upload'}[subtype] ?? 'facial-upload')
      : req.url.endsWith('/uploads/documents') ? 'upload' : 'session';
    res.writeHead(fixture === 'unauthorized' ? 401 : ['location-rejection', 'questionnaire-hidden-answer'].includes(fixture) ? 422 : fixture.endsWith('-code-request') ? 202 : fixture === 'session' ? 200 : 201, { 'Content-Type': 'application/json' });
    res.end(await readFile(new URL(`./fixtures/${fixture}.json`, import.meta.url)));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
});
after(() => new Promise(resolve => server.close(resolve)));
function session(token = 'test-session-token') {
  return new CredflareSession({session_id:'00000000-0000-4000-8000-000000000001',token,api_base_url:base,expires_at:'2030-01-01T00:00:00Z'});
}
test('reads the real session envelope over HTTP', async () => {
  const info = await session().get();
  assert.equal(info.profile.document_requirements[0].document_type.two_sided, true);
  assert.equal(calls.at(-1).headers.authorization, 'Bearer test-session-token');
  assert.equal(calls.at(-1).headers['x-client-secret'], undefined);
});
test('sends multipart uploads and preserves the supplied retry key', async () => {
  const form = new FormData();
  form.append('file', new Blob(['synthetic document'], { type:'image/png' }), 'front.png');
  form.append('side', 'front');
  const key = crypto.randomUUID();
  const uploaded = await session().upload('documents', form, key);
  assert.equal(uploaded.mime_type, 'image/png');
  assert.equal(calls.at(-1).headers['x-idempotency-key'], key);
  assert.match(calls.at(-1).headers['content-type'], /^multipart\/form-data; boundary=/);
  assert.match(calls.at(-1).body, /name="side"/);
});
test('submits file IDs through the session API', async () => {
  const key = crypto.randomUUID();
  const result = await session().submit({ type:'document_verification', document_type_id:1, file_id:1 }, key);
  assert.equal(result.id, 1);
  assert.equal(calls.at(-1).headers['x-idempotency-key'], key);
  assert.equal(JSON.parse(calls.at(-1).body).file_id, 1);
});
test('preserves API authentication errors', async () => {
  await assert.rejects(session('wrong').get(), error => error instanceof CredflareError && error.status === 401 && error.type === 'session_unavailable' && error.message === 'Invalid verification session.');
});
test('rejects insecure remote URLs before transmitting a token', () => {
  assert.throws(() => new CredflareSession({session_id:'00000000-0000-4000-8000-000000000001',token:'test-session-token',api_base_url:'http://example.test',expires_at:'2030-01-01T00:00:00Z'}), /HTTPS/);
});

test('host-controlled session renewal keeps the client usable', async () => {
  const client = session('wrong');
  client.replaceSession({session_id:'00000000-0000-4000-8000-000000000001',token:'test-session-token',api_base_url:base,expires_at:'2030-01-01T00:00:00Z'});
  assert.equal((await client.get()).capabilities.liveness, 'challenge');
});

test('refuses a mutation without a valid retry key', () => {
  assert.throws(() => session().submit({type:'form_submission',fields:{full_name:'Example'}}, ''), /UUID request key/);
});

const challengeFixture = JSON.parse(await readFile(new URL('./fixtures/liveness-challenge.json', import.meta.url))).data;
const part = (body, name) => body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`))?.[1];

test('requests a server chosen liveness challenge', async () => {
  const key = crypto.randomUUID();
  const challenge = await session().createLivenessChallenge(key);
  assert.equal(calls.at(-1).url, '/api/v1/sdk/sessions/00000000-0000-4000-8000-000000000001/liveness-challenges');
  assert.equal(calls.at(-1).headers.authorization, 'Bearer test-session-token');
  assert.deepEqual(challenge.gestures, challengeFixture.gestures);
  assert.equal(challenge.record_video, true);
  assert.equal(challenge.max_video_seconds, 8);
});

for (const [type, gesture, blob, filename, fixture] of [
  ['gesture', 'smile', new Blob(['jpeg'], {type: 'image/jpeg'}), 'smile.jpg', 'gesture-upload'],
  ['liveness_video', undefined, new Blob(['webm'], {type: 'video/webm'}), 'liveness.webm', 'video-upload'],
  ['selfie', undefined, new Blob(['jpeg'], {type: 'image/jpeg'}), 'selfie.jpg', 'selfie-upload'],
]) {
  test(`uploads a ${type} with the challenge fields`, async () => {
    const key = crypto.randomUUID();
    const uploaded = await session().uploadBiometric({type, challengeId: challengeFixture.challenge_id, gesture, file: blob}, key);
    const {body, headers, url} = calls.at(-1);
    assert.equal(url.endsWith('/uploads/biometrics'), true);
    assert.equal(headers['x-idempotency-key'], key);
    assert.equal(part(body, 'type'), type);
    assert.equal(part(body, 'challenge_id'), challengeFixture.challenge_id);
    assert.equal(part(body, 'capture_source'), 'camera');
    assert.equal(part(body, 'gesture'), gesture);
    assert.match(body, new RegExp(`name="file"; filename="${filename}"`));
    const expected = JSON.parse(await readFile(new URL(`./fixtures/${fixture}.json`, import.meta.url))).data;
    assert.deepEqual(uploaded, expected);
  });
}

test('refuses a gesture upload without a gesture name', () => {
  assert.throws(() => session().uploadBiometric({type: 'gesture', challengeId: challengeFixture.challenge_id, file: new Blob(['x'])}, crypto.randomUUID()), /gesture name/);
});

test('submits facial evidence with the challenge, frames, video and metadata', async () => {
  const {sendLivenessEvidence} = await import('../dist/liveness.js');
  const evidence = {
    challenge: challengeFixture, provider: 'mediapipe', capturedAt: Date.parse('2026-11-20T23:04:00Z'),
    gestures: challengeFixture.gestures.map((gesture, index) => ({gesture, completedAt: Date.parse('2026-11-20T23:03:50Z') + index * 1000, key: crypto.randomUUID(), file: new Blob(['jpeg'], {type: 'image/jpeg'})})),
    video: {key: crypto.randomUUID(), file: new Blob(['webm'], {type: 'video/webm'})},
    selfie: {key: crypto.randomUUID(), file: new Blob(['jpeg'], {type: 'image/jpeg'})},
    submitKey: crypto.randomUUID(),
  };
  const before = calls.length;
  const result = await sendLivenessEvidence(session(), evidence);
  assert.equal(result.id, 1);
  assert.deepEqual(calls.slice(before, -1).map(call => part(call.body, 'type')), ['gesture', 'gesture', 'gesture', 'liveness_video', 'selfie']);
  assert.deepEqual(calls.slice(before, -1).map(call => call.headers['x-idempotency-key']), [...evidence.gestures.map(item => item.key), evidence.video.key, evidence.selfie.key]);
  assert.deepEqual(calls.slice(before, before + 3).map(call => part(call.body, 'gesture')), challengeFixture.gestures);
  const submitted = JSON.parse(calls.at(-1).body);
  assert.equal(calls.at(-1).headers['x-idempotency-key'], evidence.submitKey);
  assert.deepEqual({...submitted, metadata: undefined}, {type: 'facial_verification', challenge_id: challengeFixture.challenge_id, image_file_id: 4, gesture_file_ids: [3, 3, 3], video_file_id: 5, metadata: undefined});
  assert.deepEqual(submitted.metadata.liveness_results.map(item => item.challenge), challengeFixture.gestures);
  assert.equal(submitted.metadata.provider, 'mediapipe');
  assert.equal(submitted.metadata.captured_at, '2026-11-20T23:04:00.000Z');
  const retried = calls.length;
  await sendLivenessEvidence(session(), evidence);
  assert.equal(calls.length, retried + 1, 'a retry reuses uploaded files');
  assert.equal(calls.at(-1).headers['x-idempotency-key'], evidence.submitKey);
});

test('a retry after a dropped upload resends it with the same key and skips finished ones', async () => {
  const {sendLivenessEvidence} = await import('../dist/liveness.js');
  const evidence = {
    challenge: challengeFixture, provider: 'mediapipe', capturedAt: Date.now(),
    gestures: challengeFixture.gestures.map(gesture => ({gesture, completedAt: Date.now(), key: crypto.randomUUID(), file: new Blob(['jpeg'], {type: 'image/jpeg'})})),
    video: {key: crypto.randomUUID(), file: new Blob(['webm'], {type: 'video/webm'})},
    selfie: {key: crypto.randomUUID(), file: new Blob(['jpeg'], {type: 'image/jpeg'})},
    submitKey: crypto.randomUUID(),
  };
  let sent = 0;
  const flaky = new CredflareSession({session_id: '00000000-0000-4000-8000-000000000001', token: 'test-session-token', api_base_url: base, expires_at: '2030-01-01T00:00:00Z'}, (url, init) => {
    if (++sent === 2) return Promise.reject(new TypeError('fetch failed'));
    return fetch(url, init);
  });
  const dropped = await sendLivenessEvidence(flaky, evidence).catch(error => error);
  assert.ok(dropped instanceof CredflareError);
  assert.equal(dropped.status, 0);
  assert.equal(evidence.gestures[0].fileId, 3);
  assert.equal(evidence.gestures[1].fileId, undefined);
  const before = calls.length;
  await sendLivenessEvidence(flaky, evidence);
  assert.deepEqual(calls.slice(before).map(call => call.headers['x-idempotency-key']), [evidence.gestures[1].key, evidence.gestures[2].key, evidence.video.key, evidence.selfie.key, evidence.submitKey]);
});

test('submits a location fix with its metadata', async () => {
  const {locationSubmission} = await import('../dist/index.js');
  const payload = locationSubmission({latitude: 4.0511, longitude: 9.7679, accuracy: 12.5, altitude: null, fixTime: Date.parse('2026-11-20T23:00:00Z'), isMock: null, provider: 'browser'}, new Date('2026-11-20T23:00:01Z'));
  const {type, ...rest} = payload;
  const key = crypto.randomUUID();
  const result = await session().submitLocation(rest, key);
  assert.equal(result.id, 2);
  assert.equal(calls.at(-1).headers['x-idempotency-key'], key);
  assert.deepEqual(JSON.parse(calls.at(-1).body), {type: 'location_verification', latitude: 4.0511, longitude: 9.7679, metadata: {accuracy: 12.5, altitude: null, fix_time: '2026-11-20T23:00:00.000Z', is_mock: null, provider: 'browser', captured_at: '2026-11-20T23:00:01.000Z'}});
  assert.equal(type, 'location_verification');
});

test('surfaces a location rejection as a validation error with the server reason', async () => {
  const {locationSubmission} = await import('../dist/index.js');
  const {type, ...rest} = locationSubmission({latitude: 4, longitude: 9, accuracy: 900, altitude: null, fixTime: Date.now(), isMock: false, provider: 'gps'});
  await assert.rejects(session('reject-location').submitLocation(rest, crypto.randomUUID()), error => error instanceof CredflareError && error.status === 422 && error.type === 'validation' && error.message === 'The location is not accurate enough. Move to an open area and try again.' && error.code === 'location.accuracy');
  assert.equal(type, 'location_verification');
});


test('every real backend rejection maps through the response path to its code and spec rejection screen', async () => {
  const {errorCodes, locationRejection, locationSubmission, rejections, rejectionScreen, text} = await import('../dist/index.js');
  const {readdir} = await import('node:fs/promises');
  const names = (await readdir(new URL('./fixtures/rejections/', import.meta.url))).map(name => name.replace(/\.json$/, '')).sort();
  assert.deepEqual(names, Object.keys(errorCodes).sort());
  assert.deepEqual(Object.keys(rejections.codes).sort(), names);
  const settings = {max_accuracy_m: 50, max_age_s: 60, mock_location: 'reject', ip_country: 'flag', reference: {rule: 'within', match: 'any', places: [{label: 'Head office'}]}};
  const expected = {
    'location.accuracy': text('location.place.not_precise'),
    'location.stale': text('location.stale'),
    'location.mock': text('location.mock_detected'),
    'location.ip_country': text('location.ip_country_mismatch'),
    'location.reference_not_matched': 'You do not seem to be at Head office yet. Move closer, then try again.',
  };
  const requester = {name: 'Acme Bank', logo_url: null};
  const {type, ...fix} = locationSubmission({latitude: 4, longitude: 9, accuracy: 10, altitude: null, fixTime: Date.now(), isMock: false, provider: 'gps'});
  for (const code of names) {
    const body = JSON.parse(await readFile(new URL(`./fixtures/rejections/${code}.json`, import.meta.url)));
    const key = crypto.randomUUID();
    const client = session(`reject:${code}`);
    const channel = code.split('.')[0];
    const request = code.startsWith('location.') ? client.submitLocation(fix, key)
      : code.startsWith('liveness.') ? client.submitFacial({challenge_id: challengeFixture.challenge_id, image_file_id: 4, gesture_file_ids: [3, 3, 3], video_file_id: 5, metadata: {}}, key)
      : /code_(invalid|expired|missing)|too_many_attempts/.test(code) ? client.confirmCode(channel, '123456')
      : client.requestCode(channel, channel === 'email' ? 'jane@example.test' : '+237650000001');
    const error = await request.catch(cause => cause);
    if (code.startsWith('location.') || code.startsWith('liveness.')) assert.equal(calls.at(-1).headers['x-idempotency-key'], key);
    assert.ok(error instanceof CredflareError, code);
    assert.equal(error.code, code);
    assert.equal(error.message, body.message);
    const spec = rejections.codes[code];
    const screen = rejectionScreen(error, {requester, location: code.startsWith('location.') ? settings : null});
    assert.equal(screen.code, code);
    assert.equal(screen.title, text(spec.title));
    assert.equal(screen.action, spec.action);
    assert.equal(screen.actionLabel, text(rejections.actions[spec.action].label));
    assert.equal(screen.requestedBy, 'Requested by Acme Bank.');
    assert.equal(screen.help, 'If you need help, contact Acme Bank.');
    if (code.startsWith('location.')) {
      assert.equal(screen.message, expected[code], code);
      assert.equal(locationRejection(error.code, settings), expected[code], code);
    } else assert.equal(screen.message, text(spec.message, {verifier: 'Acme Bank'}), code);
  }
  assert.equal(locationRejection('location.accuracy', {...settings, reference: null}), text('location.low_accuracy'));
  assert.equal(locationRejection('location.reference_not_matched', {...settings, reference: {rule: 'outside', match: 'any', places: [{label: 'Depot'}]}}), 'You seem to be too close to Depot. Move away, then try again.');
  assert.equal(new CredflareError('Rejected.', 422, [], 'future.code').code, 'future.code');
  assert.equal(type, 'location_verification');
});

test('a rejection without a known code shows the server message with a retry and the requester fallback', async () => {
  const {rejectionScreen, text} = await import('../dist/index.js');
  for (const error of [new CredflareError('Something new happened.', 422, [], 'future.code'), new CredflareError('The email field is required.', 422, {email: ['The email field is required.']})]) {
    const screen = rejectionScreen(error, {requester: null});
    assert.equal(screen.code, null);
    assert.equal(screen.title, null);
    assert.equal(screen.message, error.message);
    assert.equal(screen.action, 'retry');
    assert.equal(screen.actionLabel, text('rejection.action.retry'));
    assert.equal(screen.requestedBy, `Requested by ${text('common.verifier_fallback')}.`);
  }
  const notConfigured = rejectionScreen(new CredflareError('x', 422, [], 'phone.not_configured'), {requester: {name: '  '}});
  assert.equal(notConfigured.message, 'Confirming a phone number is not available for this request yet. Contact your verifier.');
  assert.equal(notConfigured.action, 'leave');
});

test('requests and confirms contact codes with the real 202 and 201 bodies and no request key', async () => {
  const email = await session().requestCode('email', 'Jane.Doe@example.test');
  const sent = calls.at(-1);
  assert.match(sent.url, /\/sdk\/sessions\/00000000-0000-4000-8000-000000000001\/email-codes$/);
  assert.deepEqual(JSON.parse(sent.body), {email: 'Jane.Doe@example.test'});
  assert.equal(sent.headers['content-type'], 'application/json');
  assert.equal(sent.headers['x-idempotency-key'], undefined);
  assert.deepEqual(email, JSON.parse(await readFile(new URL('./fixtures/email-code-request.json', import.meta.url))).data);
  const phone = await session().requestCode('phone', '+237650000001');
  assert.deepEqual(JSON.parse(calls.at(-1).body), {phone: '+237650000001'});
  assert.equal(phone.destination, '+237*******01');
  assert.equal(phone.sends_remaining, 4);
  const confirmed = await session().confirmCode('email', '123456');
  assert.match(calls.at(-1).url, /\/email-codes\/confirm$/);
  assert.deepEqual(JSON.parse(calls.at(-1).body), {code: '123456'});
  assert.equal(confirmed.verified, true);
  assert.equal(confirmed.id, 1);
});

test('keeps extra rejection fields such as the resend time on the error', async () => {
  const {request} = await import('../dist/index.js');
  const body = {...JSON.parse(await readFile(new URL('./fixtures/rejections/email.resend_too_soon.json', import.meta.url))), resend_available_at: '2026-11-21T23:59:07.000000Z'};
  const fetcher = async () => new Response(JSON.stringify(body), {status: 422, headers: {'Content-Type': 'application/json'}});
  const error = await request(fetcher, 'http://127.0.0.1/x', {method: 'POST'}).catch(cause => cause);
  assert.equal(error.code, 'email.resend_too_soon');
  assert.deepEqual(error.details, {resend_available_at: '2026-11-21T23:59:07.000000Z'});
});

test('a hidden question answer comes back as a field error from the submit route', async () => {
  const error = await session('hidden-answer').submitAnswers({employer: 'Acme'}, crypto.randomUUID()).catch(cause => cause);
  assert.equal(JSON.parse(calls.at(-1).body).type, 'form_submission');
  assert.equal(error.status, 422);
  assert.equal(error.code, null);
  assert.deepEqual(error.errors, {'fields.employer': ['This question is not shown for the answers given.']});
});
