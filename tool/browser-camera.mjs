import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';

const root = new URL('../', import.meta.url);
const initial = JSON.parse(await readFile(new URL('test/fixtures/facial-session.json', root)));
const endpoint = process.env.CHROME_DEBUG_URL ?? (await readFile(new URL('browser-camera.log', root), 'utf8')).match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
if (!endpoint) throw new Error('Start a local headless Chrome with a fake camera and remote debugging first.');
const origin = endpoint.replace('ws:', 'http:').split('/').slice(0, 3).join('/');
const tabs = await (await fetch(origin + '/json/list')).json();
const tab = tabs.find(item => item.type === 'page');
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
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, {resolve, reject}); ws.send(JSON.stringify({id, method, params}));
  });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true, userGesture: true});
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression) {
  for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
  throw new Error('Browser condition timed out: ' + expression);
}
let uploads = 0, sends = 0, retryKey;
const server = createServer(async (req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(`<main></main><script type="module">
      import {CredflareSession} from '/index.js';
      import {mountSelfieCapture} from '/browser.js';
      const info = ${JSON.stringify(initial.data)};
      const client = new CredflareSession({session_id:info.session_id,token:'test-session-token',api_base_url:location.origin+'/api/v1',expires_at:info.expires_at});
      window.disposeCapture = mountSelfieCapture(document.querySelector('main'),client,info,()=>{document.body.dataset.received='true';});
    </script>`);
  }
  if (['/index.js', '/browser.js', '/workflow.js', '/capture.js'].includes(req.url)) {
    res.setHeader('Content-Type', 'text/javascript'); return res.end(await readFile(new URL('dist' + req.url, root)));
  }
  if (!req.url.startsWith('/api/v1/')) {res.writeHead(404); return res.end();}
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();
  assert.equal(req.headers.authorization, 'Bearer test-session-token');
  let fixture;
  if (req.url.endsWith('/uploads/biometrics')) {
    uploads++; assert.match(body, /name="capture_source"\r\n\r\ncamera/);
    assert.match(body, /filename="selfie.jpg"/); assert.match(body, /Content-Type: image\/jpeg/);
    fixture = 'facial-upload';
  } else if (req.url.endsWith('/submit')) {
    sends++; const payload = JSON.parse(body);
    assert.equal(payload.type, 'facial_verification'); assert.equal(payload.image_file_id, 1);
    if (sends === 1) { retryKey = req.headers['x-idempotency-key']; res.writeHead(503); res.end(''); return; }
    assert.equal(req.headers['x-idempotency-key'], retryKey); fixture = 'facial-submission';
  } else { res.writeHead(404); return res.end(); }
  res.writeHead(201, {'Content-Type': 'application/json'});
  res.end(await readFile(new URL(`test/fixtures/${fixture}.json`, root)));
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
try {
  await call('Page.navigate', {url: `http://127.0.0.1:${server.address().port}/`});
  await until(`document.querySelector('button')?.textContent === 'Open front camera'`);
  assert.equal(await evaluate(`document.querySelectorAll('input[type=file]').length`), 0);
  await evaluate(`document.querySelector('button').click()`);
  await until(`document.querySelector('video')?.videoWidth > 0`);
  await evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent==='Take selfie').click()`);
  await until(`document.querySelector('img')?.naturalWidth > 0`);
  assert.equal(await evaluate(`document.querySelector('video').srcObject`), null);
  await evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent==='Send selfie').click()`);
  await until(`document.querySelector('[role=status]').textContent.includes('invalid response')`);
  await evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent==='Send selfie').click()`);
  await until(`document.body.dataset.received === 'true'`);
  assert.equal(uploads, 1); assert.equal(sends, 2);
  await evaluate('window.disposeCapture()');
  assert.equal(await evaluate(`document.querySelector('main').children.length`), 0);
  console.log('PASS: browser camera capture, preview, stopped stream, selfie upload, retry without reupload, stable submission key and cleanup');
} finally {
  await call('Page.navigate', {url: 'about:blank'}); ws.close(); await new Promise(resolve => server.close(resolve));
}
