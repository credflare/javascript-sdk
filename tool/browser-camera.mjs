import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {CredflareServer} from '../dist/server.js';

const root = new URL('../', import.meta.url);
const live = !!process.env.CREDFLARE_API_URL;
const shots = process.env.SCREENSHOT_DIR;
const fixture = async name => JSON.parse(await readFile(new URL(`test/fixtures/${name}.json`, root)));
const traces = {};
for (const name of await readdir(new URL('test/fixtures/liveness-traces/', root))) traces[name.replace('.json', '')] = JSON.parse(await readFile(new URL(`test/fixtures/liveness-traces/${name}`, root)));

let chrome;
async function devtools() {
  if (process.env.CHROME_DEBUG_URL) return process.env.CHROME_DEBUG_URL;
  chrome = spawn(process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${new URL('.browser-test', root).pathname}`,
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-first-run', 'about:blank',
  ]);
  let log = '';
  chrome.stderr.on('data', chunk => { log += chunk; });
  for (let i = 0; i < 100; i++) {
    const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) return match[1];
    await delay(100);
  }
  throw new Error('Chrome did not start.');
}

const endpoint = await devtools();
const origin = endpoint.replace('ws:', 'http:').split('/').slice(0, 3).join('/');
const tab = (await (await fetch(origin + '/json/list')).json()).find(item => item.type === 'page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await once(ws, 'open');
let sequence = 0;
const pending = new Map();
const consoleLines = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const {resolve, reject} = pending.get(message.id); pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
  } else if (message.method === 'Runtime.exceptionThrown') consoleLines.push(JSON.stringify(message.params.exceptionDetails));
  else if (message.method === 'Runtime.consoleAPICalled') consoleLines.push(message.params.args.map(arg => arg.value ?? arg.description).join(' '));
});
function call(method, params = {}) {
  return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, {resolve, reject}); ws.send(JSON.stringify({id, method, params})); });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true, userGesture: true});
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression, timeout = 20000) {
  for (const end = Date.now() + timeout; Date.now() < end;) { if (await evaluate(expression)) return; await delay(100); }
  throw new Error(`Browser condition timed out: ${expression}\nScreen: ${await evaluate('document.querySelector("main").innerText')}\n${consoleLines.join('\n')}`);
}
const texts = () => evaluate(`[...document.querySelectorAll('main *')].filter(n => !n.children.length).map(n => n.textContent.trim()).filter(Boolean)`);
const click = label => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent === ${JSON.stringify(label)} && !x.disabled); if (!b) throw new Error('No button ' + ${JSON.stringify(label)}); b.click(); return true; })()`);
async function screenshot(name) {
  if (!shots) return;
  await mkdir(shots, {recursive: true});
  const {data} = await call('Page.captureScreenshot', {format: 'png'});
  await writeFile(`${shots}/${name}.png`, Buffer.from(data, 'base64'));
}

const capture = await fixture('capture-session');
const stage = {facial: false, location: false};
const seen = {uploads: [], submits: [], challenges: 0, locationAttempts: 0};
function sessionBody() {
  const data = structuredClone(capture.data);
  data.profile.verification_requirements = data.profile.verification_requirements.filter(item => !(stage.facial && item.verification_type === 'facial_verification') && !(stage.location && item.verification_type === 'location_verification'));
  return {...capture, data};
}
function part(body, name) { return body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`))?.[1]; }

async function fakeApi(req, res, body) {
  assert.equal(req.headers.authorization, 'Bearer test-session-token');
  const json = (status, value) => { res.writeHead(status, {'Content-Type': 'application/json'}); res.end(JSON.stringify(value)); };
  if (req.method === 'GET') return json(200, sessionBody());
  assert.match(req.headers['x-idempotency-key'] ?? '', /^[0-9a-f-]{36}$/);
  if (req.url.endsWith('/liveness-challenges')) {
    seen.challenges++;
    const challenge = await fixture('liveness-challenge');
    challenge.data.expires_at = new Date(Date.now() + 120000).toISOString();
    return json(201, challenge);
  }
  if (req.url.endsWith('/uploads/biometrics')) {
    const type = part(body.toString('latin1'), 'type');
    assert.equal(part(body.toString('latin1'), 'capture_source'), 'camera');
    assert.equal(part(body.toString('latin1'), 'challenge_id'), (await fixture('liveness-challenge')).data.challenge_id);
    const mime = body.toString('latin1').match(/name="file"; filename="[^"]+"\r\nContent-Type: ([^\r]+)/)?.[1];
    seen.uploads.push({type, gesture: part(body.toString('latin1'), 'gesture'), mime, size: body.length});
    return json(201, await fixture({gesture: 'gesture-upload', liveness_video: 'video-upload', selfie: 'selfie-upload'}[type]));
  }
  if (req.url.endsWith('/submit')) {
    const payload = JSON.parse(body.toString());
    seen.submits.push(payload);
    if (payload.type === 'facial_verification') { stage.facial = true; return json(201, await fixture('facial-submission')); }
    if (payload.type === 'location_verification') {
      if (seen.submits.filter(item => item.type === 'location_verification').length === 1) return json(422, await fixture('location-rejection'));
      stage.location = true;
      return json(201, await fixture('location-submission'));
    }
  }
  res.writeHead(404); res.end();
}

let descriptor;
const server = createServer(async (req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><main></main><script type="module">
      import {CredflareSession, createReplayProvider} from '/dist/index.js';
      import {mountRemainingSteps} from '/dist/browser.js';
      const traces = ${JSON.stringify(traces)};
      const descriptor = await (await fetch('/descriptor')).json();
      const client = new CredflareSession(descriptor);
      let gestures = null;
      const create = client.createLivenessChallenge.bind(client);
      client.createLivenessChallenge = async (...args) => { const challenge = await create(...args); gestures = challenge.gestures; window.challengeGestures = gestures; return challenge; };
      let queue = [];
      const provider = createReplayProvider(index => {
        if (index === 0) queue = [];
        if (!queue.length && gestures) {
          for (const name of ['position_ok_pass', ...gestures.map(g => g + '_pass')]) queue.push(...traces[name].samples);
          gestures = null;
        }
        const next = queue.shift();
        return next ? {...next, t: index * 66} : {t: index * 66, faces: 1, box: {x: 0.3, y: 0.22, w: 0.4, h: 0.5}, eye_open: 0.85, smile: 0.05, yaw: 0, pitch: 0};
      });
      window.dispose = mountRemainingSteps(document.querySelector('main'), client, {provider, onDone: () => { document.body.dataset.done = 'true'; }});
    </script>`);
  }
  if (req.url === '/mediapipe') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(`<!doctype html><video autoplay muted playsinline></video><script type="module">
      import {createMediaPipeProvider} from '/dist/mediapipe.js';
      const video = document.querySelector('video');
      video.srcObject = await navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: 'user'}});
      await video.play();
      const samples = [];
      const provider = createMediaPipeProvider({load: () => import('/vendor/mediapipe/vision_bundle.mjs'), wasmBaseUrl: '/vendor/mediapipe/wasm', modelAssetPath: '/vendor/face_landmarker.task'});
      const stop = await provider.start(video, sample => { samples.push(sample); if (samples.length === 10) { stop(); window.samples = samples; } }, error => { window.samples = String(error); });
    </script>`);
  }
  const vendor = req.url.match(/^\/vendor\/mediapipe\/((?:wasm\/)?[a-z_]+\.(?:mjs|js|wasm))$/);
  if (vendor) { res.setHeader('Content-Type', vendor[1].endsWith('.wasm') ? 'application/wasm' : 'text/javascript'); return res.end(await readFile(new URL(`node_modules/@mediapipe/tasks-vision/${vendor[1]}`, root))); }
  if (req.url === '/vendor/face_landmarker.task' && process.env.CREDFLARE_FACE_MODEL) return res.end(await readFile(process.env.CREDFLARE_FACE_MODEL));
  if (req.url === '/descriptor') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(descriptor)); }
  if (/^\/dist\/[a-z.]+\.js$/.test(req.url)) { res.setHeader('Content-Type', 'text/javascript'); return res.end(await readFile(new URL(req.url.slice(1), root))); }
  if (!live && req.url.startsWith('/api/v1/')) {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    return fakeApi(req, res, Buffer.concat(chunks));
  }
  res.writeHead(404); res.end();
});
server.listen(Number(process.env.PORT ?? 0), '127.0.0.1');
await once(server, 'listening');
const pageOrigin = `http://127.0.0.1:${server.address().port}`;
if (live) {
  const client = new CredflareServer(process.env.CREDFLARE_API_URL, {clientId: process.env.CREDFLARE_CLIENT_ID, clientSecret: process.env.CREDFLARE_CLIENT_SECRET});
  const verification = await client.createVerification({email: 'browser-liveness@example.test', profileId: Number(process.env.CREDFLARE_PROFILE_ID)});
  descriptor = await client.createSession(verification.id, [pageOrigin]);
} else {
  descriptor = {session_id: capture.data.session_id, token: 'test-session-token', api_base_url: `${pageOrigin}/api/v1`, expires_at: new Date(Date.now() + 3600000).toISOString()};
}

