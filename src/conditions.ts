import type {ConditionOperator} from './spec.generated.js';

export interface ShowIfCondition {
  path: string;
  op: ConditionOperator | (string & {});
  value?: unknown;
}
export interface ShowIf {
  match?: 'all' | 'any';
  conditions: ShowIfCondition[];
}

type Answers = Record<string, unknown> | unknown[];

const DATE = /^\d{4}-\d{2}-\d{2}([T ][0-9:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
const NUMERIC = /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?[ \t\n\r\v\f]*$/;
const MAX_PATTERN = 200;

const isList = (value: unknown): value is unknown[] => Array.isArray(value);
const isMap = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
const isScalar = (value: unknown): value is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof value);
const isNumeric = (value: unknown): boolean => (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && NUMERIC.test(value));
const asText = (value: unknown): string => (value === true ? '1' : value === false || value === null || value === undefined ? '' : String(value));

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (isMap(value)) return null;
  const text = asText(value).trim().toLowerCase();
  if (['1', 'true', 'on', 'yes'].includes(text)) return true;
  if (['0', 'false', 'off', 'no', ''].includes(text)) return false;
  return null;
}

const truthy = (value: unknown): boolean => (isMap(value) ? Object.keys(value).length > 0 : !(value === 0 || value === '' || value === '0' || value === false));

function loose(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) {
    const other = a ?? b;
    if (other === null || other === undefined) return true;
    if (isMap(other)) return Object.keys(other).length === 0;
    return asBoolean(other) === false && (typeof other !== 'string' || other === '');
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return truthy(a) === truthy(b);
  if (isMap(a) || isMap(b)) {
    if (!isMap(a) || !isMap(b)) return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every(key => Object.hasOwn(b, key) && loose(a[key], b[key]));
  }
  if (isNumeric(a) && isNumeric(b)) return Number(a) === Number(b);
  return asText(a) === asText(b);
}

function equals(actual: unknown, expected: unknown): boolean {
  if (isMap(actual) || isMap(expected)) return loose(actual, expected);
  if (typeof actual === 'boolean' || typeof expected === 'boolean') return asBoolean(actual) === asBoolean(expected);
  if (isNumeric(actual) && isNumeric(expected)) return Number(actual) === Number(expected);
  return asText(actual) === asText(expected);
}

function time(value: string): number | null {
  let iso = value.replace(' ', 'T');
  if (!/T/.test(iso)) iso += 'T00:00:00';
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) iso += 'Z';
  iso = iso.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? null : parsed;
}

function compare(actual: unknown, expected: unknown): number | null {
  if (isNumeric(actual) && isNumeric(expected)) return Math.sign(Number(actual) - Number(expected));
  if (typeof actual === 'string' && typeof expected === 'string' && DATE.test(actual) && DATE.test(expected)) {
    const a = time(actual), b = time(expected);
    return a === null || b === null ? null : Math.sign(a - b);
  }
  return null;
}

const within = (needle: unknown, haystack: Record<string, unknown> | unknown[]): boolean =>
  Object.values(haystack).some(candidate => !isMap(candidate) && !isMap(needle) && equals(needle, candidate));

function contains(actual: unknown, expected: unknown): boolean {
  if (isMap(actual)) return within(expected, actual);
  if (isScalar(actual) && isScalar(expected) && asText(expected) !== '') return asText(actual).toLowerCase().includes(asText(expected).toLowerCase());
  return false;
}

function regex(actual: unknown, pattern: unknown): boolean {
  if (!isScalar(actual) || typeof pattern !== 'string' || pattern.length > MAX_PATTERN) return false;
  try { return new RegExp(pattern, 'u').test(asText(actual)); } catch { return false; }
}

function common(a: Uint8Array, b: Uint8Array): number {
  let max = 0, p1 = 0, p2 = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let length = 0;
      while (i + length < a.length && j + length < b.length && a[i + length] === b[j + length]) length++;
      if (length > max) [max, p1, p2] = [length, i, j];
    }
  }
  if (!max) return 0;
  return max + common(a.subarray(0, p1), b.subarray(0, p2)) + common(a.subarray(p1 + max), b.subarray(p2 + max));
}

export function similarity(a: string, b: string): number {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  return x.length + y.length === 0 ? 0 : (common(x, y) * 2 * 100) / (x.length + y.length);
}

function fuzzy(actual: unknown, expected: unknown): boolean {
  if (!isScalar(actual) || !isMap(expected) || isList(expected) || !isScalar(expected.text)) return false;
  const normalize = (value: unknown) => asText(value).toLowerCase().trim().replace(/\s+/g, ' ');
  return similarity(normalize(actual), normalize(expected.text)) >= Number(expected.min_score ?? 80);
}

function resolvePath(path: string, context: unknown): [boolean, unknown] {
  let value = context;
  for (const segment of path.split('.')) {
    if (!isMap(value) || !Object.hasOwn(value, segment)) return [false, null];
    value = value[segment];
  }
  return [true, value];
}

export function conditionHolds(condition: ShowIfCondition, context: unknown): boolean {
  const [exists, actual] = resolvePath(condition.path, context);
  const expected = condition.value ?? null;
  const missing = !exists || actual === null;
  const empty = missing || actual === '' || (isList(actual) && actual.length === 0);
  if (condition.op === 'is_empty') return empty;
  if (condition.op === 'is_not_empty') return !empty;
  if (missing) return false;
  switch (condition.op) {
    case 'equals': return equals(actual, expected);
    case 'not_equals': return !equals(actual, expected);
    case 'gt': { const c = compare(actual, expected); return c !== null && c > 0; }
    case 'gte': { const c = compare(actual, expected); return c !== null && c >= 0; }
    case 'lt': { const c = compare(actual, expected); return c !== null && c < 0; }
    case 'lte': { const c = compare(actual, expected); return c !== null && c <= 0; }
    case 'contains': return contains(actual, expected);
    case 'not_contains': return !contains(actual, expected);
    case 'in': return isList(expected) && within(actual, expected);
    case 'not_in': return isList(expected) && !within(actual, expected);
    case 'regex': return regex(actual, expected);
    case 'fuzzy_match': return fuzzy(actual, expected);
    default: return false;
  }
}

export function showIfMatches(showIf: ShowIf, answers: Answers): boolean {
  const results = showIf.conditions.map(condition => conditionHolds(condition, {form: answers}));
  return (showIf.match ?? 'all') === 'any' ? results.includes(true) : !results.includes(false);
}

export function isShown(question: {show_if?: ShowIf | null}, answers: Answers): boolean {
  const showIf = question.show_if;
  if (!showIf || !showIf.conditions?.length) return true;
  return showIfMatches(showIf, answers);
}
