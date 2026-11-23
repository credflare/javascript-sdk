import {requirements} from './spec.generated.js';
import type {CopyKey, QuestionType} from './spec.generated.js';
import {isShown} from './conditions.js';
import type {ShowIf} from './conditions.js';

export interface Question {
  key: string;
  label: string;
  type: QuestionType | (string & {});
  required: boolean;
  options?: unknown[] | null;
  min?: number | null;
  max?: number | null;
  show_if?: ShowIf | null;
}
export type Answers = Record<string, unknown>;
export interface FoundersAnswer {
  includes_applicant: boolean;
  names: string[];
}
export interface QuestionProblem {
  key: CopyKey;
  values?: {min?: number; max?: number};
}

const rules = requirements.questions;
const supported: readonly string[] = rules.types;
const pattern = (source: string) => new RegExp(source);
const numberPattern = pattern(rules.number_pattern);
const datePattern = pattern(rules.date_pattern);
const phonePattern = pattern(rules.phone_pattern);
const countryPattern = pattern(rules.country_pattern);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const hasAnswer = (answers: Answers | null | undefined, key: string): boolean => !!answers && Object.prototype.hasOwnProperty.call(answers, key);
export const answerFor = (answers: Answers | null | undefined, key: string): unknown => (hasAnswer(answers, key) ? answers![key] : undefined);

export const isEmptyAnswer = (value: unknown): boolean => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

export const isSupportedQuestion = (question: Question): boolean => supported.includes(question.type);

export function foundersAnswer(value: unknown): FoundersAnswer | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const names = (Array.isArray(raw.names) ? raw.names : []).filter((name): name is string => typeof name === 'string').map(name => name.trim()).filter(Boolean);
  const includes = raw.includes_applicant === true;
  return includes || names.length ? {includes_applicant: includes, names} : undefined;
}

const trimmedTypes: readonly string[] = ['number', 'date', 'email', 'phone', 'tel'];

export function submittedValue(question: Question, value: unknown): unknown {
  if (question.type === 'consent') return typeof value === 'boolean' ? value : undefined;
  if (question.type === 'founders') return foundersAnswer(value);
  if (isEmptyAnswer(value) || (typeof value === 'string' && value.trim() === '')) return undefined;
  if (typeof value !== 'string' || !trimmedTypes.includes(question.type)) return value;
  const trimmed = value.trim();
  if (question.type === 'number' && numberPattern.test(trimmed) && String(Number(trimmed)) === trimmed) return Number(trimmed);
  return trimmed;
}

export function startingAnswers(schema: Question[] | null | undefined, earlier: Answers = {}): Answers {
  const answers: Answers = {};
  for (const question of schema ?? []) if (hasAnswer(earlier, question.key)) answers[question.key] = earlier[question.key];
  return answers;
}

export function canAskQuestions(schema: Question[] | null | undefined, earlier: Answers = {}, answers: Answers = startingAnswers(schema, earlier)): boolean {
  return visibleQuestions(schema, answers, earlier).every(isSupportedQuestion);
}

export function visibleQuestions(schema: Question[] | null | undefined, answers: Answers, earlier: Answers = {}): Question[] {
  const context: Answers = {...earlier};
  const shown: Question[] = [];
  for (const question of schema ?? []) {
    if (!isShown(question, context)) continue;
    shown.push(question);
    const value = isSupportedQuestion(question) ? submittedValue(question, answerFor(answers, question.key)) : undefined;
    if (value !== undefined) context[question.key] = value;
    else if (isSupportedQuestion(question)) delete context[question.key];
  }
  return shown;
}

function realDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function decimal(text: string): {negative: boolean; whole: string; fraction: string} {
  const negative = text.startsWith('-');
  const [whole = '', fraction = ''] = text.replace(/^-/, '').split('.');
  const parts = {whole: whole.replace(/^0+/, ''), fraction: fraction.replace(/0+$/, '')};
  return {negative: negative && !!(parts.whole || parts.fraction), ...parts};
}

function compareMagnitude(a: {whole: string; fraction: string}, b: {whole: string; fraction: string}): number {
  if (a.whole.length !== b.whole.length) return Math.sign(a.whole.length - b.whole.length);
  if (a.whole !== b.whole) return a.whole < b.whole ? -1 : 1;
  const length = Math.max(a.fraction.length, b.fraction.length);
  const x = a.fraction.padEnd(length, '0'), y = b.fraction.padEnd(length, '0');
  return x === y ? 0 : x < y ? -1 : 1;
}

