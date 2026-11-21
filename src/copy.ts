import {copy, copyPlaceholders} from './spec.generated.js';
import type {CopyKey, Locale} from './spec.generated.js';

export type CopyValues = Partial<Record<keyof typeof copyPlaceholders, string | number>>;

export function text(key: CopyKey, values: CopyValues = {}, locale: Locale = 'en'): string {
  const template: string = copy[locale][key] ?? copy.en[key];
  return template.replace(/\{([a-z_]+)\}/g, (match, name: string) => {
    const value = values[name as keyof CopyValues];
    return value === undefined ? match : String(value);
  });
}

export function verifierName(info: {requester?: {name?: string | null} | null} | null | undefined, locale: Locale = 'en'): string {
  const name = info?.requester?.name?.trim();
  return name ? name : copy[locale]['common.verifier_fallback'];
}
