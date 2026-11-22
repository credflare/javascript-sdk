import type {ErrorCode} from './spec.generated.js';
import type {requirements} from './spec.generated.js';
import type {Question} from './questions.js';
import type { GestureName } from './spec.generated.js';
import type { FaceProviderName } from './engine.js';
import type { VerificationRequirement } from './settings.js';
export interface SessionDescriptor {
  session_id: string;
  token: string;
  api_base_url: string;
  expires_at: string;
}
export interface DocumentRequirement {
  document_type: { id: number; name: string; two_sided: boolean; capture_method: string };
  capture_method?: 'upload' | 'snapshot' | 'snapshot_or_upload' | 'snapshot_and_upload' | 'either' | 'camera_only';
  requested_sides?: Array<'front' | 'back'>;
  group_key: string | null;
  rule: 'all_of' | 'any_of';
  min_required?: number | null;
  remaining_required?: number | null;
}
export type FormField = Question;
export type CodeChannel = keyof typeof requirements.contact_codes.channels;
export interface CodeRequest {
  channel: CodeChannel;
  destination: string;
  expires_at: string;
  resend_available_at: string;
  sends_remaining: number;
}
export interface Handoff {
  handoff_url: string;
  expires_at: string;
}
export interface CodeConfirmation {
  id: number;
  verified: boolean;
  email?: string;
  domain?: string;
  disposable?: boolean;
  phone?: string;
}
export interface SessionInfo {
  session_id: string;
  expires_at: string;
  status: string;
  environment: 'sandbox' | 'live';
  custom_message: string | null;
  requester: { name: string; logo_url: string | null; help_email?: string | null; help_url?: string | null } | null;
  brand: Record<string, unknown> | null;
  upload_limits: { max_file_size_bytes: number; allowed_file_types: string[]; max_uploads_per_requirement: number };
  profile: { name: string | null; form_schema: FormField[] | null; document_requirements: DocumentRequirement[]; verification_requirements: VerificationRequirement[] } | null;
  capabilities: { trusted_camera: boolean; liveness: boolean | 'challenge'; deepfake_detection: boolean };
}
export interface UploadedEvidence {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
}
export interface LivenessChallenge {
  challenge_id: string;
  gestures: GestureName[];
  expires_at: string;
  record_video: boolean;
  max_video_seconds: number;
}
export type BiometricUploadType = 'gesture' | 'liveness_video' | 'selfie';
export type UploadFile = Blob | { uri: string; name: string; type: string };
export interface BiometricUpload {
  type: BiometricUploadType;
  challengeId: string;
  gesture?: GestureName;
  file: UploadFile;
  filename?: string;
}
export interface FacialMetadata {
  provider: FaceProviderName;
  liveness_results: Array<{ challenge: GestureName; completed: boolean; timestamp: string }>;
  face_detection: { detected: boolean; face_count: number; is_centered: boolean; is_correct_size: boolean };
  captured_at: string;
}
export interface FacialSubmission {
  type: 'facial_verification';
  challenge_id: string;
  image_file_id: number;
  gesture_file_ids: number[];
  video_file_id?: number | null;
  metadata: FacialMetadata;
}
export interface LocationSubmission {
  type: 'location_verification';
  latitude: number;
  longitude: number;
  metadata: { accuracy: number | null; altitude: number | null; fix_time: string; is_mock: boolean | null; provider: 'gps' | 'network' | 'fused' | 'browser'; captured_at: string };
}
export type Submission =
  | { type: 'document_verification'; document_type_id: number; file_id: number; back_file_id?: number }
  | { type: 'document_verification'; document_type_id: number; evidence: Array<{file_id:number;side:'front'|'back';source:'camera'|'upload'}> }
  | FacialSubmission
  | LocationSubmission
  | { type: 'form_submission'; fields: Record<string, unknown> };