function plainDecimal(value: number): string {
  const [mantissa = '', power] = String(value).split('e');
  if (power === undefined) return mantissa;
  const negative = mantissa.startsWith('-');
  const [whole = '', fraction = ''] = mantissa.replace('-', '').split('.');
  const digits = whole + fraction;
  const point = whole.length + Number(power);
  const body = point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? digits + '0'.repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return (negative ? '-' : '') + body;
}

export function compareNumberText(text: string, bound: number): number {
  const limit = Number.isFinite(bound) ? plainDecimal(bound) : String(bound);
  if (!numberPattern.test(text) || !numberPattern.test(limit)) return Math.sign(Number(text) - bound);
  const a = decimal(text), b = decimal(limit);
  if (a.negative !== b.negative) return a.negative ? -1 : 1;
  const magnitude = compareMagnitude(a, b);
  return a.negative ? -magnitude : magnitude;
}

export function questionProblem(question: Question, value: unknown): QuestionProblem | null {
  if (question.type === 'consent') {
    if (question.required && value !== true) return {key: 'questions.consent_required'};
    return null;
  }
  if (question.type === 'founders') return question.required && !foundersAnswer(value) ? {key: 'questions.required'} : null;
  if (isEmptyAnswer(value) || (typeof value === 'string' && value.trim() === '')) return question.required ? {key: 'questions.required'} : null;
  const options = (question.options ?? []).map(String);
  switch (question.type) {
    case 'text':
    case 'textarea':
      return typeof value === 'string' && [...value].length <= rules.text_max_length ? null : {key: 'questions.text_too_long'};
    case 'number': {
      const finite = typeof value === 'number' && Number.isFinite(value);
      const text = typeof value === 'number' ? (finite ? plainDecimal(value) : String(value)) : String(value).trim();
      if (!finite && !(typeof value === 'string' && numberPattern.test(text))) return {key: 'questions.invalid_number'};
      if (typeof question.min === 'number' && compareNumberText(text, question.min) < 0) return {key: 'questions.number_min', values: {min: question.min}};
      if (typeof question.max === 'number' && compareNumberText(text, question.max) > 0) return {key: 'questions.number_max', values: {max: question.max}};
      return null;
    }
    case 'date':
      return typeof value === 'string' && realDate(value) ? null : {key: 'questions.invalid_date'};
    case 'email':
      return typeof value === 'string' && value.length <= rules.email_max_length && emailPattern.test(value.trim()) ? null : {key: 'questions.invalid_email'};
    case 'phone':
    case 'tel':
      return typeof value === 'string' && phonePattern.test(value.trim()) ? null : {key: 'questions.invalid_phone'};
    case 'select':
    case 'single_select':
      return typeof value === 'string' && options.includes(value) ? null : {key: 'questions.required'};
    case 'multi_select':
      return Array.isArray(value) && value.every(item => options.includes(String(item))) && new Set(value).size === value.length ? null : {key: 'questions.required'};
    case 'country':
      return typeof value === 'string' && countryPattern.test(value) ? null : {key: 'questions.required'};
    default:
      return null;
  }
}

export function answerProblems(schema: Question[] | null | undefined, answers: Answers, earlier: Answers = {}): Record<string, QuestionProblem> {
  const problems: Record<string, QuestionProblem> = {};
  for (const question of visibleQuestions(schema, answers, earlier)) {
    if (!isSupportedQuestion(question)) continue;
    const problem = questionProblem(question, answerFor(answers, question.key));
    if (problem) problems[question.key] = problem;
  }
  return problems;
}

export function answersPayload(schema: Question[] | null | undefined, answers: Answers, earlier: Answers = {}): Answers {
  const fields: Answers = {};
  for (const question of visibleQuestions(schema, answers, earlier)) {
    if (!isSupportedQuestion(question)) continue;
    const value = submittedValue(question, answerFor(answers, question.key));
    if (value !== undefined) fields[question.key] = value;
    else if (hasAnswer(earlier, question.key)) fields[question.key] = null;
  }
  return fields;
}
