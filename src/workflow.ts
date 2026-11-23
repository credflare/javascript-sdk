import type {SessionInfo} from './index.js';
import type {CopyKey} from './spec.generated.js';
import {requirements} from './spec.generated.js';
import {canAskQuestions} from './questions.js';
import type {Answers} from './questions.js';
import {CredflareError} from './index.js';

/** @deprecated Steps known before questions and contact codes ran in the SDK. Use {@link RemainingStep} with {@link remainingStep}. */
export type FlowStep = 'documents' | 'facial_verification' | 'location_verification' | 'host' | 'done';
export type RemainingStep = FlowStep | 'questions' | 'email_verification' | 'phone_verification';
const inSdk = ['facial_verification', 'location_verification', 'email_verification', 'phone_verification'];
const capture = ['facial_verification', 'location_verification'];

export function requiresFacial(info: SessionInfo): boolean {
  return info.profile?.verification_requirements.some(item => item.verification_type === 'facial_verification') ?? false;
}
export const requiresSelfie = requiresFacial;
export function requiresLocation(info: SessionInfo): boolean {
  return info.profile?.verification_requirements.some(item => item.verification_type === 'location_verification') ?? false;
}
export function earlierAnswers(info: SessionInfo | null | undefined, local: Answers = {}): Answers {
  const sent = info?.profile?.form_answers;
  return {...local, ...(sent && typeof sent === 'object' && !Array.isArray(sent) ? sent : {})};
}
export function needsHostSteps(info: SessionInfo, earlier: Answers = earlierAnswers(info)): boolean {
  return !info.profile || (!!info.profile.form_schema?.length && !canAskQuestions(info.profile.form_schema, earlier)) || info.profile.verification_requirements.some(item => !inSdk.includes(item.verification_type));
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
/** @deprecated Reports questions and contact codes as `host`. Use {@link remainingStep}. */
export function nextStep(info: SessionInfo, earlier: Answers = earlierAnswers(info)): FlowStep {
  if (!hasOutstanding(info)) return 'done';
  if (info.profile?.document_requirements.length) return 'documents';
  const capturing = info.profile?.verification_requirements.find(item => capture.includes(item.verification_type));
  if (capturing) return capturing.verification_type as FlowStep;
  return remainingStep(info, earlier) === 'done' ? 'done' : 'host';
}
export function remainingStep(info: SessionInfo, earlier: Answers = earlierAnswers(info)): RemainingStep {
  if (!hasOutstanding(info)) return 'done';
  if (info.profile?.form_schema?.length && canAskQuestions(info.profile.form_schema, earlier)) return 'questions';
  if (info.profile?.document_requirements.length) return 'documents';
  const next = info.profile?.verification_requirements.find(item => inSdk.includes(item.verification_type));
  if (next) return next.verification_type as RemainingStep;
  return needsHostSteps(info, earlier) ? 'host' : 'done';
}
export function receiptKey(step: RemainingStep): CopyKey | null {
  const keys: Partial<Record<RemainingStep, CopyKey>> = {
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
