import {CredflareSession, CredflareError} from './index.js';
import type {LivenessChallenge, SessionDescriptor, SessionInfo} from './index.js';
import {earlierAnswers, nextStep, receiptKey} from './workflow.js';
import type {FlowStep} from './workflow.js';
import {rejectionScreen} from './rejections.js';
import type {RejectionScreen} from './rejections.js';
import {answerFor, answerProblems, answersPayload, hasAnswer, isSupportedQuestion, startingAnswers, visibleQuestions} from './questions.js';
import type {Answers, Question} from './questions.js';
import {codeDestinationProblem, normalizePhone, secondsUntil} from './codes.js';
import {qrSvg} from './qr.js';
import {refreshFailureOutcome, refreshOutcome} from './workflow.js';
import type {CodeChannel, CodeRequest} from './index.js';
import {text, verifierName} from './copy.js';
import type {CopyValues} from './copy.js';
import {facialSettings, locationSettings} from './settings.js';
import {createChallengeRun} from './engine.js';
import type {FaceProviderName, FaceSample} from './engine.js';
import type {FaceSignalProvider} from './faces.js';
import {acquireFix, LocationError, locationCopy, locationErrorKey, locationSubmission} from './location.js';
import type {LocationFix} from './location.js';
import {livenessErrorMessage, sendLivenessEvidence} from './liveness.js';
import type {GestureEvidence, LivenessEvidence} from './liveness.js';
import {iconSvgs, liveness as livenessSpec, location as locationSpec, requirements, tokens} from './spec.generated.js';
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
.cf-root .cf-root{padding:0}
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
.cf-field{display:flex;flex-direction:column;align-items:stretch;gap:${spacing.xs}px;border:0;margin:0;padding:0;text-align:${tokens.text_align}}
.cf-field legend{padding:0;margin:0 auto ${spacing.xs}px}
.cf-label{font-size:${type.body.size}px;line-height:${type.body.line_height}px;font-weight:${type.subtitle.weight}}
.cf-input{font:inherit;font-size:${type.body.size}px;min-height:${size.button_height}px;border:1px solid var(--cf-border);border-radius:${radius.md}px;background:var(--cf-surface);color:var(--cf-ink);padding:0 ${spacing.md}px;text-align:center;box-sizing:border-box;width:100%}
textarea.cf-input{min-height:${size.button_height * 2}px;padding:${spacing.sm}px ${spacing.md}px}
.cf-input[aria-invalid=true]{border-color:var(--cf-error)}
.cf-code{letter-spacing:.4em;font-size:${type.title.size}px}
.cf-choice{display:flex;align-items:center;justify-content:center;gap:${spacing.sm}px;min-height:${size.button_height}px;border:1px solid var(--cf-border);border-radius:${radius.md}px;padding:0 ${spacing.md}px;cursor:pointer}
.cf-choice input{width:20px;height:20px;accent-color:var(--cf-primary)}
.cf-field-error{font-size:${type.small.size}px;line-height:${type.small.line_height}px;color:var(--cf-error);margin:0}
.cf-root a{color:var(--cf-primary)}
.cf-qr{display:flex;justify-content:center}
.cf-qr svg{width:min(100%,240px);height:auto;border-radius:${radius.md}px}
.cf-link{font:inherit;font-size:${type.small.size}px;background:none;border:0;color:var(--cf-primary);text-decoration:underline;cursor:pointer;padding:${spacing.xs}px}
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

