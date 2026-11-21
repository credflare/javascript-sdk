import type {SessionInfo} from './index.js';
import type {CopyKey} from './spec.generated.js';

export type FlowStep = 'documents' | 'facial_verification' | 'location_verification' | 'host' | 'done';
const inSdk = ['facial_verification', 'location_verification'];

export function requiresFacial(info: SessionInfo): boolean {
  return info.profile?.verification_requirements.some(item => item.verification_type === 'facial_verification') ?? false;
}
export const requiresSelfie = requiresFacial;
export function requiresLocation(info: SessionInfo): boolean {
  return info.profile?.verification_requirements.some(item => item.verification_type === 'location_verification') ?? false;
}
export function needsHostSteps(info: SessionInfo): boolean {
  return !info.profile || !!info.profile.form_schema?.length || info.profile.verification_requirements.some(item => !inSdk.includes(item.verification_type));
}
export function nextStep(info: SessionInfo): FlowStep {
  if (info.profile?.document_requirements.length) return 'documents';
  const next = info.profile?.verification_requirements.find(item => inSdk.includes(item.verification_type));
  if (next) return next.verification_type as FlowStep;
  return needsHostSteps(info) ? 'host' : 'done';
}
export function documentsNextKey(info: SessionInfo): CopyKey | null {
  const order = (info.profile?.verification_requirements ?? [])
    .map(item => item.verification_type)
    .filter((type, index, all) => inSdk.includes(type) && all.indexOf(type) === index)
    .join(',');
  const keys: Record<string, CopyKey> = {
    facial_verification: 'documents.selfie_next',
    location_verification: 'documents.location_next',
    'facial_verification,location_verification': 'documents.selfie_location_next',
    'location_verification,facial_verification': 'documents.location_selfie_next',
  };
  if (keys[order]) return keys[order];
  return needsHostSteps(info) ? 'documents.host_steps_next' : null;
}
export function selfieFileTypes(info: SessionInfo): string[] {
  return info.upload_limits.allowed_file_types.filter(type => ['jpg', 'png', 'webp'].includes(type));
}
