import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {acquireFix, fixProblem, locationCopy, locationErrorKey, locationSettings, LocationError, location as spec, text} from '../dist/index.js';

const settings = locationSettings((JSON.parse(await readFile(new URL('./fixtures/capture-session.json', import.meta.url))).data).profile.verification_requirements);
const fix = (patch = {}) => ({latitude: 4.05, longitude: 9.76, accuracy: 20, altitude: null, fixTime: 1_000_000, isMock: false, provider: 'gps', ...patch});

test('a fix must meet the accuracy and age limits and not be a rejected mock', () => {
  assert.equal(fixProblem(fix(), settings, 1_000_000), null);
  assert.equal(fixProblem(fix({accuracy: 51}), settings, 1_000_000), 'low_accuracy');
  assert.equal(fixProblem(fix({accuracy: null}), settings, 1_000_000), 'low_accuracy');
  assert.equal(fixProblem(fix(), settings, 1_000_000 + 61_000), 'stale');
  assert.equal(fixProblem(fix({isMock: true}), settings, 1_000_000), 'mock_detected');
  assert.equal(fixProblem(fix({isMock: null}), settings, 1_000_000), null);
  assert.equal(fixProblem(fix({isMock: true}), {...settings, mock_location: 'flag'}, 1_000_000), null);
});

test('retries up to the spec attempts until a fix is accurate enough', async () => {
  const seen = [];
  const result = await acquireFix(async attempt => { seen.push(attempt); return fix({accuracy: attempt < 3 ? 400 : 10}); }, settings, {now: () => 1_000_000});
  assert.deepEqual(seen, [1, 2, 3]);
  assert.equal(result.accuracy, 10);
  await assert.rejects(acquireFix(async () => fix({accuracy: 400}), settings, {now: () => 1_000_000}), error => error instanceof LocationError && error.code === 'low_accuracy');
  assert.equal(spec.retry_attempts, 3);
});

test('a detected mock location stops the retries', async () => {
  let calls = 0;
  await assert.rejects(acquireFix(async () => { calls += 1; return fix({isMock: true}); }, settings, {now: () => 1_000_000}), error => error.code === 'mock_detected');
  assert.equal(calls, 1);
  assert.equal(locationErrorKey('mock_detected'), 'location.mock_detected');
  assert.equal(locationErrorKey('permission_denied', true), 'location.permission_denied_browser');
});

test('reference place copy uses labels only', () => {
  assert.deepEqual(locationCopy(settings, 'Acme'), {title: 'Share your location at Head office', need: 'You need to be at Head office.', why: text('location.why', {verifier: 'Acme'})});
  const outside = {...settings, reference: {rule: 'outside', match: 'all', places: [{label: 'Depot'}, {label: 'Port'}]}};
  assert.equal(locationCopy(outside, 'Acme').need, 'You need to be away from these places: Depot, Port.');
  assert.equal(locationCopy({...settings, reference: null}, 'Acme').title, 'Share your location');
});

test('a transient fix failure counts as an attempt and permission denial stops at once', async () => {
  let calls = 0;
  const result = await acquireFix(async () => { calls += 1; if (calls === 1) throw new LocationError('unavailable'); return fix(); }, settings, {now: () => 1_000_000});
  assert.equal(calls, 2);
  assert.equal(result.accuracy, 20);
  calls = 0;
  await assert.rejects(acquireFix(async () => { calls += 1; throw new LocationError('permission_denied'); }, settings), error => error.code === 'permission_denied');
  assert.equal(calls, 1);
  await assert.rejects(acquireFix(async () => { throw new LocationError('timeout'); }, settings), error => error.code === 'timeout');
});
