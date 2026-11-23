import {nextStep, remainingStep} from '@credflare/sdk-javascript';
import type {FlowStep, FormField, RemainingStep, SessionInfo} from '@credflare/sdk-javascript';

declare module '@credflare/sdk-javascript' {
  interface FormField {
    placeholder?: string;
  }
}

type Handler = (info: SessionInfo) => void;
const skip: Handler = () => undefined;

const earlier: Record<FlowStep, Handler> = {documents: skip, facial_verification: skip, location_verification: skip, host: skip, done: skip};
export function runEarlier(info: SessionInfo): void {
  earlier[nextStep(info)](info);
}

const current: Record<RemainingStep, Handler> = {...earlier, questions: skip, email_verification: skip, phone_verification: skip};
export function runCurrent(info: SessionInfo): void {
  current[remainingStep(info)](info);
}

export const field: FormField = {key: 'nickname', label: 'Nickname', type: 'text', required: false, placeholder: 'Ada'};
export const asked: FormField[] | null | undefined = ({} as SessionInfo).profile?.form_schema;
