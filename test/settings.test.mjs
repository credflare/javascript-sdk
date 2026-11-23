import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {facialSettings, locationSettings, settings as schema} from '../dist/index.js';
const load = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url))).data;

test('reads facial and location settings from the session response', async () => {
  const requirements = (await load('capture-session')).profile.verification_requirements;
  assert.deepEqual(facialSettings(requirements), {gestures: ['blink', 'smile', 'turn_left', 'turn_right', 'nod'], gesture_count: 3, record_video: true});
  assert.deepEqual(locationSettings(requirements), {max_accuracy_m: 50, max_age_s: 60, mock_location: 'reject', ip_country: 'flag', reference: {rule: 'within', match: 'any', places: [{label: 'Head office'}]}});
});

test('fills spec defaults when a requirement carries no settings', async () => {
  const requirements = (await load('facial-session')).profile.verification_requirements;
  assert.equal(requirements[0].settings, undefined);
  assert.deepEqual(facialSettings(requirements).gestures, schema.facial_verification.gestures.default);
  assert.equal(facialSettings(requirements).gesture_count, schema.facial_verification.gesture_count.default);
  assert.equal(locationSettings(requirements), null);
  const location = locationSettings([{verification_type: 'location_verification', settings: {max_accuracy_m: 1, mock_location: 'maybe'}}]);
  assert.equal(location.max_accuracy_m, schema.location_verification.max_accuracy_m.default);
  assert.equal(location.mock_location, 'reject');
  assert.equal(location.reference, null);
});

test('reference places keep labels only', () => {
  const location = locationSettings([{verification_type: 'location_verification', settings: {reference: {rule: 'outside', places: [{label: 'Depot', latitude: 1, longitude: 2}, {label: ''}]}}}]);
  assert.deepEqual(location.reference, {rule: 'outside', match: 'any', places: [{label: 'Depot'}]});
});
