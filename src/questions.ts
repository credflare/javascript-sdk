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
export interface QuestionProblem {
  key: CopyKey;
  values?: {min?: number; max?: number};
}

const rules = requirements.questions;
const supported: readonly string[] = rules.types.filter(type => type !== 'founders');
const pattern = (source: string) => new RegExp(source);
const numberPattern = pattern(rules.number_pattern);
const datePattern = pattern(rules.date_pattern);
const phonePattern = pattern(rules.phone_pattern);
const countryPattern = pattern(rules.country_pattern);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmptyAnswer = (value: unknown): boolean => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

export function canAskQuestions(schema: Question[] | null | undefined): boolean {
  return (schema ?? []).every(question => supported.includes(question.type));
}

export function visibleQuestions(schema: Question[] | null | undefined, answers: Answers, earlier: Answers = {}): Question[] {
  const context: Answers = {...earlier};
  const shown: Question[] = [];
  for (const question of schema ?? []) {
    if (!isShown(question, context)) continue;
    shown.push(question);
    if (Object.hasOwn(answers, question.key)) context[question.key] = answers[question.key];
  }
  return shown;
}

function realDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function questionProblem(question: Question, value: unknown): QuestionProblem | null {
  if (question.type === 'consent') {
    if (question.required && value !== true) return {key: 'questions.consent_required'};
    return null;
  }
  if (isEmptyAnswer(value) || (typeof value === 'string' && value.trim() === '')) return question.required ? {key: 'questions.required'} : null;
  const options = (question.options ?? []).map(String);
  switch (question.type) {
    case 'text':
    case 'textarea':
      return typeof value === 'string' && value.length <= rules.text_max_length ? null : {key: 'questions.text_too_long'};
    case 'number': {
      const text = typeof value === 'number' ? String(value) : String(value).trim();
      if (!(typeof value === 'number' && Number.isFinite(value)) && !numberPattern.test(text)) return {key: 'questions.invalid_number'};
      const number = Number(text);
      if (typeof question.min === 'number' && number < question.min) return {key: 'questions.number_min', values: {min: question.min}};
      if (typeof question.max === 'number' && number > question.max) return {key: 'questions.number_max', values: {max: question.max}};
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
    const problem = questionProblem(question, answers[question.key]);
    if (problem) problems[question.key] = problem;
  }
  return problems;
}

export function answersPayload(schema: Question[] | null | undefined, answers: Answers, earlier: Answers = {}): Answers {
  const fields: Answers = {};
  for (const question of visibleQuestions(schema, answers, earlier)) {
    const value = answers[question.key];
    if (question.type === 'consent') {
      if (typeof value === 'boolean') fields[question.key] = value;
      continue;
    }
    if (isEmptyAnswer(value) || (typeof value === 'string' && value.trim() === '')) continue;
    if (question.type === 'number' && typeof value === 'string') fields[question.key] = Number(value.trim());
    else if (typeof value === 'string' && question.type !== 'text' && question.type !== 'textarea') fields[question.key] = value.trim();
    else fields[question.key] = value;
  }
  return fields;
}
