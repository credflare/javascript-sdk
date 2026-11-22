import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {answerProblems, answersPayload, canAskQuestions, conditionHolds, isShown, requirements, text, visibleQuestions} from '../dist/index.js';

const load = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url)));
const cases = await load('show-if-cases');
const schema = (await load('questionnaire-session')).data.profile.form_schema;

test('replays every server computed show_if case', () => {
  assert.equal(cases.conditions.length + cases.show_if.length, 62);
  for (const item of cases.conditions) assert.equal(conditionHolds(item.condition, {form: item.form}), item.expect, `condition: ${item.name}`);
  for (const item of cases.show_if) assert.equal(isShown({key: 'q', show_if: item.show_if}, item.form), item.expect, `show_if: ${item.name}`);
  const used = new Set(cases.conditions.map(item => item.condition.op));
  for (const op of requirements.show_if.operators) assert.ok(used.has(op), `no case for ${op}`);
});

test('the questionnaire session shows conditional questions only for matching answers', () => {
  const keys = answers => visibleQuestions(schema, answers).map(question => question.key);
  assert.ok(canAskQuestions(schema));
  assert.ok(!keys({employment: 'Student'}).includes('employer'));
  assert.ok(keys({employment: 'Employed'}).includes('employer'));
  assert.ok(keys({employment: 'Self employed'}).includes('income'));
  assert.ok(!keys({employment: 'Self employed'}).includes('employer'));
  assert.ok(keys({sources: ['Salary', 'Other']}).includes('sources_other'));
  assert.ok(!keys({}).includes('sources_other'));
  assert.ok(!canAskQuestions([{key: 'founders', label: 'Founders', type: 'founders', required: true}]));
});

test('hidden questions are not validated and not sent', () => {
  const answers = {country: 'CM', employment: 'Student', employer: 'Acme', income: '5000', birth_date: '1990-02-28', sources: ['Salary'], sources_other: 'Gift', terms: true};
  assert.deepEqual(answerProblems(schema, answers), {});
  assert.deepEqual(answersPayload(schema, answers), {country: 'CM', employment: 'Student', birth_date: '1990-02-28', sources: ['Salary'], terms: true});
  const employed = {...answers, employment: 'Employed', employer: ''};
  assert.deepEqual(Object.keys(answerProblems(schema, employed)), ['employer']);
  assert.deepEqual(answersPayload(schema, {...employed, employer: ' Acme ', income: '5000.50'}), {country: 'CM', employment: 'Employed', employer: ' Acme ', income: 5000.5, birth_date: '1990-02-28', sources: ['Salary'], terms: true});
});

test('validates each question type with the spec copy', () => {
  const base = {country: 'CM', employment: 'Employed', employer: 'Acme', birth_date: '1990-01-01', terms: true};
  const problem = (answers, key) => {
    const found = answerProblems(schema, {...base, ...answers})[key];
    return found ? text(found.key, found.values) : null;
  };
  assert.equal(problem({income: 'many'}, 'income'), text('questions.invalid_number'));
  assert.equal(problem({income: -1}, 'income'), text('questions.number_min', {min: 0}));
  assert.equal(problem({income: '10000001'}, 'income'), text('questions.number_max', {max: 10000000}));
  assert.equal(problem({birth_date: '2026-02-30'}, 'birth_date'), text('questions.invalid_date'));
  assert.equal(problem({contact_email: 'jane@'}, 'contact_email'), text('questions.invalid_email'));
  assert.equal(problem({contact_phone: 'call me'}, 'contact_phone'), text('questions.invalid_phone'));
  assert.equal(problem({contact_phone: '+44 7700 900123'}, 'contact_phone'), null);
  assert.equal(problem({terms: false}, 'terms'), text('questions.consent_required'));
  assert.equal(problem({country: undefined}, 'country'), text('questions.required'));
  assert.equal(problem({country: 'cm'}, 'country'), text('questions.required'));
  assert.equal(problem({employment: 'Unemployed'}, 'employment'), text('questions.required'));
  assert.equal(problem({sources: ['Salary', 'Lottery']}, 'sources'), text('questions.required'));
  assert.equal(problem({employer: 'x'.repeat(5001)}, 'employer'), text('questions.text_too_long'));
});
