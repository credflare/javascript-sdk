import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {requiresSelfie, needsHostSteps, selfieFileTypes} from '../dist/index.js';
test('the actual configured requirements select selfie collection and clear after submission', async () => {
  const info = JSON.parse(await readFile(new URL('./fixtures/facial-session.json', import.meta.url))).data;
  assert.equal(requiresSelfie(info), true);
  assert.equal(needsHostSteps(info), false);
  assert.deepEqual(selfieFileTypes(info), ['jpg', 'png', 'webp']);
  const complete = JSON.parse(await readFile(new URL('./fixtures/facial-complete.json', import.meta.url))).data;
  assert.equal(requiresSelfie(complete), false);
  assert.equal(needsHostSteps(complete), false);
  assert.equal(complete.capabilities.liveness, false);
});

test('combined cases retain the selfie requirement after their documents are received', async () => {
  const initial = JSON.parse(await readFile(new URL('./fixtures/combined-session.json', import.meta.url))).data;
  const next = JSON.parse(await readFile(new URL('./fixtures/combined-after-document.json', import.meta.url))).data;
  assert.equal(initial.profile.document_requirements.length, 1);
  assert.equal(requiresSelfie(initial), true);
  assert.equal(next.profile.document_requirements.length, 0);
  assert.equal(requiresSelfie(next), true);
});
