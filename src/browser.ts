import {CredflareSession, CredflareError} from './index.js';
import type {LivenessChallenge, SessionDescriptor, SessionInfo} from './index.js';
import {nextStep} from './workflow.js';
import {text, verifierName} from './copy.js';
import type {CopyValues} from './copy.js';
import {facialSettings, locationSettings} from './settings.js';
import {createChallengeRun} from './engine.js';
import type {FaceProviderName, FaceSample} from './engine.js';
import type {FaceSignalProvider} from './faces.js';
import {acquireFix, LocationError, locationCopy, locationErrorKey, locationRejection, locationSubmission} from './location.js';
import type {LocationFix} from './location.js';
import {challengeRejected, livenessErrorMessage, sendLivenessEvidence} from './liveness.js';
import type {GestureEvidence, LivenessEvidence} from './liveness.js';
import {iconSvgs, liveness as livenessSpec, location as locationSpec, tokens} from './spec.generated.js';
import type {CopyKey, IconName} from './spec.generated.js';

type Palette = Record<keyof typeof tokens.color.light, string>;
const cssVars = (palette: Palette) => Object.entries(palette).map(([name, value]) => `--cf-${name.replace(/_/g, '-')}:${value}`).join(';');

export function installStyles(doc: Document = document): void {
  if (doc.getElementById('credflare-sdk-style')) return;
  const {type, radius, size, spacing} = tokens;
  const style = doc.createElement('style');
  style.id = 'credflare-sdk-style';
  style.textContent = `
.cf-root{${cssVars(tokens.color.light)};color:var(--cf-ink);background:var(--cf-surface);font-family:${tokens.font.family},system-ui,sans-serif;text-align:${tokens.text_align};display:flex;flex-direction:column;align-items:center;gap:${spacing.gap}px;max-width:${size.max_content_width}px;margin:0 auto;padding:${spacing.gutter}px}
@media (prefers-color-scheme:dark){.cf-root{${cssVars(tokens.color.dark)}}}
.cf-root>*{width:100%;box-sizing:border-box}
.cf-title{font-size:${type.title.size}px;line-height:${type.title.line_height}px;font-weight:${type.title.weight};margin:0}
.cf-body{font-size:${type.body.size}px;line-height:${type.body.line_height}px;color:var(--cf-muted);margin:0}
.cf-small{font-size:${type.small.size}px;line-height:${type.small.line_height}px;color:var(--cf-muted);margin:0}
.cf-icon{display:flex;justify-content:center;color:var(--cf-primary)}
.cf-icon svg{width:${size.icon}px;height:${size.icon}px}
.cf-illustration svg{width:${size.illustration}px;height:${size.illustration}px}
.cf-button{font:inherit;font-size:${type.button.size}px;font-weight:${type.button.weight};min-height:${size.button_height}px;border-radius:${radius.lg}px;border:1px solid var(--cf-primary);background:var(--cf-primary);color:var(--cf-on-primary);cursor:pointer;padding:0 ${spacing.xl}px}
.cf-button.cf-secondary{background:var(--cf-surface);color:var(--cf-primary);border-color:var(--cf-border)}
.cf-button:disabled{opacity:.5;cursor:wait}
.cf-notice{display:flex;flex-direction:column;align-items:center;gap:${spacing.xs}px;border:1px solid var(--cf-error);color:var(--cf-error);border-radius:${radius.md}px;padding:${spacing.md}px}
.cf-notice .cf-icon,.cf-notice .cf-body{color:var(--cf-error)}
.cf-card{border:1px solid var(--cf-border);border-radius:${radius.lg}px;padding:${spacing.lg}px;display:flex;flex-direction:column;align-items:center;gap:${spacing.xs}px}
.cf-camera{position:relative;width:100%;aspect-ratio:3/4;max-height:60vh;border-radius:${radius.xl}px;overflow:hidden;background:var(--cf-soft)}
.cf-camera video,.cf-camera img{width:100%;height:100%;object-fit:cover;display:block}
.cf-camera video{transform:scaleX(-1)}
.cf-oval{position:absolute;inset:12% 18%;border:3px solid var(--cf-primary);border-radius:50%;pointer-events:none}
.cf-oval.cf-ok{border-color:var(--cf-success)}
.cf-rec{position:absolute;top:${spacing.sm}px;left:50%;transform:translateX(-50%);background:var(--cf-surface);color:var(--cf-error);border-radius:${radius.pill}px;padding:${spacing.xxs}px ${spacing.sm}px;font-size:${type.chip.size}px}
.cf-hint{font-size:${type.subtitle.size}px;line-height:${type.subtitle.line_height}px;font-weight:${type.subtitle.weight};margin:0;min-height:${type.subtitle.line_height * 2}px}
[hidden]{display:none!important}`;
  doc.head.append(style);
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', content?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}
function icon(name: IconName, className = 'cf-icon'): HTMLElement {
  const wrapper = node('div', className);
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.innerHTML = iconSvgs[name];
  return wrapper;
}
function button(label: string, secondary = false): HTMLButtonElement {
  const element = node('button', secondary ? 'cf-button cf-secondary' : 'cf-button', label);
  element.type = 'button';
  return element;
}
function notice(message: string): HTMLElement {
  const box = node('div', 'cf-notice');
  box.setAttribute('role', 'alert');
  box.append(icon('error'), node('p', 'cf-body', message));
  return box;
}
const say = (key: CopyKey, values?: CopyValues) => text(key, values);

export function mountSession(element: HTMLElement, descriptor: SessionDescriptor, onReady: (session: CredflareSession, info: SessionInfo) => void): () => void {
  const abort = new AbortController();
  const session = new CredflareSession(descriptor);
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = say('common.loading');
  element.replaceChildren(status);
  session.get(abort.signal).then(info => {
    if (abort.signal.aborted) return;
    status.textContent = info.custom_message || '';
    onReady(session, info);
  }).catch((error: unknown) => {
    if (!abort.signal.aborted) status.textContent = error instanceof CredflareError ? livenessErrorMessage(error, say('errors.start_failed')) : say('errors.start_failed');
  });
  return () => { abort.abort(); element.replaceChildren(); };
}

export interface LivenessOptions {
  provider?: FaceSignalProvider<HTMLVideoElement>;
  onSubmitted: () => void;
  onSample?: (sample: FaceSample) => void;
}

async function defaultProvider(): Promise<FaceSignalProvider<HTMLVideoElement>> {
  const module = await import('./mediapipe.js');
  return module.createMediaPipeProvider();
}

function grab(video: HTMLVideoElement, maxSide = 1280): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext('2d');
  if (!context || !canvas.width) return Promise.reject(new Error(say('errors.camera_no_photo')));
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob && blob.size ? resolve(blob) : reject(new Error(say('errors.camera_no_photo'))), 'image/jpeg', 0.9));
}

function videoMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const type of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) if (MediaRecorder.isTypeSupported(type)) return type;
  return null;
}

export function mountLiveness(element: HTMLElement, session: CredflareSession, info: SessionInfo, options: LivenessOptions): () => void {
  installStyles();
  element.classList.add('cf-root');
  const settings = facialSettings(info.profile?.verification_requirements);
  const verifier = verifierName(info);
  const abort = new AbortController();
  let disposed = false, stream: MediaStream | undefined, stopProvider: (() => void) | undefined, recorder: MediaRecorder | undefined, recordTimer: ReturnType<typeof setTimeout> | undefined;
  let evidence: LivenessEvidence | undefined;
  const stopCamera = () => {
    stopProvider?.(); stopProvider = undefined;
    if (recordTimer) clearTimeout(recordTimer);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recorder = undefined;
    stream?.getTracks().forEach(track => track.stop()); stream = undefined;
  };
  const render = (...children: Node[]) => { if (!disposed) element.replaceChildren(...children); };

  function intro(error?: string) {
    const start = button(say('liveness.start'));
    start.onclick = () => void run();
    const total = settings?.gesture_count ?? 3;
    render(icon('selfie'), node('h2', 'cf-title', say('liveness.title')), node('p', 'cf-body', say('liveness.body', {total})),
      ...(settings?.record_video ?? true ? [node('p', 'cf-small', say('video.consent', {verifier}))] : []),
      ...(error ? [notice(error)] : []), start, node('p', 'cf-small', say('selfie.privacy', {verifier})));
  }

  function failed(message: string) {
    stopCamera();
    const retry = button(say('liveness.retry'));
    retry.onclick = () => void run();
    render(icon('selfie'), node('h2', 'cf-title', say('liveness.title')), notice(message), retry, node('p', 'cf-small', say('selfie.privacy', {verifier})));
  }

  async function run() {
    const status = node('p', 'cf-body', say('selfie.starting_camera'));
    status.setAttribute('role', 'status');
    render(icon('selfie'), node('h2', 'cf-title', say('liveness.title')), status);
    let challenge: LivenessChallenge;
    try {
      stopCamera();
      stream = await navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: 'user', width: {ideal: 640}, height: {ideal: 480}}});
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      return failed(say(name === 'NotAllowedError' ? 'errors.camera_denied_browser' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'errors.front_camera_required' : 'errors.camera_unavailable'));
    }
    try {
      challenge = await session.createLivenessChallenge(crypto.randomUUID(), abort.signal);
    } catch (error) {
      return failed(error instanceof CredflareError && error.status !== 0 ? livenessErrorMessage(error) : say('errors.challenge_failed'));
    }
    if (disposed) return stopCamera();
    const camera = node('div', 'cf-camera'), video = node('video'), oval = node('div', 'cf-oval'), rec = node('div', 'cf-rec', say('video.recording'));
    video.autoplay = true; video.muted = true; video.playsInline = true; video.srcObject = stream!;
    rec.hidden = true;
    camera.append(video, oval, rec);
    const hint = node('p', 'cf-hint', say('liveness.position.no_face'));
    hint.setAttribute('role', 'status'); hint.setAttribute('aria-live', 'polite');
    const progress = node('p', 'cf-small', '');
    render(node('h2', 'cf-title', say('liveness.title')), camera, hint, progress);
    try { await video.play(); } catch { return failed(say('errors.camera_unavailable')); }
    const gestures: GestureEvidence[] = [];
    const frames: Promise<void>[] = [];
    const chunks: Blob[] = [];
    let videoBlob: Promise<Blob | null> = Promise.resolve(null);
    const mime = videoMime();
    const startRecording = () => {
      if (!challenge.record_video || !mime || recorder) return;
      recorder = new MediaRecorder(new MediaStream(stream!.getVideoTracks()), {mimeType: mime, videoBitsPerSecond: 1_000_000});
      const active = recorder;
      videoBlob = new Promise(resolve => {
        active.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        active.onstop = () => resolve(chunks.length ? new Blob(chunks, {type: mime.split(';')[0]}) : null);
      });
      active.start(250);
      rec.hidden = false;
      recordTimer = setTimeout(() => { if (active.state !== 'inactive') active.stop(); rec.hidden = true; }, Math.max(1, Math.min(challenge.max_video_seconds, livenessSpec.video.max_seconds)) * 1000 - 250);
    };
    const stopRecording = () => { if (recordTimer) clearTimeout(recordTimer); if (recorder && recorder.state !== 'inactive') recorder.stop(); rec.hidden = true; };
    let provider: FaceSignalProvider<HTMLVideoElement>;
    try { provider = options.provider ?? await defaultProvider(); } catch { return failed(say('errors.camera_unavailable')); }
    const engine = createChallengeRun({gestures: challenge.gestures, provider: provider.name, expiresAt: Date.parse(challenge.expires_at)});
    const total = challenge.gestures.length;
    let origin: number | null = null, finished = false;
    const finish = async (outcome: 'pass' | 'timeout' | 'expired') => {
      finished = true;
      stopProvider?.(); stopProvider = undefined;
      stopRecording();
      if (outcome !== 'pass') return failed(say(outcome === 'timeout' ? 'liveness.timeout' : 'liveness.expired'));
      hint.textContent = say('liveness.success');
      const clip = await videoBlob;
      try { await Promise.all(frames); } catch { return; }
      if (challenge.record_video && !clip) return failed(say('errors.camera_unavailable'));
      selfie(challenge, provider.name, video, gestures, clip);
    };
    const onSample = (raw: FaceSample) => {
      if (finished || disposed) return;
      origin ??= raw.t;
      const sample = {...raw, t: raw.t - origin};
      options.onSample?.(sample);
      const update = engine.push(sample);
      oval.classList.toggle('cf-ok', update.stage === 'gesture' && update.tracked);
      if (update.stage === 'gesture') startRecording();
      hint.textContent = say(update.hint);
      progress.textContent = update.stage === 'gesture' || update.stage === 'pass' ? say('liveness.progress', {current: Math.min(update.gestureIndex + 1, total), total}) : '';
      if (update.completed) {
        const completed = update.completed;
        const pending: GestureEvidence = {gesture: completed.gesture, completedAt: Date.now(), key: crypto.randomUUID(), file: new Blob()};
        gestures.push(pending);
        frames.push(grab(video).then(blob => { pending.file = blob; }, error => { finished = true; failed(say('errors.camera_no_photo')); throw error; }));
      }
      if (update.stage === 'pass' || update.stage === 'timeout' || update.stage === 'expired') void finish(update.stage);
    };
    try {
      stopProvider = await provider.start(video, onSample, () => { if (!finished) { finished = true; failed(say('errors.generic')); } });
    } catch {
      return failed(say('errors.camera_unavailable'));
    }
  }

  function selfie(challenge: LivenessChallenge, providerName: FaceProviderName, video: HTMLVideoElement, gestures: GestureEvidence[], clip: Blob | null) {
    const take = button(say('selfie.take'));
    const camera = node('div', 'cf-camera');
    camera.append(video, node('div', 'cf-oval cf-ok'));
    render(icon('selfie'), node('h2', 'cf-title', say('selfie.title')), node('p', 'cf-body', say('selfie.guidance')), camera, take, node('p', 'cf-small', say('selfie.privacy', {verifier})));
    void video.play().catch(() => undefined);
    take.onclick = async () => {
      take.disabled = true;
      try {
        const photo = await grab(video, 1600);
        stopCamera();
        evidence = {
          challenge, provider: providerName, gestures,
          video: clip ? {file: clip, key: crypto.randomUUID()} : null,
          selfie: {file: photo, key: crypto.randomUUID()}, submitKey: crypto.randomUUID(), capturedAt: Date.now(),
        };
        review(photo);
      } catch (error) {
        take.disabled = false;
        render(icon('selfie'), node('h2', 'cf-title', say('selfie.title')), notice(error instanceof Error ? error.message : say('errors.selfie_failed')), camera, take);
      }
    };
  }

  function review(photo: Blob, error?: string) {
    const url = URL.createObjectURL(photo);
    const frame = node('div', 'cf-camera'), image = node('img');
    image.src = url; image.alt = say('selfie.preview_label'); image.style.transform = 'scaleX(-1)';
    frame.append(image);
    const send = button(say('selfie.send')), retake = button(say('selfie.retake'), true);
    const status = node('p', 'cf-small', '');
    status.setAttribute('role', 'status');
    retake.onclick = () => { URL.revokeObjectURL(url); evidence = undefined; void run(); };
    send.onclick = async () => {
      if (!evidence) return;
      send.disabled = retake.disabled = true;
      status.textContent = say('liveness.sending');
      try {
        await sendLivenessEvidence(session, evidence, (current, total) => { status.textContent = say('sending.uploading_progress', {current, total}); }, abort.signal);
        URL.revokeObjectURL(url);
        if (!disposed) options.onSubmitted();
      } catch (cause) {
        if (disposed) return;
        if (challengeRejected(cause)) { URL.revokeObjectURL(url); evidence = undefined; return failed(say('liveness.expired')); }
        send.disabled = retake.disabled = false;
        status.textContent = '';
        review(photo, livenessErrorMessage(cause, say('errors.send_selfie_failed')));
      }
    };
    render(node('h2', 'cf-title', say('selfie.review_title')), node('p', 'cf-body', say('selfie.review_body')), frame, ...(error ? [notice(error)] : []), status, send, retake, node('p', 'cf-small', say('selfie.privacy', {verifier})));
  }

  intro();
  const visibility = () => { if (document.hidden && stream) failed(say('liveness.expired')); };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', stopCamera);
  return () => {
    disposed = true; abort.abort(); stopCamera();
    document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', stopCamera);
    element.replaceChildren(); element.classList.remove('cf-root');
  };
}

