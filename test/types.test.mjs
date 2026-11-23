import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('hosts written for the earlier flow steps and form fields still compile', () => {
  const tsc = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
  const project = fileURLToPath(new URL('./types/tsconfig.json', import.meta.url));
  const result = spawnSync(process.execPath, [tsc, '-p', project], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
