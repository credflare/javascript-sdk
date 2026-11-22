import {requirements} from './spec.generated.js';
import type {CopyKey} from './spec.generated.js';
import type {CodeChannel} from './index.js';

const rules = requirements.contact_codes;
const strip = new RegExp(rules.phone_strip, 'g');
const phonePattern = new RegExp(rules.phone_pattern);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhone(value: string): string {
  return value.trim().replace(strip, '');
}

export function codeDestinationProblem(channel: CodeChannel, value: string): CopyKey | null {
  if (channel === 'email') {
    const email = value.trim();
    return email.length <= rules.email_max_length && emailPattern.test(email) ? null : 'email.invalid';
  }
  return value.length <= rules.phone_max_length && phonePattern.test(normalizePhone(value)) ? null : 'phone.invalid';
}

export function secondsUntil(iso: string | null | undefined, now: number = Date.now()): number {
  const at = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(at) ? 0 : Math.max(0, Math.ceil((at - now) / 1000));
}
