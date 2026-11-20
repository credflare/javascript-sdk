import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {captureSteps, capturePolicy, isCaptureSupported, methodSummary} from '../dist/index.js';
const fixture = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')).data.profile.document_requirements[0];
for (const [mode, name, expected] of [
  ['snapshot_or_upload', 'capture-snapshot-or-upload', ['camera_or_upload:front', 'camera_or_upload:back']],
  ['snapshot_and_upload', 'capture-snapshot_and_upload', ['camera:front', 'camera:back', 'upload:front', 'upload:back']],
]) {
  test(`${mode} preserves every required capture step`, async () => {
    assert.deepEqual(captureSteps(await fixture(name)).map(step => step.id), expected);
  });
}
test('an either method from an older backend is read as snapshot_or_upload', async () => {
  const requirement = {...await fixture('capture-snapshot-or-upload'), capture_method: 'either'};
  assert.equal(capturePolicy(requirement), 'snapshot_or_upload');
  assert.equal(isCaptureSupported(requirement), true);
  assert.deepEqual(captureSteps(requirement).map(step => step.id), ['camera_or_upload:front', 'camera_or_upload:back']);
});
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
  const requirement = await fixture('capture-snapshot-or-upload');
  delete requirement.capture_method;
  assert.equal(capturePolicy(requirement), 'snapshot_or_upload');
  assert.equal(methodSummary(requirement), 'Photo or file');
});
test('an unsupported method is reported instead of producing steps', async () => {
  const requirement = {...await fixture('capture-snapshot-or-upload'), capture_method: 'camera_only'};
  assert.equal(isCaptureSupported(requirement), false);
  assert.equal(methodSummary(requirement), 'Not available in this app');
  assert.throws(() => captureSteps(requirement));
});
