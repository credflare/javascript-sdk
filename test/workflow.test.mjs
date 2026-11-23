import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {requiresSelfie, requiresFacial, requiresLocation, needsHostSteps, selfieFileTypes, nextStep, documentsNextKey, hasOutstanding, refreshOutcome, receiptKey} from '../dist/index.js';
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
  assert.equal(nextStep(withForm), 'questions');
  const withFounders = {...withForm, profile: {...withForm.profile, form_schema: [{key: 'founders', label: 'Founders', type: 'founders', required: true}]}};
  assert.equal(nextStep(withFounders), 'questions');
});

test('the documents list names the in app steps that follow, in profile order', async () => {
  const base = await load('combined-session');
  const withSteps = types => ({...base, profile: {...base.profile, form_schema: [], verification_requirements: types.map((verification_type, id) => ({id, verification_type, configuration: {}}))}});
  assert.equal(documentsNextKey(withSteps(['facial_verification'])), 'documents.selfie_next');
  assert.equal(documentsNextKey(withSteps(['location_verification'])), 'documents.location_next');
  assert.equal(documentsNextKey(withSteps(['facial_verification', 'location_verification'])), 'documents.selfie_location_next');
  assert.equal(documentsNextKey(withSteps(['location_verification', 'facial_verification'])), 'documents.location_selfie_next');
  assert.equal(documentsNextKey(withSteps([])), null);
  assert.equal(documentsNextKey({...withSteps([]), profile: {...withSteps([]).profile, form_schema: [{name: 'phone'}]}}), 'documents.host_steps_next');
  assert.equal(documentsNextKey({...withSteps(['facial_verification']), profile: {...withSteps(['facial_verification']).profile, form_schema: [{name: 'phone'}]}}), 'documents.selfie_next');
});

test('the refresh rule continues with a requirement a workflow added and shows the receipt when nothing is left', async () => {
  const before = await load('questionnaire-session');
  const after = await load('requirement-added-session');
  assert.equal(nextStep(before), 'questions');
  assert.equal(refreshOutcome(before), 'continue');
  assert.equal(hasOutstanding(after), true);
  assert.equal(after.profile.form_schema, null);
  assert.equal(nextStep(after), 'phone_verification');
  assert.equal(receiptKey('questions'), 'receipt.answers');
  assert.equal(receiptKey('phone_verification'), 'receipt.phone');
  const answered = {...before, profile: {...before.profile, form_schema: null}};
  assert.equal(nextStep(answered), 'email_verification');
  const finished = {...after, profile: {...after.profile, verification_requirements: []}};
  assert.equal(refreshOutcome(finished), 'receipt');
  assert.equal(nextStep(finished), 'done');
  assert.equal(refreshOutcome({...after, status: 'completed'}), 'receipt');
});
