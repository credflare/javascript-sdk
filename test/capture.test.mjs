import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {captureSteps, capturePolicy, isCaptureSupported, methodSummary} from '../dist/index.js';
const fixture = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')).data.profile.document_requirements[0];
for (const [mode, expected] of [
  ['either', ['either:front', 'either:back']],
  ['snapshot_and_upload', ['camera:front', 'camera:back', 'upload:front', 'upload:back']],
]) {
  test(`${mode} preserves every required capture step`, async () => {
    assert.deepEqual(captureSteps(await fixture(`capture-${mode}`)).map(step => step.id), expected);
  });
}
test('steps carry side and source labels', async () => {
  const steps = captureSteps(await fixture('capture-snapshot_and_upload'));
  assert.deepEqual(steps.map(step => `${step.label} ${step.sourceLabel}`), ['Front Camera photo', 'Back Camera photo', 'Front Saved file', 'Back Saved file']);
});
test('a requirement without capture_method follows an upload document type', async () => {
  const requirement = await fixture('session');
  assert.equal(requirement.capture_method, undefined);
  assert.equal(capturePolicy(requirement), 'upload');
  assert.equal(methodSummary(requirement), 'Saved files');
});
test('a requirement without capture_method follows a camera document type', async () => {
  const requirement = await fixture('capture-either');
  delete requirement.capture_method;
  assert.equal(capturePolicy(requirement), 'either');
  assert.equal(methodSummary(requirement), 'Photo or file');
});
test('an unsupported method is reported instead of producing steps', async () => {
  const requirement = {...await fixture('capture-either'), capture_method: 'camera_only'};
  assert.equal(isCaptureSupported(requirement), false);
  assert.equal(methodSummary(requirement), 'Not available in this app');
  assert.throws(() => captureSteps(requirement));
});
