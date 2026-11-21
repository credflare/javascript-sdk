import type {BiometricUpload, CredflareSession, FacialMetadata, LivenessChallenge, UploadFile} from './index.js';
import {CredflareError} from './index.js';
import type {FaceProviderName} from './engine.js';
import type {GestureName} from './spec.generated.js';
import {text} from './copy.js';

export interface PendingUpload {
  file: UploadFile;
  key: string;
  fileId?: number;
}
export interface GestureEvidence extends PendingUpload {
  gesture: GestureName;
  completedAt: number;
}
export interface LivenessEvidence {
  challenge: LivenessChallenge;
  provider: FaceProviderName;
  gestures: GestureEvidence[];
  video: PendingUpload | null;
  selfie: PendingUpload;
  submitKey: string;
  capturedAt: number;
}

export function facialMetadata(evidence: Pick<LivenessEvidence, 'provider' | 'gestures' | 'capturedAt'>): FacialMetadata {
  return {
    provider: evidence.provider,
    liveness_results: evidence.gestures.map(item => ({challenge: item.gesture, completed: true, timestamp: new Date(item.completedAt).toISOString()})),
    face_detection: {detected: true, face_count: 1, is_centered: true, is_correct_size: true},
    captured_at: new Date(evidence.capturedAt).toISOString(),
  };
}

export async function sendLivenessEvidence(
  session: CredflareSession,
  evidence: LivenessEvidence,
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal,
): Promise<{id: number}> {
  const id = evidence.challenge.challenge_id;
  const uploads: Array<{pending: PendingUpload; input: BiometricUpload}> = [
    ...evidence.gestures.map(item => ({pending: item, input: {type: 'gesture' as const, challengeId: id, gesture: item.gesture, file: item.file}})),
    ...(evidence.video ? [{pending: evidence.video, input: {type: 'liveness_video' as const, challengeId: id, file: evidence.video.file}}] : []),
    {pending: evidence.selfie, input: {type: 'selfie' as const, challengeId: id, file: evidence.selfie.file}},
  ];
  for (const [index, {pending, input}] of uploads.entries()) {
    if (pending.fileId !== undefined) continue;
    onProgress?.(index + 1, uploads.length);
    pending.fileId = (await session.uploadBiometric(input, pending.key, signal)).id;
  }
  return session.submitFacial({
    challenge_id: id,
    image_file_id: evidence.selfie.fileId!,
    gesture_file_ids: evidence.gestures.map(item => item.fileId!),
    video_file_id: evidence.video?.fileId ?? null,
    metadata: facialMetadata(evidence),
  }, evidence.submitKey, signal);
}

export function livenessErrorMessage(error: unknown, fallback: string = text('errors.generic')): string {
  if (error instanceof CredflareError) {
    if (error.status === 401) return text('errors.session_expired');
    if (error.status === 0) return text('errors.network');
    return error.message;
  }
  return fallback;
}
