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
  helpLink: {text: string; href: string} | null;
}
export interface RejectionContext {
  requester?: {name?: string | null; help_email?: string | null; help_url?: string | null} | null;
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

function helpLine(requester: RejectionContext['requester'], say: (key: string, values?: Record<string, string>) => string): Pick<RejectionScreen, 'help' | 'helpLink'> {
  const email = requester?.help_email?.trim();
  if (email) return {help: say(rejections.help_email, {help_email: email}), helpLink: {text: email, href: `mailto:${email}`}};
  const url = requester?.help_url?.trim();
  if (url && /^https?:\/\//i.test(url)) return {help: say(rejections.help_url, {help_url: url}), helpLink: {text: url, href: url}};
  return {help: say(rejections.help), helpLink: null};
}

export function rejectionScreen(error: unknown, context: RejectionContext = {}): RejectionScreen {
  const locale = context.locale ?? 'en';
  const verifier = verifierName({requester: context.requester ?? null}, locale);
  const say = (key: string, values: Record<string, string> = {}) => text(key as CopyKey, {verifier, ...values}, locale);
  const code = error instanceof CredflareError ? error.code : null;
  const entry = rejectionCopy(code);
  const base = {requestedBy: say(rejections.requested_by), ...helpLine(context.requester, say)};
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
