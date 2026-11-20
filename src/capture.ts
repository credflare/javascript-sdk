import type {DocumentRequirement} from './index.js';
export type CaptureSource = 'camera' | 'upload';
export type CapturePolicy = 'upload' | 'either' | 'snapshot' | 'snapshot_and_upload';
export interface CaptureStep {
  id: string;
  side: 'front' | 'back';
  source: CaptureSource | 'either';
  label: string;
  sourceLabel: string;
}
const supported: string[] = ['upload', 'either', 'snapshot', 'snapshot_and_upload'];
export function capturePolicy(requirement: DocumentRequirement): string {
  return requirement.capture_method ?? (requirement.document_type.capture_method === 'camera' ? 'either' : 'upload');
}
export function isCaptureSupported(requirement: DocumentRequirement): boolean {
  return supported.includes(capturePolicy(requirement));
}
export function methodSummary(requirement: DocumentRequirement): string {
  switch (capturePolicy(requirement)) {
    case 'snapshot': return 'Camera photos';
    case 'upload': return 'Saved files';
    case 'either': return 'Photo or file';
    case 'snapshot_and_upload': return 'Photo and saved file';
    default: return 'Not available in this app';
  }
}
export function captureSteps(requirement: DocumentRequirement): CaptureStep[] {
  const policy = capturePolicy(requirement);
  if (!supported.includes(policy)) throw new Error('This document cannot be collected in this app.');
  const sides = requirement.requested_sides ?? (requirement.document_type.two_sided ? ['front', 'back'] as const : ['front'] as const);
  const methods: Array<CaptureSource | 'either'> = policy === 'snapshot_and_upload' ? ['camera', 'upload'] : [policy === 'snapshot' ? 'camera' : policy === 'either' ? 'either' : 'upload'];
  return methods.flatMap(source => sides.map(side => ({
    id: `${source}:${side}`,
    side,
    source,
    label: side === 'front' ? 'Front' : 'Back',
    sourceLabel: source === 'camera' ? 'Camera photo' : source === 'upload' ? 'Saved file' : 'Photo or file',
  })));
}
