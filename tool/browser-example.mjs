import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {createDemoServer} from '../examples/server.mjs';

const root = new URL('../', import.meta.url);
const fixture = async name => JSON.parse(await readFile(new URL(`test/fixtures/${name}.json`, root)));
const documents = new URL('test/fixtures/documents/', root).pathname;

let stage = 'documents', session = 'capture-snapshot_and_upload', closed = false;
const seen = {uploads: [], submits: []};
const api = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Idempotency-Key, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('latin1');
  const json = async (status, name) => { res.writeHead(status, {'Content-Type': 'application/json'}); res.end(JSON.stringify(await fixture(name))); };
  const descriptor = async () => {
    const value = await fixture('client-session');
    value.data.api_base_url = `http://127.0.0.1:${api.address().port}/api/v1`;
    res.writeHead(201, {'Content-Type': 'application/json'}); res.end(JSON.stringify(value));
  };
  if (req.url === '/api/v1/client/verifications') return json(201, 'client-verification');
  if (/^\/api\/v1\/client\/verifications\/[^/]+\/sessions$/.test(req.url)) return descriptor();
  if (req.method === 'GET') return json(200, stage === 'documents' ? session : 'facial-complete');
  if (req.url.endsWith('/uploads/documents')) {
    const field = name => body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`))?.[1];
    seen.uploads.push({side: field('side'), source: field('capture_source'), mime: body.match(/name="file"; filename="[^"]+"\r\nContent-Type: ([^\r]+)/)?.[1]});
    return json(201, 'upload');
  }
  if (req.url.endsWith('/submit')) { seen.submits.push(JSON.parse(body)); if (closed) return json(409, 'session-closed'); stage = 'done'; return json(201, 'submission'); }
  res.writeHead(404); res.end();
});
api.listen(0, '127.0.0.1');
await once(api, 'listening');
const port = Number(process.env.PORT ?? 3107);
const example = createDemoServer({CREDFLARE_API_URL: `http://127.0.0.1:${api.address().port}/api/v1`, CREDFLARE_CLIENT_ID: 'client', CREDFLARE_CLIENT_SECRET: 'secret', CREDFLARE_PROFILE_ID: '1'}, globalThis.fetch, port);
example.listen(port, '127.0.0.1');
await once(example, 'listening');
const page = `http://localhost:${port}/`;

const profile = await mkdtemp(join(tmpdir(), 'credflare-example-'));
const chrome = spawn(process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--use-fake-device-for-media-stream=device-count=2', '--use-fake-ui-for-media-stream', '--no-first-run', 'about:blank',
]);
let log = '';
chrome.stderr.on('data', chunk => { log += chunk; });
let endpoint;
for (let i = 0; i < 300 && !endpoint; i++) { endpoint = log.match(/DevTools listening on (ws:\/\/\S+)/)?.[1]; if (!endpoint) await delay(100); }
if (!endpoint) { chrome.kill(); throw new Error(`Chrome did not start: ${log.slice(0, 500)}`); }
const origin = endpoint.replace('ws:', 'http:').split('/').slice(0, 3).join('/');
const tab = (await (await fetch(origin + '/json/list')).json()).find(item => item.type === 'page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await once(ws, 'open');
let sequence = 0;
const pending = new Map();
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const {resolve, reject} = pending.get(message.id); pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
  }
});
const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, {resolve, reject}); ws.send(JSON.stringify({id, method, params})); });
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true, userGesture: true});
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression, timeout = 15000) {
  for (const end = Date.now() + timeout; Date.now() < end;) { if (await evaluate(expression)) return; await delay(50); }
  throw new Error(`Browser condition timed out: ${expression}\nScreen: ${await evaluate('document.body.innerText')}`);
}
const field = index => `document.querySelectorAll('#capture fieldset')[${index}]`;
async function open() {
  await call('Page.navigate', {url: page});
  await until(`!!document.querySelector('#start')?.onsubmit`);
  await evaluate(`(() => { const input = document.querySelector('#start input'); input.value = 'applicant@example.test'; document.querySelector('#start').requestSubmit(); return true; })()`);
  await until(`!!document.querySelector('#capture button.doc')`);
  await evaluate(`document.querySelector('#capture button.doc').click(), true`);
  await until(`!!document.querySelector('#capture form')`);
}
async function photo(index) {
  await evaluate(`${field(index)}.querySelector('[data-source=camera]').click(), true`);
  await until(`document.querySelector('#capture .camera video')?.videoWidth > 0`);
  await evaluate(`[...${field(index)}.querySelectorAll('.camera button')].find(b => b.textContent === 'Take photo').click(), true`);
  await until(`!!${field(index)}.querySelector('.preview img') && !document.querySelector('#capture .camera')`);
}
async function file(index, name) {
  const {root: doc} = await call('DOM.getDocument', {depth: -1});
  const {nodeId} = await call('DOM.querySelector', {nodeId: doc.nodeId, selector: `#capture fieldset:nth-of-type(${index + 1}) input[type=file]`});
  await call('DOM.setFileInputFiles', {nodeId, files: [documents + name]});
  await until(`!!${field(index)}.querySelector('.preview:not([hidden]) img')`);
}

