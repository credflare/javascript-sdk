import {readdir, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const spec = resolve(process.argv[2] ?? '../sdk-spec', 'fixtures');
const local = new URL('../test/fixtures/', import.meta.url).pathname;
const drift = [];
for (const dir of ['', 'liveness-traces', 'rejections']) {
  for (const name of (await readdir(resolve(spec, dir))).filter(file => file.endsWith('.json'))) {
    const expected = await readFile(resolve(spec, dir, name), 'utf8');
    const actual = await readFile(resolve(local, dir, name), 'utf8').catch(() => null);
    if (actual !== expected) drift.push(`${dir ? dir + '/' : ''}${name}`);
  }
}
if (drift.length) {
  console.error(`Fixtures differ from ${spec}: ${drift.join(', ')}`);
  process.exit(1);
}
console.log('Fixtures match the spec.');
