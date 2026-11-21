import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {requiresSelfie, requiresFacial, requiresLocation, needsHostSteps, selfieFileTypes, nextStep} from '../dist/index.js';
const load = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url))).data;

test('the actual configured requirements select facial collection and clear after submission', async () => {
  const info = await load('facial-session');
  assert.equal(requiresSelfie(info), true);
  assert.equal(needsHostSteps(info), false);
  assert.equal(nextStep(info), 'facial_verification');
  assert.deepEqual(selfieFileTypes(info), ['jpg', 'png', 'webp']);
  const complete = await load('facial-complete');
  assert.equal(requiresSelfie(complete), false);
  assert.equal(nextStep(complete), 'done');
});

test('combined cases keep the facial requirement after their documents are received', async () => {
  const initial = await load('combined-session');
  const next = await load('combined-after-document');
  assert.equal(nextStep(initial), 'documents');
  assert.equal(requiresFacial(initial), true);
  assert.equal(nextStep(next), 'facial_verification');
});

test('liveness and location run inside the SDK in profile order', async () => {
  const info = await load('capture-session');
  assert.equal(nextStep(info), 'facial_verification');
  assert.equal(requiresLocation(info), true);
  assert.equal(needsHostSteps(info), false);
  const afterFacial = {...info, profile: {...info.profile, verification_requirements: info.profile.verification_requirements.slice(1)}};
  assert.equal(nextStep(afterFacial), 'location_verification');
  const withForm = {...info, profile: {...info.profile, verification_requirements: [], form_schema: [{key: 'full_name', label: 'Full name', type: 'text', required: true}]}};
  assert.equal(nextStep(withForm), 'host');
});
