import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeMediaPipeResult} from '../dist/mediapipe.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/mediapipe/portrait-result.json', import.meta.url)));

test('a real result for a face turned to its own right and looking down gives negative yaw and pitch', () => {
  const sample = normalizeMediaPipeResult(fixture.unmirrored, 120);
  assert.equal(sample.t, 120);
  assert.equal(sample.faces, 1);
  assert.ok(sample.yaw < -20, `yaw ${sample.yaw}`);
  assert.ok(sample.pitch < -5, `pitch ${sample.pitch}`);
  for (const key of ['eye_open', 'smile']) assert.ok(sample[key] >= 0 && sample[key] <= 1, key);
  for (const key of ['x', 'y', 'w', 'h']) assert.ok(sample.box[key] >= 0 && sample.box[key] <= 1, key);
});

test('mirroring the same image flips yaw and keeps pitch', () => {
  const sample = normalizeMediaPipeResult(fixture.mirrored, 0);
  assert.ok(sample.yaw > 20, `yaw ${sample.yaw}`);
  assert.ok(sample.pitch < -5, `pitch ${sample.pitch}`);
});

test('blendshape signals follow the contract', () => {
  const scores = Object.fromEntries(fixture.unmirrored.faceBlendshapes[0].categories.map(item => [item.categoryName, item.score]));
  const sample = normalizeMediaPipeResult(fixture.unmirrored, 0);
  assert.equal(sample.eye_open, 1 - (scores.eyeBlinkLeft + scores.eyeBlinkRight) / 2);
  assert.equal(sample.smile, (scores.mouthSmileLeft + scores.mouthSmileRight) / 2);
});

test('no face gives an empty sample', () => {
  assert.deepEqual(normalizeMediaPipeResult({faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: []}, 5), {t: 5, faces: 0, box: null, eye_open: null, smile: null, yaw: null, pitch: null});
});
