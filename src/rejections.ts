import {rejections} from './spec.generated.js';
import type {CopyKey, ErrorCode, Locale, RejectionAction} from './spec.generated.js';
import {CredflareError} from './index.js';
import {text, verifierName} from './copy.js';
import type {LocationSettings} from './settings.js';

export interface RejectionScreen {
  code: ErrorCode | null;
  title: string | null;
  message: string;
  action: RejectionAction;
  actionLabel: string;
  requestedBy: string;
  help: string;
}
export interface RejectionContext {
  requester?: {name?: string | null} | null;
  location?: LocationSettings | null;
  locale?: Locale;
}
interface RejectionCopy {
  title: string;
  message: string;
  action: string;
  place_message_within?: string;
  place_message_outside?: string;
}

const codes = rejections.codes as Record<string, RejectionCopy>;

export function rejectionCopy(code: string | null | undefined): RejectionCopy | null {
  return code && Object.hasOwn(codes, code) ? codes[code]! : null;
}

export function rejectionScreen(error: unknown, context: RejectionContext = {}): RejectionScreen {
  const locale = context.locale ?? 'en';
  const verifier = verifierName({requester: context.requester ?? null}, locale);
  const say = (key: string, values: Record<string, string> = {}) => text(key as CopyKey, {verifier, ...values}, locale);
  const code = error instanceof CredflareError ? error.code : null;
  const entry = rejectionCopy(code);
  const base = {requestedBy: say(rejections.requested_by), help: say(rejections.help)};
  if (!entry) {
    const message = error instanceof CredflareError && error.message ? error.message : say('errors.generic');
    return {code: null, title: null, message, action: 'retry', actionLabel: say(rejections.actions.retry.label), ...base};
  }
  const action = entry.action as RejectionAction;
  const reference = context.location?.reference;
  let message = say(entry.message);
  if (reference?.places.length) {
    const key = reference.rule === 'outside' ? entry.place_message_outside : entry.place_message_within;
    if (key) message = say(key, {place: reference.places.map(place => place.label).join(', ')});
  }
  return {code: code as ErrorCode, title: say(entry.title), message, action, actionLabel: say(rejections.actions[action].label), ...base};
}