function helpParagraph(screen: RejectionScreen): HTMLElement {
  const line = node('p', 'cf-small');
  const at = screen.helpLink ? screen.helpLink.text ? screen.help.indexOf(screen.helpLink.text) : -1 : -1;
  if (!screen.helpLink || at < 0) { line.textContent = screen.help; return line; }
  const link = node('a', '', screen.helpLink.text);
  link.href = screen.helpLink.href;
  if (!screen.helpLink.href.startsWith('mailto:')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
  line.append(screen.help.slice(0, at), link, screen.help.slice(at + screen.helpLink.text.length));
  return line;
}

export function rejectionView(screen: RejectionScreen, onAction?: () => void, iconName: IconName = 'error'): Node[] {
  const box = node('div', 'cf-notice');
  box.setAttribute('role', 'alert');
  box.append(icon('error'), node('p', 'cf-body', screen.message));
  const children: Node[] = [icon(iconName)];
  if (screen.title) children.push(node('h2', 'cf-title', screen.title));
  children.push(box, node('p', 'cf-small', screen.requestedBy), helpParagraph(screen));
  if (onAction) {
    const action = button(screen.actionLabel);
    action.onclick = onAction;
    children.push(action);
  }
  return children;
}

function fieldId(prefix: string): string {
  return `cf-${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

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

export async function cameraPicker(stream: MediaStream, onChange: (deviceId: string) => void): Promise<HTMLSelectElement | null> {
  if (!navigator.mediaDevices?.enumerateDevices) return null;
  let cameras: MediaDeviceInfo[];
  try { cameras = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput' && device.deviceId); } catch { return null; }
  if (cameras.length < 2) return null;
  const current = stream.getVideoTracks()[0]?.getSettings().deviceId;
  const select = node('select', 'cf-input');
  select.setAttribute('aria-label', say('common.change'));
  cameras.forEach((camera, index) => {
    const option = node('option', '', camera.label || String(index + 1));
    option.value = camera.deviceId;
    option.selected = camera.deviceId === current;
    select.append(option);
  });
  select.onchange = () => onChange(select.value);
  return select;
}

export interface LivenessOptions {
  provider?: FaceSignalProvider<HTMLVideoElement>;
  onSubmitted: () => void;
  onSample?: (sample: FaceSample) => void;
  onClosed?: () => void;
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
  let cameraId: string | undefined, runs = 0;
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
    runs++;
    stopCamera();
    const retry = button(say('liveness.retry'));
    retry.onclick = () => void run();
    render(icon('selfie'), node('h2', 'cf-title', say('liveness.title')), notice(message), retry, node('p', 'cf-small', say('selfie.privacy', {verifier})));
  }

  async function run() {
    const current = ++runs;
    const stale = () => disposed || current !== runs;
    const fail = (message: string) => { if (!stale()) failed(message); };
    const status = node('p', 'cf-body', say('selfie.starting_camera'));
    status.setAttribute('role', 'status');
    render(icon('selfie'), node('h2', 'cf-title', say('liveness.title')), status);
    let challenge: LivenessChallenge;
    try {
      stopCamera();
      const size = {width: {ideal: 640}, height: {ideal: 480}};
      const opened = await navigator.mediaDevices.getUserMedia({audio: false, video: cameraId ? {deviceId: {exact: cameraId}, ...size} : {facingMode: 'user', ...size}});
      if (stale()) { opened.getTracks().forEach(track => track.stop()); return; }
      stream = opened;
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      return fail(say(name === 'NotAllowedError' ? 'errors.camera_denied_browser' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'errors.front_camera_required' : 'errors.camera_unavailable'));
    }
    try {
      challenge = await session.createLivenessChallenge(crypto.randomUUID(), abort.signal);
    } catch (error) {
      return fail(error instanceof CredflareError && error.status !== 0 ? livenessErrorMessage(error) : say('errors.challenge_failed'));
    }
    if (disposed) return stopCamera();
    if (stale()) return;
    const camera = node('div', 'cf-camera'), video = node('video'), oval = node('div', 'cf-oval'), rec = node('div', 'cf-rec', say('video.recording'));
    video.autoplay = true; video.muted = true; video.playsInline = true; video.srcObject = stream!;
    rec.hidden = true;
    camera.append(video, oval, rec);
    const hint = node('p', 'cf-hint', say('liveness.position.no_face'));
    hint.setAttribute('role', 'status'); hint.setAttribute('aria-live', 'polite');
    const progress = node('p', 'cf-small', '');
    const picker = await cameraPicker(stream!, id => { cameraId = id; void run(); });
    if (disposed) return stopCamera();
    if (stale()) return;
    render(node('h2', 'cf-title', say('liveness.title')), camera, ...(picker ? [picker] : []), hint, progress);
    try { await video.play(); } catch { return fail(say('errors.camera_unavailable')); }
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
    try { provider = options.provider ?? await defaultProvider(); } catch { return fail(say('errors.camera_unavailable')); }
    if (stale()) return;
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
      if (finished || stale()) return;
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
      const stop = await provider.start(video, onSample, () => { if (!finished && !stale()) { finished = true; failed(say('errors.generic')); } });
      if (stale()) return stop();
      stopProvider = stop;
    } catch {
      return fail(say('errors.camera_unavailable'));
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
        if (cause instanceof CredflareError && cause.status === 409 && options.onClosed) { URL.revokeObjectURL(url); stopCamera(); return options.onClosed(); }
        if (cause instanceof CredflareError && cause.status === 422) {
          URL.revokeObjectURL(url); evidence = undefined; stopCamera();
          return render(...rejectionView(rejectionScreen(cause, {requester: info.requester}), () => void run(), 'selfie'));
        }
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
  onClosed?: () => void;
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
  let disposed = false, submitKey = crypto.randomUUID(), payload: {key: string; fix: LocationFix; body: ReturnType<typeof locationSubmission>} | null = null;
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
        if (!payload || payload.key !== submitKey || payload.fix !== fix) payload = {key: submitKey, fix, body: locationSubmission(fix)};
        await session.submitLocation(payload.body, payload.key, abort.signal);
        if (!disposed) options.onSubmitted();
      } catch (cause) {
        if (disposed) return;
        if (cause instanceof CredflareError && cause.status === 409 && options.onClosed) return options.onClosed();
        if (cause instanceof CredflareError && cause.status === 422) {
          submitKey = crypto.randomUUID();
          return render(...rejectionView(rejectionScreen(cause, {requester: info.requester, location: settings}), () => void locate(), 'location'));
        }
        found(fix, cause instanceof CredflareError && cause.status !== 0 ? livenessErrorMessage(cause) : say('errors.send_location_failed'));
      }
    };
    render(...header(), node('p', 'cf-hint', say('location.found_title')), node('p', 'cf-body', say('location.found_body')), card, ...(error ? [notice(error)] : []), send, retry);
  }

  consent();
  return () => { disposed = true; abort.abort(); element.replaceChildren(); element.classList.remove('cf-root'); };
}

const countryCodes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');

function countryOptions(): Array<[string, string]> {
  let names: Intl.DisplayNames | null = null;
  try { names = new Intl.DisplayNames([document.documentElement.lang || navigator.language || 'en'], {type: 'region'}); } catch { names = null; }
  return countryCodes.map(code => [code, names?.of(code) ?? code] as [string, string]).sort((a, b) => a[1].localeCompare(b[1]));
}

export interface QuestionsOptions {
  onSubmitted: (fields: Answers) => void;
  earlier?: Answers;
  onUnsupported?: (answers: Answers) => void;
  onClosed?: () => void;
}

export function mountQuestions(element: HTMLElement, session: CredflareSession, info: SessionInfo, options: QuestionsOptions): () => void {
  installStyles();
  element.classList.add('cf-root');
  const schema: Question[] = info.profile?.form_schema ?? [];
  const verifier = verifierName(info);
  const abort = new AbortController();
  const earlier = earlierAnswers(info, options.earlier);
  const answers: Answers = startingAnswers(schema, earlier);
  let disposed = false, submitKey = crypto.randomUUID(), shownErrors: Record<string, string> = {}, sending = false;
  const errorFor = (key: string) => (hasAnswer(shownErrors, key) ? shownErrors[key] : undefined);
  const form = node('form');
  form.noValidate = true;
  const fields = node('fieldset');
  fields.style.cssText = `display:flex;flex-direction:column;gap:${tokens.spacing.xl}px;border:0;margin:0;padding:0;min-width:0`;
  const status = node('p', 'cf-small', '');
  status.setAttribute('role', 'status');
  const send = button(say('questions.send'));
  send.type = 'submit';
  const formError = node('div');
  form.append(fields, formError, status, send);
  const controls = new Map<string, HTMLElement>();

  const changed = (key: string, value: unknown) => {
    if (value === undefined) delete answers[key]; else answers[key] = value;
    delete shownErrors[key];
    submitKey = crypto.randomUUID();
    draw();
  };

  function founders(question: Question, id: string, value: unknown): HTMLElement {
    const current = value && typeof value === 'object' && !Array.isArray(value) ? value as {includes_applicant?: unknown; names?: unknown} : {};
    const includes = current.includes_applicant === true;
    const names = Array.isArray(current.names) ? current.names.map(name => typeof name === 'string' ? name : '') : [];
    const update = (next: {includes_applicant: boolean; names: string[]}) => changed(question.key, next.includes_applicant || next.names.length ? next : undefined);
    const group = node('div');
    group.id = id;
    group.style.cssText = `display:flex;flex-direction:column;gap:${tokens.spacing.sm}px`;
    const me = node('label', 'cf-choice');
    const toggle = node('input');
    toggle.type = 'checkbox'; toggle.id = `${id}-me`; toggle.checked = includes;
    toggle.onchange = () => update({includes_applicant: toggle.checked, names});
    me.append(toggle, node('span', 'cf-body', say('questions.founders_includes_me')));
    group.append(me);
    names.forEach((name, index) => {
      const row = node('div');
      row.style.cssText = `display:flex;flex-direction:column;gap:${tokens.spacing.xxs}px`;
      const input = node('input', 'cf-input');
      input.type = 'text'; input.id = `${id}-name-${index}`; input.value = name; input.autocomplete = 'name';
      input.setAttribute('aria-label', say('questions.founders_name'));
      input.oninput = () => {
        const next = names.slice(); next[index] = input.value;
        answers[question.key] = {includes_applicant: includes, names: next};
        submitKey = crypto.randomUUID();
      };
      input.onchange = () => { const next = names.slice(); next[index] = input.value; update({includes_applicant: includes, names: next}); };
      const remove = node('button', 'cf-link', say('questions.founders_remove'));
      remove.type = 'button'; remove.id = `${id}-remove-${index}`;
      remove.onclick = () => update({includes_applicant: includes, names: names.filter((_, at) => at !== index)});
      row.append(input, remove);
      group.append(row);
    });
    const add = button(say('questions.founders_add'), true);
    add.id = `${id}-add`;
    add.onclick = () => { update({includes_applicant: includes, names: [...names, '']}); document.getElementById(`${id}-name-${names.length}`)?.focus(); };
    group.append(add);
    return group;
  }

  function control(question: Question, id: string, error: string | undefined): HTMLElement {
    const value = answerFor(answers, question.key);
    if (question.type === 'founders') return founders(question, id, value);
    const invalid = (input: HTMLElement) => { if (error) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', `${id}-error`); } };
    if (question.type === 'consent') {
      const label = node('label', 'cf-choice');
      const input = node('input');
      input.type = 'checkbox'; input.id = id; input.checked = value === true;
      input.onchange = () => changed(question.key, input.checked);
      invalid(input);
      label.append(input, node('span', 'cf-body', question.label));
      return label;
    }
    if (question.type === 'multi_select') {
      const group = node('div');
      group.style.cssText = `display:flex;flex-direction:column;gap:${tokens.spacing.sm}px`;
      const selected = Array.isArray(value) ? value.map(String) : [];
      for (const option of (question.options ?? []).map(String)) {
        const label = node('label', 'cf-choice');
        const input = node('input');
        input.type = 'checkbox'; input.name = id; input.checked = selected.includes(option);
        input.onchange = () => {
          const next = (question.options ?? []).map(String).filter(item => item === option ? input.checked : selected.includes(item));
          changed(question.key, next.length ? next : undefined);
        };
        label.append(input, node('span', 'cf-body', option));
        group.append(label);
      }
      return group;
    }
    if (question.type === 'select' || question.type === 'single_select' || question.type === 'country') {
      const select = node('select', 'cf-input');
      select.id = id;
      const empty = node('option', '', say(question.type === 'country' ? 'questions.choose_country' : 'questions.choose_one'));
      empty.value = '';
      select.append(empty);
      const choices: Array<[string, string]> = question.type === 'country' ? countryOptions() : (question.options ?? []).map(option => [String(option), String(option)]);
      for (const [optionValue, label] of choices) {
        const option = node('option', '', label);
        option.value = optionValue;
        option.selected = value === optionValue;
        select.append(option);
      }
      select.onchange = () => changed(question.key, select.value || undefined);
      invalid(select);
      return select;
    }
    const input = question.type === 'textarea' ? node('textarea', 'cf-input') : node('input', 'cf-input');
    input.id = id;
    if (input instanceof HTMLInputElement) {
      input.type = question.type === 'email' ? 'email' : question.type === 'date' ? 'date' : question.type === 'phone' || question.type === 'tel' ? 'tel' : 'text';
      if (question.type === 'number') input.inputMode = 'decimal';
      if (question.type === 'email') input.autocomplete = 'email';
      if (question.type === 'phone' || question.type === 'tel') input.autocomplete = 'tel';
    }
    input.value = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    input.oninput = () => {
      if (input.value === '') delete answers[question.key]; else answers[question.key] = input.value;
      submitKey = crypto.randomUUID();
    };
    input.onchange = () => changed(question.key, input.value === '' ? undefined : input.value);
    invalid(input);
    return input;
  }

  function draw() {
    if (disposed) return;
    const focused = document.activeElement?.id;
    const shown = visibleQuestions(schema, answers, earlier);
    if (!shown.every(isSupportedQuestion)) {
      if (options.onUnsupported) return options.onUnsupported({...answers});
      disposed = true; abort.abort();
      mountReceipt(element, info, {hostSteps: true});
      return;
    }
    const children: Node[] = [];
    for (const question of shown) {
      const id = controls.get(question.key)?.id ?? fieldId(question.key);
      const error = errorFor(question.key);
      const grouped = question.type === 'multi_select' || question.type === 'founders';
      const field = node(grouped ? 'fieldset' : 'div', 'cf-field');
      const title = grouped ? node('legend', 'cf-label', question.label) : question.type === 'consent' ? null : node('label', 'cf-label', question.label);
      if (title instanceof HTMLLabelElement) title.htmlFor = id;
      if (title) field.append(title);
      if (!question.required && question.type !== 'consent') field.append(node('p', 'cf-small', say('questions.optional')));
      if (question.type === 'multi_select') field.append(node('p', 'cf-small', say('questions.choose_many')));
      const input = control(question, id, error);
      if (!input.id) input.id = id;
      controls.set(question.key, input);
      field.append(input);
      if (error) { const line = node('p', 'cf-field-error', error); line.id = `${id}-error`; field.append(line); }
      children.push(field);
    }
    fields.replaceChildren(...children);
    if (focused) document.getElementById(focused)?.focus();
  }

  form.onsubmit = async event => {
    event.preventDefault();
    if (sending) return;
    formError.replaceChildren();
    const problems = answerProblems(schema, answers, earlier);
    shownErrors = Object.fromEntries(Object.entries(problems).map(([key, problem]) => [key, say(problem.key, problem.values)]));
    draw();
    const first = Object.keys(problems)[0];
    if (first) { controls.get(first)?.querySelector?.('input')?.focus(); controls.get(first)?.focus(); return; }
    sending = true; send.disabled = fields.disabled = true; status.textContent = say('questions.sending');
    try {
      const fields = answersPayload(schema, answers, earlier);
      await session.submitAnswers(fields, submitKey, abort.signal);
      if (!disposed) options.onSubmitted(fields);
    } catch (cause) {
      if (disposed) return;
      sending = false; send.disabled = fields.disabled = false; status.textContent = '';
      if (cause instanceof CredflareError && cause.status === 409 && options.onClosed) return options.onClosed();
      if (cause instanceof CredflareError && cause.status === 422) {
        submitKey = crypto.randomUUID();
        const errors = cause.errors && typeof cause.errors === 'object' && !Array.isArray(cause.errors) ? cause.errors as Record<string, unknown> : {};
        const fieldErrors = Object.entries(errors).filter(([path]) => path.startsWith('fields.')).map(([path, messages]) => [path.slice(7), Array.isArray(messages) ? String(messages[0]) : String(messages)] as [string, string]);
        if (!cause.code && fieldErrors.length) { shownErrors = Object.fromEntries(fieldErrors); draw(); return; }
        return render(...rejectionView(rejectionScreen(cause, {requester: info.requester}), () => { render(...page()); draw(); }, 'document'));
      }
      formError.replaceChildren(notice(cause instanceof CredflareError && cause.status !== 0 ? livenessErrorMessage(cause) : say('errors.send_answers_failed')));
    }
  };

  const render = (...children: Node[]) => { if (!disposed) element.replaceChildren(...children); };
  const page = () => [icon('document'), node('h2', 'cf-title', say('questions.title')), node('p', 'cf-body', say('questions.body', {verifier})), form];
  render(...page());
  draw();
  return () => { disposed = true; abort.abort(); element.replaceChildren(); element.classList.remove('cf-root'); };
}

export interface ContactCodeOptions {
  channel: CodeChannel;
  onSubmitted: () => void;
  onLeave?: (code: string | null) => void;
  onHostActionRequired?: (details: HostActionDetails) => void;
  onClosed?: () => void;
}

interface PendingCode {
  destination: string;
  typed: string | null;
  sends_remaining: number | null;
  expires_at: string | null;
}

export interface HostActionDetails {
  code: string | null;
}

const onLeaveScreen = new WeakMap<HTMLElement, () => void>();

function hostAction(element: HTMLElement, code: string | null, handler?: (details: HostActionDetails) => void): void {
  handler?.({code});
  element.dispatchEvent(new CustomEvent<HostActionDetails>('credflare:host-action-required', {bubbles: true, detail: {code}}));
}

export function mountContactCode(element: HTMLElement, session: CredflareSession, info: SessionInfo, options: ContactCodeOptions): () => void {
  installStyles();
  element.classList.add('cf-root');
  const {channel} = options;
  const rules = requirements.contact_codes;
  const verifier = verifierName(info);
  const abort = new AbortController();
  let disposed = false, destination = '', last: PendingCode | null = null, resendAt: string | null = null, timer: ReturnType<typeof setInterval> | undefined, turn = 0;
  const render = (...children: Node[]) => { if (disposed) return; if (timer) clearInterval(timer); timer = undefined; turn++; element.replaceChildren(...children); };
  const header = () => [node('h2', 'cf-title', say(channel === 'email' ? 'email.title' : 'phone.title'))];
  const typed = () => (channel === 'phone' ? normalizePhone(destination) : destination);

  function enter(error?: string) {
    const id = fieldId(channel);
    const field = node('div', 'cf-field');
    const label = node('label', 'cf-label', say(channel === 'email' ? 'email.label' : 'phone.label'));
    label.htmlFor = id;
    const input = node('input', 'cf-input');
    input.id = id;
    input.type = channel === 'email' ? 'email' : 'tel';
    input.autocomplete = channel === 'email' ? 'email' : 'tel';
    input.maxLength = channel === 'email' ? rules.email_max_length : rules.phone_max_length;
    input.value = destination;
    if (channel === 'email') input.placeholder = say('email.placeholder');
    field.append(label, input);
    if (channel === 'phone') field.append(node('p', 'cf-small', say('phone.hint')));
    if (error) {
      const line = node('p', 'cf-field-error', error);
      line.id = `${id}-error`;
      input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', line.id);
      field.append(line);
    }
    const form = node('form');
    form.noValidate = true;
    form.style.cssText = `display:flex;flex-direction:column;gap:${tokens.spacing.gap}px`;
    const submit = button(say(channel === 'email' ? 'email.send' : 'phone.send'));
    submit.type = 'submit';
    form.append(field, submit);
    form.onsubmit = event => {
      event.preventDefault();
      destination = input.value.trim();
      const problem = codeDestinationProblem(channel, destination);
      if (problem) return enter(say(problem));
      void send('enter');
    };
    render(...header(), node('p', 'cf-body', say(channel === 'email' ? 'email.body' : 'phone.body', {verifier})), form);
    if (error) input.focus();
  }

  async function send(from: 'enter' | 'code') {
    const status = node('p', 'cf-body', say('contact_code.sending'));
    status.setAttribute('role', 'status');
    render(...header(), status);
    const mine = turn;
    try {
      const sent: CodeRequest = await session.requestCode(channel, typed(), abort.signal);
      if (disposed || mine !== turn) return;
      last = {destination: sent.destination, typed: destination, sends_remaining: sent.sends_remaining, expires_at: sent.expires_at};
      resendAt = sent.resend_available_at;
      code();
    } catch (cause) {
      if (!disposed && mine === turn) failed(cause, from, 'errors.send_code_failed');
    }
  }

  function code(error?: string, note?: string) {
    if (!last) return enter();
    const pending = last;
    const id = fieldId('code');
    const field = node('div', 'cf-field');
    const label = node('label', 'cf-label', say('contact_code.label'));
    label.htmlFor = id;
    const input = node('input', 'cf-input cf-code');
    input.id = id; input.inputMode = 'numeric'; input.autocomplete = 'one-time-code'; input.maxLength = rules.code_length; input.pattern = `[0-9]{${rules.code_length}}`;
    field.append(label, input);
    const confirm = button(say('contact_code.confirm'));
    confirm.type = 'submit';
    confirm.disabled = true;
    let confirming = false;
    input.oninput = () => {
      input.value = input.value.replace(/\D/g, '').slice(0, rules.code_length);
      confirm.disabled = input.value.length !== rules.code_length;
    };
    const form = node('form');
    form.noValidate = true;
    form.style.cssText = `display:flex;flex-direction:column;gap:${tokens.spacing.gap}px`;
    form.append(field, ...(error ? [notice(error)] : []), ...(note ? [node('p', 'cf-small', note)] : []), confirm);
    const countdown = node('p', 'cf-small', '');
    countdown.setAttribute('aria-live', 'polite');
    const resend = button(say('contact_code.resend'), true);
    const remaining = pending.sends_remaining;
    const change = node('button', 'cf-link', say(channel === 'email' ? 'email.change' : 'phone.change'));
    change.type = 'button';
    const tick = () => {
      const seconds = secondsUntil(resendAt);
      resend.disabled = confirming || seconds > 0;
      countdown.textContent = seconds > 0 ? say('contact_code.resend_in', {seconds}) : '';
      if (seconds === 0 && timer) { clearInterval(timer); timer = undefined; }
    };
    form.onsubmit = async event => {
      event.preventDefault();
      if (confirming || input.value.length !== rules.code_length) return;
      const value = input.value;
      const mine = turn;
      confirming = true;
      confirm.disabled = input.disabled = resend.disabled = change.disabled = true;
      confirm.textContent = say('contact_code.confirming');
      try {
        await session.confirmCode(channel, value, abort.signal);
        if (!disposed && mine === turn) options.onSubmitted();
      } catch (cause) {
        if (!disposed && mine === turn) failed(cause, 'code', 'errors.confirm_code_failed');
      }
    };
    resend.onclick = () => { if (!confirming) void send('code'); };
    change.onclick = () => { if (!confirming) enter(); };
    const canResend = remaining === null || remaining > 0;
    const extras: Node[] = canResend ? [resend, countdown, ...(remaining === null ? [] : [node('p', 'cf-small', say('contact_code.sends_remaining', {count: remaining}))])] : [];
    const minutes = pending.expires_at ? Math.max(1, Math.ceil(secondsUntil(pending.expires_at) / 60)) : rules.ttl_minutes;
    render(node('h2', 'cf-title', say('contact_code.title')), node('p', 'cf-body', say('contact_code.body', {destination: pending.destination, minutes})), form, ...extras, change);
    if (canResend) { tick(); if (secondsUntil(resendAt) > 0) timer = setInterval(tick, 1000); }
    input.focus();
  }

  function leave(code: string | null) {
    if (options.onLeave) return options.onLeave(code);
    disposed = true; abort.abort();
    mountReceipt(element, info, {hostSteps: true});
    hostAction(element, code, options.onHostActionRequired);
  }

  function failed(cause: unknown, from: 'enter' | 'code', fallback: CopyKey) {
    if (cause instanceof CredflareError && cause.status === 409 && options.onClosed) return options.onClosed();
    if (!(cause instanceof CredflareError) || cause.status !== 422) {
      const message = cause instanceof CredflareError && cause.status !== 0 ? livenessErrorMessage(cause) : say(fallback);
      return from === 'code' && last ? code(message) : enter(message);
    }
    const screen = rejectionScreen(cause, {requester: info.requester});
    const back = () => (from === 'code' && last ? code() : enter());
    const actions: Record<RejectionScreen['action'], () => void> = {
      retry: back,
      restart: back,
      reenter_code: () => (last ? code() : enter()),
      new_code: () => void send(from),
      wait: () => {
        const {details} = cause;
        const after = typeof details.resend_available_at === 'string' ? details.resend_available_at : null;
        resendAt = after ?? resendAt ?? new Date(Date.now() + rules.resend_seconds * 1000).toISOString();
        const waiting = typeof details.destination === 'string' && details.destination ? details.destination : null;
        if (waiting) {
          const typed = last && last.destination === waiting ? last.typed : null;
          last = {
            destination: waiting, typed,
            sends_remaining: typeof details.sends_remaining === 'number' ? details.sends_remaining : null,
            expires_at: typeof details.expires_at === 'string' ? details.expires_at : null,
          };
        } else if (!last) last = {destination, typed: destination, sends_remaining: null, expires_at: null};
        const elsewhere = last.typed !== destination;
        if (last.typed !== null) destination = last.typed;
        code(screen.message, elsewhere ? say(channel === 'email' ? 'email.change_after' : 'phone.change_after') : undefined);
      },
      leave: () => leave(screen.code),
    };
    if (screen.action === 'wait') return actions.wait();
    render(...rejectionView(screen, actions[screen.action]));
    if (screen.action === 'leave') onLeaveScreen.get(element)?.();
  }

  enter();
  return () => { disposed = true; abort.abort(); if (timer) clearInterval(timer); element.replaceChildren(); element.classList.remove('cf-root'); };
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

export interface HandoffOptions {
  onBack: () => void;
  onFinished: (info: SessionInfo | null) => void;
  pollMs?: number;
}

export function mountHandoff(element: HTMLElement, session: CredflareSession, options: HandoffOptions): () => void {
  installStyles();
  element.classList.add('cf-root');
  const abort = new AbortController();
  let disposed = false, timer: ReturnType<typeof setInterval> | undefined, poll: ReturnType<typeof setInterval> | undefined;
  const stop = () => { if (timer) clearInterval(timer); timer = undefined; };
  const render = (...children: Node[]) => { if (!disposed) element.replaceChildren(...children); };
  const back = () => { const control = button(say('common.back'), true); control.onclick = options.onBack; return control; };
  const title = () => node('h2', 'cf-title', say('handoff.title'));

  async function create() {
    stop();
    const status = node('p', 'cf-body', say('common.loading'));
    status.setAttribute('role', 'status');
    render(title(), status);
    try {
      const link = await session.createHandoff(abort.signal);
      if (!disposed) show(link.handoff_url, link.expires_at);
    } catch (cause) {
      if (disposed) return;
      const retry = button(say('common.try_again'));
      retry.onclick = () => void create();
      render(title(), notice(cause instanceof CredflareError && cause.status !== 0 ? livenessErrorMessage(cause) : say('errors.network')), retry, back());
    }
  }

  function show(url: string, expiresAt: string) {
    const code = node('div', 'cf-qr');
    code.innerHTML = qrSvg(url);
    code.querySelector('svg')?.setAttribute('aria-label', say('handoff.title'));
    const body = node('p', 'cf-body', '');
    const update = () => {
      const seconds = secondsUntil(expiresAt);
      if (seconds > 0) { body.textContent = say('handoff.body', {minutes: Math.max(1, Math.ceil(seconds / 60))}); return; }
      stop();
      const again = button(say('handoff.new_code'));
      again.onclick = () => void create();
      render(title(), node('p', 'cf-body', say('handoff.expired')), again, back());
    };
    render(title(), code, body, back());
    update();
    if (secondsUntil(expiresAt) > 0) timer = setInterval(update, 1000);
  }

  let finished = false;
  const finish = (info: SessionInfo | null) => {
    if (disposed || finished) return;
    finished = true;
    if (poll) clearInterval(poll);
    options.onFinished(info);
  };
  poll = setInterval(() => {
    session.get(abort.signal).then(info => { if (refreshOutcome(info) === 'receipt') finish(info); }, error => { if (refreshFailureOutcome(error) === 'receipt') finish(null); });
  }, options.pollMs ?? 5000);
  void create();
  return () => { disposed = true; abort.abort(); stop(); if (poll) clearInterval(poll); element.replaceChildren(); element.classList.remove('cf-root'); };
}

export interface RemainingStepsOptions {
  provider?: FaceSignalProvider<HTMLVideoElement>;
  received?: string[];
  geolocation?: Geolocation;
  onDocuments?: (info: SessionInfo) => void;
  onDone?: () => void;
  onLeave?: (code: string | null) => void;
  onHostActionRequired?: (details: HostActionDetails) => void;
  handoff?: boolean;
  info?: SessionInfo;
}

export function mountRemainingSteps(element: HTMLElement, session: CredflareSession, options: RemainingStepsOptions = {}): () => void {
  let dispose: (() => void) | undefined, disposed = false;
  const received = [...(options.received ?? [])];
  const status = node('p', 'cf-body', say('intro.checking'));
  status.setAttribute('role', 'status');
  const answered: Answers = {};
  let unsent: Answers = {};
  const closed = () => void advance(null);
  const hostReceipt = (info: SessionInfo, code: string | null) => {
    dispose?.();
    dispose = mountReceipt(element, info, {received, hostSteps: true, onDone: options.onDone});
    hostAction(element, code, options.onHostActionRequired);
  };
  const submitted = (step: FlowStep) => () => {
    const key = receiptKey(step);
    if (key) received.push(say(key));
    void advance();
  };
  let last: SessionInfo | undefined;
  const advance = async (known?: SessionInfo | null) => {
    dispose?.(); dispose = undefined;
    installStyles();
    element.classList.add('cf-root');
    element.replaceChildren(status);
    if (known === null && last) {
      dispose = mountReceipt(element, last, {received, onDone: options.onDone});
      return;
    }
    let info: SessionInfo;
    try { info = last = known ?? await session.get(); } catch (error) {
      if (disposed) return;
      if (last && refreshFailureOutcome(error) === 'receipt') {
        dispose = mountReceipt(element, last, {received, onDone: options.onDone});
        return;
      }
      const retry = button(say('common.try_again'));
      retry.onclick = () => void advance();
      element.replaceChildren(notice(say('errors.refresh_failed')), retry);
      return;
    }
    if (disposed) return;
    const step = nextStep(info, {...earlierAnswers(info, answered), ...unsent});
    if (step === 'documents') return options.onDocuments?.(info);
    if (options.handoff && step !== 'done' && step !== 'host') {
      const inner = node('div');
      const offer = button(say('handoff.action'), true);
      offer.onclick = () => {
        dispose?.();
        dispose = mountHandoff(element, session, {onBack: () => void advance(), onFinished: finished => void advance(finished)});
      };
      onLeaveScreen.set(inner, () => offer.remove());
      element.replaceChildren(inner, offer);
      return mountStep(inner, step, info);
    }
    return mountStep(element, step, info);
  };
  const mountStep = (target: HTMLElement, step: FlowStep, info: SessionInfo) => {
    if (step === 'questions') {
      dispose = mountQuestions(target, session, info, {
        earlier: answered,
        onSubmitted: fields => { Object.assign(answered, fields); unsent = {}; submitted(step)(); },
        onUnsupported: answers => { unsent = answers; queueMicrotask(() => void advance(info)); },
        onClosed: closed,
      });
      return;
    }
    if (step === 'facial_verification') {
      dispose = mountLiveness(target, session, info, {provider: options.provider, onSubmitted: submitted(step), onClosed: closed});
      return;
    }
    if (step === 'location_verification') {
      dispose = mountLocation(target, session, info, {geolocation: options.geolocation, onSubmitted: submitted(step), onClosed: closed});
      return;
    }
    if (step === 'email_verification' || step === 'phone_verification') {
      const onLeave = (code: string | null) => { if (options.onLeave) options.onLeave(code); else hostReceipt(info, code); };
      dispose = mountContactCode(target, session, info, {channel: step === 'email_verification' ? 'email' : 'phone', onSubmitted: submitted(step), onLeave, onClosed: closed});
      return;
    }
    if (step === 'host') return hostReceipt(info, null);
    dispose = mountReceipt(target, info, {received, onDone: options.onDone});
  };
  void advance(options.info);
  return () => { disposed = true; dispose?.(); element.replaceChildren(); };
}
