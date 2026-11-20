export interface SessionDescriptor {
  session_id: string;
  token: string;
  api_base_url: string;
  expires_at: string;
}
export interface DocumentRequirement {
  document_type: { id: number; name: string; two_sided: boolean; capture_method: string };
  capture_method?: 'upload' | 'either' | 'snapshot' | 'snapshot_and_upload' | 'camera_only';
  requested_sides?: Array<'front' | 'back'>;
  group_key: string | null;
  rule: 'all_of' | 'any_of';
  min_required?: number | null;
  remaining_required?: number | null;
}
export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'select' | 'textarea' | 'tel' | 'founders';
  required: boolean;
  options?: unknown[] | null;
}
export interface SessionInfo {
  session_id: string;
  expires_at: string;
  status: string;
  environment: 'sandbox' | 'live';
  custom_message: string | null;
  requester: { name: string; logo_url: string | null } | null;
  brand: Record<string, unknown> | null;
  upload_limits: { max_file_size_bytes: number; allowed_file_types: string[]; max_uploads_per_requirement: number };
  profile: { name: string | null; form_schema: FormField[] | null; document_requirements: DocumentRequirement[]; verification_requirements: Array<{ verification_type: string }> } | null;
  capabilities: { trusted_camera: boolean; liveness: boolean; deepfake_detection: boolean };
}
export interface UploadedEvidence {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
}
export type Submission =
  | { type: 'document_verification'; document_type_id: number; file_id: number; back_file_id?: number }
  | { type: 'document_verification'; document_type_id: number; evidence: Array<{file_id:number;side:'front'|'back';source:'camera'|'upload'}> }
  | { type: 'facial_verification'; image_file_id: number }
  | { type: 'location_verification'; latitude: number; longitude: number }
  | { type: 'form_submission'; fields: Record<string, unknown> };
export type Fetch = typeof globalThis.fetch;
export type CredflareErrorType = 'network' | 'session_unavailable' | 'verification_closed' | 'validation' | 'api';
export class CredflareError extends Error {
  get type(): CredflareErrorType {
    return this.status === 0 ? 'network' : this.status === 401 ? 'session_unavailable' : this.status === 409 ? 'verification_closed' : this.status === 422 ? 'validation' : 'api';
  }
  constructor(message: string, public readonly status: number, public readonly errors: unknown = []) {
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
    throw new CredflareError(message, response.status, 'errors' in body ? body.errors : []);
  }
  if (!('data' in body)) throw new CredflareError('Credflare returned an invalid response.', response.status);
  return body.data as T;
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
  private call<T>(method: string, suffix = '', body?: BodyInit, key?: string, signal?: AbortSignal): Promise<T> {
    if (method === 'POST' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key ?? '')) throw new Error('A UUID request key is required for uploads and submissions.');
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
  cancel(signal?: AbortSignal): Promise<null> { return this.call('DELETE', '', undefined, undefined, signal); }
}

export {captureSteps, capturePolicy, isCaptureSupported, methodSummary} from './capture.js';
export type {CaptureSource, CaptureStep, CapturePolicy} from './capture.js';

export {requiresSelfie, needsHostSteps, selfieFileTypes} from './workflow.js';
