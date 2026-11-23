import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {qrMatrix, qrSvg} from '../dist/index.js';

const finder = (m, x, y) => [0, 1, 2, 3, 4, 5, 6].every(i => m[y][x + i] && m[y + 6][x + i] && m[y + i][x] && m[y + i][x + 6]) && m[y + 1][x + 1] === false && m[y + 3][x + 3];

test('encodes the real handoff link as a QR code with finder patterns and the timing lines', async () => {
  const url = JSON.parse(await readFile(new URL('./fixtures/handoff.json', import.meta.url))).data.handoff_url;
  const m = qrMatrix(url);
  assert.equal(m.length, 45);
  const n = m.length;
  assert.ok(finder(m, 0, 0) && finder(m, n - 7, 0) && finder(m, 0, n - 7));
  for (let i = 8; i < n - 8; i++) { assert.equal(m[6][i], i % 2 === 0); assert.equal(m[i][6], i % 2 === 0); }
  assert.equal(m[n - 8][8], true);
  assert.equal(qrMatrix('hello').length, 21);
  assert.equal(qrMatrix('y'.repeat(400)).length > 45, true);
  assert.match(qrSvg(url), /^<svg [^>]*viewBox="0 0 53 53"/);
});
