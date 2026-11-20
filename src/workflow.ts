import type {SessionInfo} from './index.js';

export function requiresSelfie(info: SessionInfo): boolean {
  return info.profile?.verification_requirements.some(item => item.verification_type === 'facial_verification') ?? false;
}
export function needsHostSteps(info: SessionInfo): boolean {
  return !info.profile || !!info.profile.form_schema?.length || info.profile.verification_requirements.some(item => item.verification_type !== 'facial_verification');
}
export function selfieFileTypes(info: SessionInfo): string[] {
  return info.upload_limits.allowed_file_types.filter(type => ['jpg', 'png', 'webp'].includes(type));
}
