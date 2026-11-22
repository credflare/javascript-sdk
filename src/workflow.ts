import type {SessionInfo} from './index.js';
import type {CopyKey} from './spec.generated.js';
import {requirements} from './spec.generated.js';
import {canAskQuestions} from './questions.js';
import {CredflareError} from './index.js';

export type FlowStep = 'questions' | 'documents' | 'facial_verification' | 'location_verification' | 'email_verification' | 'phone_verification' | 'host' | 'done';
const inSdk = ['facial_verification', 'location_verification', 'email_verification', 'phone_verification'];
const capture = ['facial_verification', 'location_verification'];

export function requiresFacial(info: SessionInfo): boolean {
  return info.profile?.verification_requirements.some(item => item.verification_type === 'facial_verification') ?? false;
}
export const requiresSelfie = requiresFacial;
export function requiresLocation(info: SessionInfo): boolean {
  return info.profile?.verification_requirements.some(item => item.verification_type === 'location_verification') ?? false;
}
export function needsHostSteps(info: SessionInfo): boolean {
  return !info.profile || (!!info.profile.form_schema?.length && !canAskQuestions(info.profile.form_schema)) || info.profile.verification_requirements.some(item => !inSdk.includes(item.verification_type));
}
export function hasOutstanding(info: SessionInfo): boolean {
  if (!(requirements.refresh.open_statuses as readonly string[]).includes(info.status)) return false;
  return requirements.refresh.outstanding.some(path => {
    const value = path.split('.').reduce<unknown>((node, segment) => node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined, info);
    return Array.isArray(value) && value.length > 0;
  });
}
export function refreshOutcome(info: SessionInfo): 'continue' | 'receipt' {
  return hasOutstanding(info) ? 'continue' : 'receipt';
}
export function refreshFailureOutcome(error: unknown): 'receipt' | 'refresh_failed' {
  return error instanceof CredflareError && error.status === 409 ? 'receipt' : 'refresh_failed';
}
export function nextStep(info: SessionInfo): FlowStep {
  if (!hasOutstanding(info)) return 'done';
  if (info.profile?.form_schema?.length && canAskQuestions(info.profile.form_schema)) return 'questions';
  if (info.profile?.document_requirements.length) return 'documents';
  const next = info.profile?.verification_requirements.find(item => inSdk.includes(item.verification_type));
  if (next) return next.verification_type as FlowStep;
  return needsHostSteps(info) ? 'host' : 'done';
}
export function receiptKey(step: FlowStep): CopyKey | null {
  const keys: Partial<Record<FlowStep, CopyKey>> = {
    questions: 'receipt.answers',
    facial_verification: 'receipt.selfie',
    location_verification: 'receipt.location',
    email_verification: 'receipt.email',
    phone_verification: 'receipt.phone',
  };
  return keys[step] ?? null;
}
export function documentsNextKey(info: SessionInfo): CopyKey | null {
  const types = (info.profile?.verification_requirements ?? []).map(item => item.verification_type);
  const order = types.filter((type, index, all) => capture.includes(type) && all.indexOf(type) === index).join(',');
  const keys: Record<string, CopyKey> = {
    facial_verification: 'documents.selfie_next',
    location_verification: 'documents.location_next',
    'facial_verification,location_verification': 'documents.selfie_location_next',
    'location_verification,facial_verification': 'documents.location_selfie_next',
  };
  if (keys[order] && types.every(type => capture.includes(type))) return keys[order];
  return types.length || needsHostSteps(info) ? 'documents.host_steps_next' : null;
}
export function selfieFileTypes(info: SessionInfo): string[] {
  return info.upload_limits.allowed_file_types.filter(type => ['jpg', 'png', 'webp'].includes(type));
}
