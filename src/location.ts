import {location as locationSpec} from './spec.generated.js';
import type {CopyKey} from './spec.generated.js';
import {text} from './copy.js';
import type {LocationSettings} from './settings.js';

export type LocationProvider = 'gps' | 'network' | 'fused' | 'browser';
export interface LocationFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  fixTime: number;
  isMock: boolean | null;
  provider: LocationProvider;
}
export type LocationErrorCode = 'permission_denied' | 'unavailable' | 'timeout' | 'low_accuracy' | 'mock_detected' | 'retries_exhausted';
export class LocationError extends Error {
  constructor(public readonly code: LocationErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'LocationError';
  }
}

export function locationErrorKey(code: LocationErrorCode, browser = false): CopyKey {
  switch (code) {
    case 'permission_denied': return browser ? 'location.permission_denied_browser' : 'location.permission_denied';
    case 'unavailable': return 'location.unavailable';
    case 'timeout': return 'location.timeout';
    case 'low_accuracy': return 'location.low_accuracy';
    case 'mock_detected': return 'location.mock_detected';
    case 'retries_exhausted': return 'location.retries_exhausted';
  }
}

export function fixProblem(fix: LocationFix, settings: LocationSettings, now: number = Date.now()): 'low_accuracy' | 'stale' | 'mock_detected' | null {
  if (settings.mock_location === 'reject' && fix.isMock === true) return 'mock_detected';
  if (fix.accuracy === null || !Number.isFinite(fix.accuracy) || fix.accuracy > settings.max_accuracy_m) return 'low_accuracy';
  if (now - fix.fixTime > settings.max_age_s * 1000) return 'stale';
  return null;
}

export async function acquireFix(
  getFix: (attempt: number) => Promise<LocationFix>,
  settings: LocationSettings,
  options: {attempts?: number; now?: () => number; onAttempt?: (attempt: number, problem: 'low_accuracy' | 'stale' | null) => void} = {},
): Promise<LocationFix> {
  const attempts = options.attempts ?? locationSpec.retry_attempts;
  const now = options.now ?? Date.now;
  let last: 'low_accuracy' | 'stale' | 'unavailable' | 'timeout' | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    options.onAttempt?.(attempt, last === 'low_accuracy' || last === 'stale' ? last : null);
    let fix: LocationFix;
    try {
      fix = await getFix(attempt);
    } catch (error) {
      if (error instanceof LocationError && (error.code === 'unavailable' || error.code === 'timeout')) { last = error.code; continue; }
      throw error;
    }
    const problem = fixProblem(fix, settings, now());
    if (problem === null) return fix;
    if (problem === 'mock_detected') throw new LocationError('mock_detected');
    last = problem;
  }
  throw new LocationError(last === 'low_accuracy' ? 'low_accuracy' : last === 'unavailable' ? 'unavailable' : 'timeout');
}

export function locationSubmission(fix: LocationFix, capturedAt: Date = new Date()) {
  return {
    type: 'location_verification' as const,
    latitude: fix.latitude,
    longitude: fix.longitude,
    metadata: {
      accuracy: fix.accuracy,
      altitude: fix.altitude,
      fix_time: new Date(fix.fixTime).toISOString(),
      is_mock: fix.isMock,
      provider: fix.provider,
      captured_at: capturedAt.toISOString(),
    },
  };
}

function joinLabels(labels: string[]): string {
  return labels.join(', ');
}

export function locationCopy(settings: LocationSettings | null, verifier: string): {title: string; need: string | null; why: string} {
  const why = text('location.why', {verifier});
  const reference = settings?.reference;
  if (!reference || !reference.places.length) return {title: text('location.title'), need: null, why};
  const labels = reference.places.map(place => place.label);
  const place = labels[0]!;
  if (reference.rule === 'outside') {
    return {
      title: labels.length === 1 ? text('location.place.title_outside', {place}) : text('location.title'),
      need: labels.length === 1 ? text('location.place.need_outside', {place}) : text('location.place.need_outside_all', {places: joinLabels(labels)}),
      why,
    };
  }
  return {
    title: labels.length === 1 ? text('location.place.title_within', {place}) : text('location.title'),
    need: labels.length === 1
      ? text('location.place.need_within', {place})
      : text(reference.match === 'all' ? 'location.place.need_within_all' : 'location.place.need_within_any', {places: joinLabels(labels)}),
    why,
  };
}
