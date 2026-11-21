import type {SessionInfo} from './index.js';

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
export function selfieFileTypes(info: SessionInfo): string[] {
  return info.upload_limits.allowed_file_types.filter(type => ['jpg', 'png', 'webp'].includes(type));
}