let fixes;
try {
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', {width: 412, height: 915, deviceScaleFactor: 1, mobile: true});
  await call('Browser.grantPermissions', {origin: pageOrigin, permissions: ['geolocation', 'videoCapture']});
  const fix = {latitude: 4.0511, longitude: 9.7679, accuracy: 500};
  await call('Emulation.setGeolocationOverride', fix);
  fixes = setInterval(() => void call('Emulation.setGeolocationOverride', fix).catch(() => undefined), 1000);
  if (process.env.CREDFLARE_FACE_MODEL) {
    await call('Page.navigate', {url: pageOrigin + '/mediapipe'});
    await until('!!window.samples', 60000);
    const samples = await evaluate('window.samples');
    assert.ok(Array.isArray(samples), String(samples));
    assert.ok(samples.every(sample => sample.faces === 0 && sample.box === null), 'the synthetic camera shows no face');
    console.log('PASS: MediaPipe provider loaded lazily and reported no face for the synthetic camera');
  }
  await call('Page.navigate', {url: pageOrigin + '/'});
  await until(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Start')`);
  const intro = await texts();
  assert.ok(intro.includes('Follow the prompts'));
  assert.ok(intro.some(line => line.startsWith('This step records a short video of your face. It is sent to ')));
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('main h2')).textAlign`), 'center');
  await screenshot('01-liveness-intro');
  await click('Start');
  await until(`document.querySelector('.cf-camera video')?.videoWidth > 0`);
  await until(`!!window.challengeGestures`);
  const gestures = await evaluate('window.challengeGestures');
  await until(`document.querySelector('.cf-rec') && !document.querySelector('.cf-rec').hidden`);
  await screenshot('02-liveness-running');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.cf-camera video')).transform`), 'matrix(-1, 0, 0, 1, 0, 0)');
  await until(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Take selfie')`, 60000);
  await screenshot('03-selfie');
  await click('Take selfie');
  await until(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Send selfie')`);
  await screenshot('04-selfie-review');
  await click('Send selfie');
  await until(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Share location')`, 30000);
  const locationTexts = await texts();
  assert.ok(locationTexts.includes('Share your location at Head office'));
  assert.ok(!locationTexts.includes('You need to be at Head office.'));
  await screenshot('05-location-consent');
  await click('Share location');
  await until(`document.querySelector('.cf-notice')?.textContent.includes('not accurate enough')`, 30000);
  await screenshot('06-location-low-accuracy');
  fix.accuracy = 12;
  await click('Try again');
  await until(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Send location')`, 30000);
  await screenshot('07-location-found');
  await click('Send location');
  if (!live) {
    await until(`document.querySelector('.cf-notice')?.textContent.includes('The location is not accurate enough. Move to an open area and try again.')`);
    await screenshot('08-location-rejected');
    await click('Send location');
  }
  await until(`[...document.querySelectorAll('h2')].some(h => h.textContent === 'Evidence received')`, 30000);
  const receipt = await texts();
  assert.ok(receipt.includes('Selfie received'));
  assert.ok(receipt.includes('Location received'));
  await screenshot('09-receipt');
  if (!live) {
    assert.equal(seen.challenges, 1);
    assert.deepEqual(seen.uploads.map(item => item.type), ['gesture', 'gesture', 'gesture', 'liveness_video', 'selfie']);
    assert.deepEqual(seen.uploads.filter(item => item.type === 'gesture').map(item => item.gesture), gestures);
    assert.match(seen.uploads.find(item => item.type === 'liveness_video').mime, /^video\/(webm|mp4)$/);
    for (const item of seen.uploads) assert.ok(item.size > 1000, `${item.type} has content`);
    const facial = seen.submits.find(item => item.type === 'facial_verification');
    assert.equal(facial.gesture_file_ids.length, gestures.length);
    assert.equal(facial.video_file_id, 5);
    assert.deepEqual(facial.metadata.liveness_results.map(item => item.challenge), gestures);
    const located = seen.submits.filter(item => item.type === 'location_verification').at(-1);
    assert.equal(located.metadata.provider, 'browser');
    assert.equal(located.metadata.is_mock, null);
    assert.equal(located.metadata.accuracy, 12);
  }
  await evaluate('window.dispose()');
  console.log(`PASS (${live ? 'live API' : 'fixture API'}): challenge ${gestures.join(', ')}, camera preview mirrored, gesture frames, webm recording, selfie, uploads, facial submission, location consent, low accuracy retry${live ? '' : ', server rejection retry'}, location submission and receipt`);
} finally {
  clearInterval(fixes);
  await call('Page.navigate', {url: 'about:blank'}).catch(() => undefined);
  ws.close();
  chrome?.kill();
  await new Promise(resolve => server.close(resolve));
}
