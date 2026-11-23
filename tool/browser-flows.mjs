import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';

const root = new URL('../', import.meta.url);
const fixtures = {};
for (const dir of ['', 'rejections/']) {
  for (const name of (await readdir(new URL(`test/fixtures/${dir}`, root))).filter(file => file.endsWith('.json'))) {
    fixtures[dir + name.replace('.json', '')] = JSON.parse(await readFile(new URL(`test/fixtures/${dir}${name}`, root)));
  }
}

const server = createServer(async (req, res) => {
  if (/^\/dist\/[a-z.]+\.js$/.test(req.url)) { res.setHeader('Content-Type', 'text/javascript'); return res.end(await readFile(new URL(req.url.slice(1), root))); }
  if (req.url === '/fixtures.json') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(fixtures)); }
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><main id="app"></main><script type="module">
    window.browser = await import('/dist/browser.js');
    window.sdk = await import('/dist/index.js');
    window.fx = await (await fetch('/fixtures.json')).json();
    window.ready = true;
  </script></html>`);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const page = `http://127.0.0.1:${server.address().port}/`;

const profile = await mkdtemp(join(tmpdir(), 'credflare-flows-'));
const chrome = spawn(process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-first-run', 'about:blank',
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
async function until(expression, timeout = 10000) {
  for (const end = Date.now() + timeout; Date.now() < end;) { if (await evaluate(expression)) return; await delay(50); }
  throw new Error(`Browser condition timed out: ${expression}\nScreen: ${await evaluate('document.querySelector("main").innerText')}`);
}
async function fresh() {
  await call('Page.navigate', {url: page});
  await until('window.ready === true');
  await evaluate(`(() => {
    window.calls = [];
    window.routes = {};
    window.reply = (status, body) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
    window.fetcher = async (url, init) => {
      const path = new URL(url).pathname.replace(/^.*\\/sdk\\/sessions\\/[^/]+/, '') || '/';
      const key = init.method + ' ' + path;
      window.calls.push({key, body: init.body});
      const route = window.routes[key];
      if (!route) throw new TypeError('offline');
      return route(init);
    };
    window.session = new sdk.CredflareSession({...fx['handoff-redeem'].data, api_base_url: 'http://localhost:8018/api/v1'}, (url, init) => window.fetcher(url, init));
    window.app = document.querySelector('#app');
    window.say = (key, values) => sdk.text(key, values);
    window.press = label => { const b = [...app.querySelectorAll('button')].find(x => x.textContent === label); if (!b) throw new Error('No button ' + label); b.click(); };
    window.type = (input, value) => { input.value = value; input.dispatchEvent(new Event('input')); input.dispatchEvent(new Event('change')); };
    window.submitForm = () => app.querySelector('form').requestSubmit();
    return true;
  })()`);
}
const screen = () => evaluate('app.innerText');

try {
  await fresh();
  await evaluate(`(() => {
    const rejection = structuredClone(fx['rejections/phone.resend_too_soon']);
    rejection.resend_available_at = new Date(Date.now() + 90000).toISOString();
    routes['POST /phone-codes'] = () => reply(422, rejection);
    browser.mountContactCode(app, session, fx['requirement-added-session'].data, {channel: 'phone', onSubmitted() {}, onLeave() {}});
    type(app.querySelector('input'), '+237 650 000 001');
    submitForm();
    return true;
  })()`);
  await until(`!!app.querySelector('input[autocomplete="one-time-code"]')`);
  assert.ok((await screen()).includes(await evaluate(`say('rejection.code_resend_too_soon.message')`)));
  const waiting = await screen();
  assert.ok(waiting.includes('+237 650 000 001'), 'the code screen names the number the applicant typed');
  assert.match(waiting, /\b(8\d|90)\b/, 'the resend countdown runs to the rejection resend_available_at');
  assert.equal(await evaluate(`[...app.querySelectorAll('button')].find(b => b.textContent === say('contact_code.resend')).disabled`), true);
  console.log('PASS resend_too_soon without a local request shows the code entry and counts down');

  await fresh();
  await evaluate(`(() => {
    routes['POST /phone-codes'] = () => reply(422, fx['rejections/phone.not_configured']);
    window.handed = [];
    app.addEventListener('credflare:host-action-required', event => handed.push(event.detail.code));
    browser.mountContactCode(app, session, fx['requirement-added-session'].data, {channel: 'phone', onSubmitted() {}, onHostActionRequired: ({code}) => handed.push('callback:' + code)});
    type(app.querySelector('input'), '+237650000001');
    submitForm();
    return true;
  })()`);
  await until(`app.innerText.includes(say('rejection.phone_not_configured.title'))`);
  await evaluate(`press(say(sdk.rejections.actions.leave.label)), true`);
  await until(`app.innerText.includes(say('receipt.host_steps'))`);
  assert.deepEqual(await evaluate('handed'), ['callback:phone.not_configured', 'phone.not_configured'], 'the host receives the rejection code');
  console.log('PASS a leave rejection hands its code to the host by callback and event');

  await fresh();
  await evaluate(`(() => {
    let sends = 0;
    const rejection = structuredClone(fx['rejections/phone.resend_too_soon']);
    rejection.resend_available_at = new Date(Date.now() + 45000).toISOString();
    const sent = structuredClone(fx['phone-code-request']);
    sent.data.resend_available_at = rejection.resend_available_at;
    routes['POST /phone-codes'] = () => ++sends === 1 ? reply(202, sent) : reply(422, rejection);
    browser.mountContactCode(app, session, fx['requirement-added-session'].data, {channel: 'phone', onSubmitted() {}});
    type(app.querySelector('input'), '+237650000001');
    submitForm();
    return true;
  })()`);
  await until(`!!app.querySelector('input[autocomplete="one-time-code"]')`);
  await evaluate(`press(say('phone.change')), true`);
  await evaluate(`(() => { type(app.querySelector('input'), '+237650000002'); submitForm(); return true; })()`);
  await until(`calls.filter(c => c.key === 'POST /phone-codes').length === 2 && !!app.querySelector('input[autocomplete="one-time-code"]')`);
  const kept = await screen();
  assert.ok(kept.includes(await evaluate(`fx['phone-code-request'].data.destination`)), 'the code entry still names the destination that has a code');
  assert.ok(kept.includes(await evaluate(`say('phone.change_after')`)), 'a note says a new number can be used after the countdown');
  assert.ok(!kept.includes('+237650000002'));
  console.log('PASS a refused new number during the cooldown keeps the code entry for the number that has a code');

  await fresh();
  await evaluate(`(() => {
    routes['POST /submit'] = () => new Promise(() => {});
    browser.mountQuestions(app, session, fx['questionnaire-earlier-answers-session'].data, {onSubmitted() {}});
    type(app.querySelector('input'), 'Acme');
    submitForm();
    return true;
  })()`);
  await until(`calls.some(c => c.key === 'POST /submit')`);
  assert.equal(await evaluate(`app.querySelector('fieldset').disabled && app.querySelector('input').matches(':disabled')`), true, 'answers are locked while they are sent');
  console.log('PASS answers are locked while they are sent');

  await fresh();
  await evaluate(`(() => {
    routes['GET /'] = () => reply(200, fx['questionnaire-earlier-answers-session']);
    routes['POST /submit'] = () => reply(409, fx['session-closed']);
    browser.mountRemainingSteps(app, session);
    return true;
  })()`);
  await until(`!!app.querySelector('form input')`);
  await evaluate(`(() => { type(app.querySelector('form input'), 'Acme'); submitForm(); return true; })()`);
  await until(`app.innerText.includes(say('receipt.title'))`);
  assert.ok(!(await screen()).includes(await evaluate(`say('receipt.answers')`)));
  assert.equal(await evaluate(`calls.filter(c => c.key === 'GET /').length`), 1);
  console.log('PASS a closed case refusing the answers ends on the receipt');

  await fresh();
  await evaluate(`(() => {
    const info = structuredClone(fx['questionnaire-session']);
    const employer = info.data.profile.form_schema.find(q => q.key === 'employer');
    info.data.profile.form_schema = [info.data.profile.form_schema.find(q => q.key === 'employment'), {...employer, type: 'signature'}];
    info.data.profile.verification_requirements = [];
    routes['GET /'] = () => reply(200, info);
    window.handed = [];
    browser.mountRemainingSteps(app, session, {onHostActionRequired: ({code}) => handed.push(code)});
    return true;
  })()`);
  await until(`!!app.querySelector('select')`);
  await evaluate(`(() => { const select = app.querySelector('select'); select.value = 'Employed'; select.dispatchEvent(new Event('change')); return true; })()`);
  await until(`app.innerText.includes(say('receipt.host_steps'))`);
  assert.deepEqual(await evaluate('handed'), [null]);
  assert.equal(await evaluate(`calls.filter(c => c.key === 'POST /submit').length`), 0);
  console.log('PASS a revealed question the SDK cannot ask hands the form to the host');

  await fresh();
  await evaluate(`(() => {
    const sent = structuredClone(fx['phone-code-request']);
    sent.data.resend_available_at = new Date(Date.now() - 1000).toISOString();
    routes['POST /phone-codes'] = () => reply(202, sent);
    routes['POST /phone-codes/confirm'] = () => new Promise(() => {});
    browser.mountContactCode(app, session, fx['requirement-added-session'].data, {channel: 'phone', onSubmitted() {}});
    type(app.querySelector('input'), '+237650000001');
    submitForm();
    return true;
  })()`);
  await until(`!!app.querySelector('input[autocomplete="one-time-code"]')`);
  assert.equal(await evaluate(`[...app.querySelectorAll('button')].find(b => b.textContent === say('contact_code.resend')).disabled`), false);
  await evaluate(`(() => { const input = app.querySelector('input[autocomplete="one-time-code"]'); type(input, '123456'); submitForm(); return true; })()`);
  await until(`calls.some(c => c.key === 'POST /phone-codes/confirm')`);
  const locked = await evaluate(`[...app.querySelectorAll('button')].filter(b => [say('contact_code.resend'), say('phone.change')].includes(b.textContent)).map(b => b.disabled)`);
  assert.deepEqual(locked, [true, true], 'resend and change are locked while a code is confirmed');
  await evaluate(`[...app.querySelectorAll('button')].find(b => b.textContent === say('contact_code.resend')).click(), true`);
  assert.equal(await evaluate(`calls.filter(c => c.key === 'POST /phone-codes').length`), 1);
  console.log('PASS resend and change stay locked while a confirmation is in flight');

  await fresh();
  await evaluate(`(() => {
    let gets = 0;
    routes['GET /'] = () => ++gets === 1 ? reply(200, fx['requirement-added-session']) : reply(409, fx['session-closed']);
    routes['POST /handoff'] = () => reply(201, fx['handoff']);
    browser.mountRemainingSteps(app, session, {handoff: true});
    return true;
  })()`);
  await until(`app.innerText.includes(say('handoff.action'))`);
  await evaluate(`press(say('handoff.action')), true`);
  await until(`app.innerText.includes(say('receipt.title'))`, 12000);
  assert.equal(await evaluate(`calls.filter(c => c.key === 'GET /').length`), 2, 'the closed poll is not followed by another fetch');
  console.log('PASS a closed case seen by the handoff poll ends on the receipt without another fetch');

  await fresh();
  const loops = await evaluate(`(async () => {
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = () => real({video: true});
    navigator.mediaDevices.enumerateDevices = async () => [{kind: 'videoinput', deviceId: 'front', label: 'Front'}, {kind: 'videoinput', deviceId: 'back', label: 'Back'}];
    const challenge = structuredClone(fx['liveness-challenge']);
    challenge.data.expires_at = new Date(Date.now() + 120000).toISOString();
    routes['POST /liveness-challenges'] = () => reply(201, challenge);
    const starts = [];
    const provider = {name: 'mediapipe', start: () => new Promise(resolve => starts.push(resolve))};
    browser.mountLiveness(app, session, fx['capture-session'].data, {provider, onSubmitted() {}});
    press(say('liveness.start'));
    const wait = async test => { for (let i = 0; i < 200 && !test(); i++) await new Promise(r => setTimeout(r, 25)); };
    await wait(() => starts.length === 1);
    const select = app.querySelector('select');
    select.value = 'back';
    select.dispatchEvent(new Event('change'));
    await wait(() => starts.length === 2);
    const live = new Set();
    starts.forEach((resolve, index) => { live.add(index); resolve(() => live.delete(index)); });
    await new Promise(r => setTimeout(r, 50));
    return [...live];
  })()`);
  assert.deepEqual(loops, [1], 'only the newest camera keeps a sampling loop');
  console.log('PASS switching cameras while the detector starts leaves one sampling loop');

  await fresh();
  const constructorForm = await evaluate(`(async () => {
    const info = structuredClone(fx['questionnaire-session'].data);
    const employer = info.profile.form_schema.find(q => q.key === 'employer');
    info.profile.form_schema = [{...employer, key: 'constructor', show_if: null}];
    browser.mountQuestions(app, session, info, {onSubmitted() {}});
    const before = app.querySelectorAll('.cf-field-error').length;
    submitForm();
    return [before, app.querySelector('.cf-field-error')?.textContent];
  })()`);
  assert.deepEqual(constructorForm, [0, await evaluate(`say('questions.required')`)]);
  console.log('PASS a question keyed constructor renders and validates like any other');

  await fresh();
  await evaluate(`(() => {
    routes['POST /submit'] = () => reply(201, fx['questionnaire-submission']);
    browser.mountQuestions(app, session, fx['questionnaire-earlier-answers-session'].data, {onSubmitted(fields) { window.sent = fields; }});
    return true;
  })()`);
  assert.ok((await screen()).includes('Employer name'), 'an answer sent before the refresh reveals its follow up question');
  await evaluate(`(() => { type(app.querySelector('input'), 'Acme'); submitForm(); return true; })()`);
  await until('!!window.sent');
  assert.deepEqual(await evaluate('window.sent'), {employer: 'Acme'});
  console.log('PASS earlier answers from the session reveal follow up questions without being sent again');

  {
    await fresh();
    await evaluate(`(() => {
      const info = structuredClone(fx['questionnaire-session'].data);
      const employer = info.profile.form_schema.find(q => q.key === 'employer');
      info.profile.form_schema = [{...employer, key: 'founders', label: 'Founders', type: 'founders', show_if: null}];
      routes['POST /submit'] = () => reply(201, fx['questionnaire-submission']);
      window.sent = null;
      browser.mountQuestions(app, session, info, {onSubmitted(fields) { window.sent = fields; }});
      submitForm();
      return true;
    })()`);
    assert.equal(await evaluate(`app.querySelector('.cf-field-error')?.textContent`), await evaluate(`say('questions.required')`));
    await evaluate(`press(say('questions.founders_add')), true`);
    await evaluate(`type(app.querySelector('input[type=text]'), ' Ada Lovelace '), true`);
    await evaluate(`press(say('questions.founders_add')), true`);
    await evaluate(`(() => { const me = app.querySelector('input[type=checkbox]'); me.checked = true; me.dispatchEvent(new Event('change')); submitForm(); return true; })()`);
    await until('window.sent !== null');
    assert.deepEqual(await evaluate('window.sent'), {founders: {includes_applicant: true, names: ['Ada Lovelace']}});
    assert.deepEqual(JSON.parse(await evaluate(`calls.find(c => c.key === 'POST /submit').body`)).fields, {founders: {includes_applicant: true, names: ['Ada Lovelace']}});
    console.log('PASS founders are entered as names plus the applicant toggle');
  }
} finally {
  await call('Page.navigate', {url: 'about:blank'}).catch(() => undefined);
  ws.close();
  chrome.kill();
  await new Promise(resolve => server.close(resolve));
  await rm(profile, {recursive: true, force: true}).catch(() => undefined);
}
