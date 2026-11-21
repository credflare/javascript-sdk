import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import {runTrace, createChallengeRun} from '../dist/index.js';

const dir = new URL('./fixtures/liveness-traces/', import.meta.url);
const traces = (await readdir(dir)).filter(name => name.endsWith('.json')).sort();
const load = async name => JSON.parse(await readFile(new URL(name, dir)));

test('every spec trace is present', () => {
  assert.equal(traces.length, 33);
});

for (const name of traces) {
  test(`trace ${name}`, async () => {
    const trace = await load(name);
    const result = runTrace(trace);
    assert.equal(result.outcome, trace.expect);
    if (trace.expect_status) assert.equal(result.status, trace.expect_status);
  });
}

test('a challenge passes the position gate then each gesture in order', async () => {
  const position = await load('position_ok_pass.json');
  const smile = await load('smile_pass.json');
  const blink = await load('blink_pass.json');
  const run = createChallengeRun({gestures: ['smile', 'blink'], provider: 'default', expiresAt: Date.now() + 60000});
  let t = 0, last;
  const completed = [];
  for (const sample of [...position.samples, ...smile.samples, ...blink.samples]) {
    last = run.push({...sample, t: t += 66});
    if (last.completed) completed.push(last.completed.gesture);
    if (last.stage === 'pass') break;
  }
  assert.equal(last.stage, 'pass');
  assert.equal(last.hint, 'liveness.success');
  assert.deepEqual(completed, ['smile', 'blink']);
});

test('a gesture timeout ends the challenge', async () => {
  const position = await load('position_ok_pass.json');
  const timeout = await load('turn_left_timeout.json');
  const run = createChallengeRun({gestures: ['turn_left'], provider: 'default'});
  let t = 0, last;
  for (const sample of [...position.samples, ...timeout.samples]) {
    last = run.push({...sample, t: t += 66});
    if (last.stage === 'timeout' || last.stage === 'pass') break;
  }
  assert.equal(last.stage, 'timeout');
  assert.equal(last.hint, 'liveness.timeout');
});

test('an expired challenge stops before evaluating samples', async () => {
  const position = await load('position_ok_pass.json');
  let clock = 1000;
  const run = createChallengeRun({gestures: ['smile'], provider: 'mlkit', expiresAt: 1500, now: () => clock});
  assert.equal(run.push(position.samples[0]).stage, 'position');
  clock = 1500;
  assert.equal(run.push(position.samples[1]).stage, 'expired');
});

test('the position hint follows the gate status', async () => {
  const run = createChallengeRun({gestures: ['smile'], provider: 'default'});
  assert.equal(run.push({t: 0, faces: 0, box: null, eye_open: null, smile: null, yaw: null, pitch: null}).hint, 'liveness.position.no_face');
  assert.equal(run.push({t: 66, faces: 1, box: {x: 0.45, y: 0.45, w: 0.1, h: 0.1}, eye_open: 0.8, smile: 0, yaw: 0, pitch: 0}).hint, 'liveness.position.move_closer');
});