try {
  await call('Runtime.enable');
  await call('DOM.enable');
  await call('Page.enable');
  await open();
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#capture legend')].map(l => l.textContent)`), ['Front · Camera photo', 'Back · Camera photo', 'Front · Saved file', 'Back · Saved file']);
  await evaluate(`${field(0)}.querySelector('[data-source=camera]').click(), true`);
  await until(`document.querySelector('#capture .camera select')?.options.length === 2`);
  const first = await evaluate(`document.querySelector('#capture .camera video').srcObject.getVideoTracks()[0].label`);
  await evaluate(`(() => { const s = document.querySelector('#capture .camera select'); s.value = s.options[1].value; s.dispatchEvent(new Event('change')); return true; })()`);
  await until(`document.querySelector('#capture .camera video')?.srcObject?.getVideoTracks()[0]?.label !== ${JSON.stringify(first)} && document.querySelector('#capture .camera video')?.videoWidth > 0`);
  console.log('PASS the document camera offers a picker when the browser reports two cameras');
  await evaluate(`[...document.querySelectorAll('#capture .camera button')].find(b => b.textContent === 'Cancel').click(), true`);
  await photo(0);
  await photo(1);
  await file(2, 'sample-back.png');
  await file(3, 'sample-back.png');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#capture [data-source]')].map(x => x.textContent)`), ['Retake photo', 'Retake photo', 'Change file', 'Change file']);
  assert.equal(await evaluate(`${field(0)}.querySelector('.preview img').alt`), 'Preview of the Front');
  await photo(0);
  await file(2, 'sample-front.png');
  assert.equal(await evaluate(`${field(2)}.querySelector('.preview').innerText.includes('sample-front.png')`), true);
  console.log('PASS each side shows a preview and can be retaken or changed before sending');
  await evaluate(`[...document.querySelectorAll('#capture button')].find(b => b.textContent === 'Send document').click(), true`);
  await until(`document.body.innerText.includes('Evidence received')`);
  assert.deepEqual(seen.uploads, [
    {side: 'front', source: 'camera', mime: 'image/jpeg'}, {side: 'back', source: 'camera', mime: 'image/jpeg'},
    {side: 'front', source: 'upload', mime: 'image/png'}, {side: 'back', source: 'upload', mime: 'image/png'},
  ]);
  assert.deepEqual(seen.submits[0].evidence.map(item => `${item.side}:${item.source}`), ['front:camera', 'back:camera', 'front:upload', 'back:upload']);
  console.log('PASS camera photos and saved files are uploaded with their source and submitted in step order');

  stage = 'documents'; session = 'capture-snapshot_and_upload'; closed = true;
  await open();
  await photo(0);
  await photo(1);
  await file(2, 'sample-front.png');
  await file(3, 'sample-back.png');
  const submitted = seen.submits.length;
  await evaluate(`[...document.querySelectorAll('#capture button')].find(b => b.textContent === 'Send document').click(), true`);
  await until(`document.body.innerText.includes('Evidence received') || [...document.querySelectorAll('#capture button')].some(b => b.textContent === 'Send document' && !b.disabled)`);
  assert.equal(seen.submits.length, submitted + 1);
  assert.ok(await evaluate(`document.body.innerText.includes('Evidence received')`), 'a closed case ends on the receipt');
  assert.equal(await evaluate(`[...document.querySelectorAll('#capture button')].some(b => b.textContent === 'Send document')`), false, 'the document cannot be sent again');
  console.log('PASS a document refused because the case is closed ends on the receipt');

  stage = 'documents'; session = 'capture-snapshot_and_upload'; closed = false;
  await call('Page.addScriptToEvaluateOnNewDocument', {source: `navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Requested device not found', 'NotFoundError'));`});
  await open();
  await evaluate(`${field(0)}.querySelector('[data-source=camera]').click(), true`);
  await until(`!!document.querySelector('#capture .phone')`);
  assert.equal(await evaluate(`document.querySelector('#status').textContent`), 'The camera is unavailable. Try again on a device with a camera.');
  console.log('PASS a camera only side without a camera explains why and offers to continue on a phone');
} finally {
  await call('Page.navigate', {url: 'about:blank'}).catch(() => undefined);
  ws.close();
  chrome.kill();
  await new Promise(resolve => example.close(resolve));
  await new Promise(resolve => api.close(resolve));
  await rm(profile, {recursive: true, force: true}).catch(() => undefined);
}