export interface LocationOptions {
  geolocation?: Geolocation;
  onSubmitted: () => void;
}

function browserFix(geolocation: Geolocation): Promise<LocationFix> {
  return new Promise((resolve, reject) => geolocation.getCurrentPosition(
    position => resolve({
      latitude: position.coords.latitude, longitude: position.coords.longitude,
      accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
      altitude: position.coords.altitude ?? null, fixTime: position.timestamp, isMock: null, provider: 'browser',
    }),
    error => reject(new LocationError(error.code === error.PERMISSION_DENIED ? 'permission_denied' : error.code === error.TIMEOUT ? 'timeout' : 'unavailable', error.message)),
    {enableHighAccuracy: true, timeout: locationSpec.fix_timeout_s * 1000, maximumAge: 0},
  ));
}

export function mountLocation(element: HTMLElement, session: CredflareSession, info: SessionInfo, options: LocationOptions): () => void {
  installStyles();
  element.classList.add('cf-root');
  const settings = locationSettings(info.profile?.verification_requirements);
  const verifier = verifierName(info);
  const copy = locationCopy(settings, verifier);
  const abort = new AbortController();
  let disposed = false, submitKey = crypto.randomUUID();
  const render = (...children: Node[]) => { if (!disposed) element.replaceChildren(...children); };
  const header = () => [icon('location'), node('h2', 'cf-title', copy.title)];

  function consent(error?: string) {
    const share = button(error ? say('location.retry') : say('location.share'));
    share.onclick = () => void locate();
    render(...header(), node('p', 'cf-body', copy.why), ...(copy.need ? [node('p', 'cf-body', copy.need)] : []),
      node('p', 'cf-small', say('location.what_shared')), node('p', 'cf-small', say('location.permission_prompt')), ...(error ? [notice(error)] : []), share);
  }

  async function locate() {
    const status = node('p', 'cf-body', say('location.waiting'));
    status.setAttribute('role', 'status');
    render(...header(), status);
    const geolocation = options.geolocation ?? navigator.geolocation;
    if (!geolocation) return consent(say('location.unavailable'));
    try {
      const fix = await acquireFix(() => browserFix(geolocation), settings!, {onAttempt: attempt => { if (attempt > 1) status.textContent = say('location.waiting_accuracy'); }});
      if (!disposed) found(fix);
    } catch (error) {
      if (disposed) return;
      consent(error instanceof LocationError ? say(locationErrorKey(error.code, true), {verifier}) : say('location.unavailable'));
    }
  }

  function found(fix: LocationFix, error?: string) {
    const card = node('div', 'cf-card');
    card.append(
      node('p', 'cf-small', say('location.accuracy_label')), node('p', 'cf-body', say('location.accuracy_value', {meters: Math.round(fix.accuracy ?? 0)})),
      node('p', 'cf-small', say('location.coordinates_label')), node('p', 'cf-body', `${fix.latitude.toFixed(5)}, ${fix.longitude.toFixed(5)}`),
      node('p', 'cf-small', say('location.time_label')), node('p', 'cf-body', new Date(fix.fixTime).toLocaleTimeString()),
    );
    const send = button(say('location.send')), retry = button(say('location.retry'), true);
    retry.onclick = () => { submitKey = crypto.randomUUID(); void locate(); };
    send.onclick = async () => {
      send.disabled = retry.disabled = true;
      send.textContent = say('sending.sending');
      try {
        await session.submitLocation(locationSubmission(fix), submitKey, abort.signal);
        if (!disposed) options.onSubmitted();
      } catch (cause) {
        if (disposed) return;
        if (cause instanceof CredflareError && cause.status === 422) submitKey = crypto.randomUUID();
        found(fix, cause instanceof CredflareError && cause.status !== 0 ? locationRejection(cause.code, settings) ?? livenessErrorMessage(cause) : say('errors.send_location_failed'));
      }
    };
    render(...header(), node('p', 'cf-hint', say('location.found_title')), node('p', 'cf-body', say('location.found_body')), card, ...(error ? [notice(error)] : []), send, retry);
  }

  consent();
  return () => { disposed = true; abort.abort(); element.replaceChildren(); element.classList.remove('cf-root'); };
}

