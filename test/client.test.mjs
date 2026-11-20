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
    const fixture = req.headers.authorization === 'Bearer wrong' ? 'unauthorized' : req.url.endsWith('/submit') ? 'submission' : req.url.endsWith('/uploads/documents') ? 'upload' : 'session';
    res.writeHead(fixture === 'unauthorized' ? 401 : fixture === 'session' ? 200 : 201, { 'Content-Type': 'application/json' });
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
  const result = await session().submit({ type:'document_verification', document_type_id:1, file_id:1 }, crypto.randomUUID());
  assert.equal(result.id, 1);
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
  assert.equal((await client.get()).capabilities.liveness, false);
});

test('refuses a mutation without a valid retry key', () => {
  assert.throws(() => session().submit({type:'form_submission',fields:{full_name:'Example'}}, ''), /UUID request key/);
});