export type Fetch = typeof globalThis.fetch;
export type CredflareErrorType = 'network' | 'session_unavailable' | 'verification_closed' | 'validation' | 'api';
export class CredflareError extends Error {
  get type(): CredflareErrorType {
    return this.status === 0 ? 'network' : this.status === 401 ? 'session_unavailable' : this.status === 409 ? 'verification_closed' : this.status === 422 ? 'validation' : 'api';
  }
  constructor(message: string, public readonly status: number, public readonly errors: unknown = [], public readonly code: ErrorCode | (string & {}) | null = null, public readonly details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'CredflareError';
  }
}
export function apiBase(value: string): string {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) {
    throw new Error('Use an HTTPS API URL, or HTTP on localhost.');
  }
  return url.href.replace(/\/$/, '');
}
export async function request<T>(fetcher: Fetch, url: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(url, { ...init, credentials: 'omit', redirect: 'error' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new CredflareError('Could not reach Credflare.', 0);
  }
  let body: unknown;
  try { body = await response.json(); } catch {
    throw new CredflareError('Credflare returned an invalid response.', response.status);
  }
  if (!body || typeof body !== 'object' || !('success' in body)) {
    throw new CredflareError('Credflare returned an invalid response.', response.status);
  }
  if (!response.ok || body.success !== true) {
    const message = 'message' in body && typeof body.message === 'string' ? body.message : 'Request failed.';
    const code = 'code' in body && typeof body.code === 'string' ? body.code : null;
    const {success: _success, message: _message, errors, code: _code, ...details} = body as Record<string, unknown>;
    throw new CredflareError(message, response.status, errors ?? [], code, details);
  }
  if (!('data' in body)) throw new CredflareError('Credflare returned an invalid response.', response.status);
  return body.data as T;
}
function defaultFilename(input: BiometricUpload): string {
  const type = input.file instanceof Blob ? input.file.type : '';
  const extension = type === 'video/webm' ? 'webm' : type === 'video/mp4' ? 'mp4' : type === 'video/quicktime' ? 'mov' : type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  return `${input.type === 'gesture' ? input.gesture : input.type === 'liveness_video' ? 'liveness' : 'selfie'}.${extension}`;
}
export class CredflareSession {
  private readonly base: string;
  constructor(private session: SessionDescriptor, private readonly fetcher: Fetch = globalThis.fetch) {
    this.base = apiBase(session.api_base_url);
    if (!/^[0-9a-f-]{36}$/i.test(session.session_id) || !session.token) throw new Error('Invalid session descriptor.');
  }
  replaceSession(next: SessionDescriptor): void {
    if (apiBase(next.api_base_url) !== this.base || !/^[0-9a-f-]{36}$/i.test(next.session_id) || !next.token) throw new Error('Invalid replacement session.');
    this.session = next;
  }
  private call<T>(method: string, suffix = '', body?: BodyInit, key?: string, signal?: AbortSignal, keyed = method === 'POST'): Promise<T> {
    if (keyed && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key ?? '')) throw new Error('A UUID request key is required for uploads and submissions.');
    const headers: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${this.session.token}` };
    if (typeof body === 'string') headers['Content-Type'] = 'application/json';
    if (key) headers['X-Idempotency-Key'] = key;
    return request<T>(this.fetcher, `${this.base}/sdk/sessions/${this.session.session_id}${suffix}`, { method, headers, body, signal });
  }
  get(signal?: AbortSignal): Promise<SessionInfo> { return this.call('GET', '', undefined, undefined, signal); }
  upload(type: 'documents' | 'biometrics', form: FormData, key: string, signal?: AbortSignal): Promise<UploadedEvidence> {
    return this.call('POST', `/uploads/${type}`, form, key, signal);
  }
  submit(submission: Submission, key: string, signal?: AbortSignal): Promise<{ id: number }> {
    return this.call('POST', '/submit', JSON.stringify(submission), key, signal);
  }
  createLivenessChallenge(key: string, signal?: AbortSignal): Promise<LivenessChallenge> {
    return this.call('POST', '/liveness-challenges', undefined, key, signal);
  }
  uploadBiometric(input: BiometricUpload, key: string, signal?: AbortSignal): Promise<UploadedEvidence> {
    if (input.type === 'gesture' && !input.gesture) throw new Error('A gesture upload needs the gesture name.');
    const form = new FormData();
    form.append('type', input.type);
    form.append('challenge_id', input.challengeId);
    if (input.type === 'gesture') form.append('gesture', input.gesture!);
    form.append('capture_source', 'camera');
    if (typeof Blob !== 'undefined' && input.file instanceof Blob) form.append('file', input.file, input.filename ?? defaultFilename(input));
    else form.append('file', input.file as unknown as Blob);
    return this.upload('biometrics', form, key, signal);
  }
  submitFacial(submission: Omit<FacialSubmission, 'type'>, key: string, signal?: AbortSignal): Promise<{ id: number }> {
    return this.submit({ type: 'facial_verification', ...submission }, key, signal);
  }
  submitLocation(submission: Omit<LocationSubmission, 'type'>, key: string, signal?: AbortSignal): Promise<{ id: number }> {
    return this.submit({ type: 'location_verification', ...submission }, key, signal);
  }
  submitAnswers(fields: Record<string, unknown>, key: string, signal?: AbortSignal): Promise<{ id: number }> {
    return this.submit({ type: 'form_submission', fields }, key, signal);
  }
  requestCode(channel: CodeChannel, destination: string, signal?: AbortSignal): Promise<CodeRequest> {
    return this.call('POST', `/${channel}-codes`, JSON.stringify({ [channel]: destination }), undefined, signal, false);
  }
  confirmCode(channel: CodeChannel, code: string, signal?: AbortSignal): Promise<CodeConfirmation> {
    return this.call('POST', `/${channel}-codes/confirm`, JSON.stringify({ code }), undefined, signal, false);
  }
  createHandoff(signal?: AbortSignal): Promise<Handoff> {
    return this.call('POST', '/handoff', undefined, undefined, signal, false);
  }
  cancel(signal?: AbortSignal): Promise<null> { return this.call('DELETE', '', undefined, undefined, signal); }
}

export {captureSteps, capturePolicy, isCaptureSupported, methodSummary} from './capture.js';
export type {CaptureSource, CaptureStep, CapturePolicy} from './capture.js';

export {requiresSelfie, requiresFacial, requiresLocation, needsHostSteps, selfieFileTypes, nextStep, documentsNextKey, hasOutstanding, refreshOutcome, refreshFailureOutcome, receiptKey} from './workflow.js';
export type {FlowStep} from './workflow.js';
export * from './spec.generated.js';
export {text, verifierName} from './copy.js';
export type {CopyValues} from './copy.js';
export {facialSettings, locationSettings, parseFacialSettings, parseLocationSettings} from './settings.js';
export type {FacialSettings, LocationSettings, LocationReference, ReferencePlaceLabel, VerificationRequirement} from './settings.js';
export {createChallengeRun, createGestureRun, createPositionGate, gestureCopyKey, positionCopyKey, positionStatus, resolveThresholds, runTrace, testStep, defaultLiveness} from './engine.js';
export type {ChallengeStage, ChallengeUpdate, FaceBox, FaceProviderName, FaceSample, GestureResult, GestureStep, LivenessRules, LivenessTrace, PositionResult, PositionStatus} from './engine.js';
export {createReplayProvider} from './faces.js';
export type {FaceSignalProvider} from './faces.js';
export {acquireFix, fixProblem, locationCopy, locationErrorKey, locationRejection, locationSubmission, LocationError} from './location.js';
export type {LocationErrorCode, LocationFix, LocationProvider} from './location.js';
export {conditionHolds, isShown, showIfMatches, similarity} from './conditions.js';
export type {ShowIf, ShowIfCondition} from './conditions.js';
export {answerProblems, answersPayload, canAskQuestions, isEmptyAnswer, questionProblem, visibleQuestions} from './questions.js';
export type {Answers, Question, QuestionProblem} from './questions.js';
export {rejectionCopy, rejectionScreen} from './rejections.js';
export type {RejectionContext, RejectionScreen} from './rejections.js';
export {qrMatrix, qrSvg} from './qr.js';
export {codeDestinationProblem, normalizePhone, secondsUntil} from './codes.js';
export {challengeRejected, facialMetadata, livenessErrorMessage, sendLivenessEvidence} from './liveness.js';
export type {GestureEvidence, LivenessEvidence, PendingUpload} from './liveness.js';
