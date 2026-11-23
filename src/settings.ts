import {settings as schema} from './spec.generated.js';
import type {GestureName} from './spec.generated.js';

export interface VerificationRequirement {
  verification_type: string;
  settings?: Record<string, unknown> | null;
}
export interface FacialSettings {
  gestures: GestureName[];
  gesture_count: number;
  record_video: boolean;
}
export interface ReferencePlaceLabel {
  label: string;
}
export interface LocationReference {
  rule: 'within' | 'outside';
  match: 'any' | 'all';
  places: ReferencePlaceLabel[];
}
export interface LocationSettings {
  max_accuracy_m: number;
  max_age_s: number;
  mock_location: 'reject' | 'flag' | 'allow';
  ip_country: 'reject' | 'flag' | 'off';
  reference: LocationReference | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const intIn = (value: unknown, field: {min: number; max: number; default: number}): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= field.min && value <= field.max ? value : field.default;
const oneOf = <T extends string>(value: unknown, field: {of: readonly T[]; default: T}): T =>
  typeof value === 'string' && (field.of as readonly string[]).includes(value) ? value as T : field.default;

function requirement(requirements: VerificationRequirement[] | undefined, type: string): VerificationRequirement | undefined {
  return requirements?.find(item => item.verification_type === type);
}

export function parseFacialSettings(raw: unknown): FacialSettings {
  const value = isRecord(raw) ? raw : {};
  const spec = schema.facial_verification;
  const allowed = spec.gestures.of as readonly string[];
  const gestures = Array.isArray(value.gestures) ? [...new Set(value.gestures.filter((item): item is GestureName => typeof item === 'string' && allowed.includes(item)))] : [];
  return {
    gestures: gestures.length >= spec.gestures.min ? gestures : [...spec.gestures.default],
    gesture_count: intIn(value.gesture_count, spec.gesture_count),
    record_video: typeof value.record_video === 'boolean' ? value.record_video : spec.record_video.default,
  };
}

export function parseLocationSettings(raw: unknown): LocationSettings {
  const value = isRecord(raw) ? raw : {};
  const spec = schema.location_verification;
  let reference: LocationReference | null = null;
  if (isRecord(value.reference)) {
    const fields = spec.reference.fields;
    const places = Array.isArray(value.reference.places)
      ? value.reference.places.filter(isRecord).map(place => place.label).filter((label): label is string => typeof label === 'string' && label.trim() !== '').map(label => ({label}))
      : [];
    if (places.length) reference = {rule: oneOf(value.reference.rule, fields.rule), match: oneOf(value.reference.match, fields.match), places};
  }
  return {
    max_accuracy_m: intIn(value.max_accuracy_m, spec.max_accuracy_m),
    max_age_s: intIn(value.max_age_s, spec.max_age_s),
    mock_location: oneOf(value.mock_location, spec.mock_location),
    ip_country: oneOf(value.ip_country, spec.ip_country),
    reference,
  };
}

export function facialSettings(requirements: VerificationRequirement[] | undefined): FacialSettings | null {
  const item = requirement(requirements, 'facial_verification');
  return item ? parseFacialSettings(item.settings) : null;
}

export function locationSettings(requirements: VerificationRequirement[] | undefined): LocationSettings | null {
  const item = requirement(requirements, 'location_verification');
  return item ? parseLocationSettings(item.settings) : null;
}