export function mountReceipt(element: HTMLElement, info: SessionInfo, options: {received?: string[]; hostSteps?: boolean; onDone?: () => void} = {}): () => void {
  installStyles();
  element.classList.add('cf-root');
  const verifier = verifierName(info);
  const items = (options.received ?? []).map(label => {
    const card = node('div', 'cf-card');
    card.append(icon('received'), node('p', 'cf-body', label));
    return card;
  });
  const children: Node[] = [icon('received_illustration', 'cf-icon cf-illustration'), node('h2', 'cf-title', say('receipt.title')), node('p', 'cf-body', say('receipt.body', {verifier})), ...items];
  if (options.hostSteps) children.push(node('p', 'cf-body', say('receipt.host_steps')));
  if (options.onDone) {
    const done = button(say('receipt.done'));
    done.onclick = options.onDone;
    children.push(done);
  }
  element.replaceChildren(...children);
  return () => { element.replaceChildren(); element.classList.remove('cf-root'); };
}

export function mountRemainingSteps(element: HTMLElement, session: CredflareSession, options: {provider?: FaceSignalProvider<HTMLVideoElement>; received?: string[]; geolocation?: Geolocation; onDocuments?: (info: SessionInfo) => void; onDone?: () => void} = {}): () => void {
  let dispose: (() => void) | undefined, disposed = false;
  const received = [...(options.received ?? [])];
  const status = node('p', 'cf-body', say('intro.checking'));
  const advance = async () => {
    dispose?.(); dispose = undefined;
    installStyles();
    element.classList.add('cf-root');
    element.replaceChildren(status);
    let info: SessionInfo;
    try { info = await session.get(); } catch (error) {
      if (disposed) return;
      const retry = button(say('common.try_again'));
      retry.onclick = () => void advance();
      element.replaceChildren(notice(livenessErrorMessage(error, say('errors.refresh_failed'))), retry);
      return;
    }
    if (disposed) return;
    const step = nextStep(info);
    if (step === 'documents') return options.onDocuments?.(info);
    if (step === 'facial_verification') {
      dispose = mountLiveness(element, session, info, {provider: options.provider, onSubmitted: () => { received.push(say('receipt.selfie')); void advance(); }});
      return;
    }
    if (step === 'location_verification') {
      dispose = mountLocation(element, session, info, {geolocation: options.geolocation, onSubmitted: () => { received.push(say('receipt.location')); void advance(); }});
      return;
    }
    dispose = mountReceipt(element, info, {received, hostSteps: step === 'host', onDone: options.onDone});
  };
  void advance();
  return () => { disposed = true; dispose?.(); element.replaceChildren(); };
}

