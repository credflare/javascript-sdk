import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {answerProblems, answersPayload, canAskQuestions, conditionHolds, earlierAnswers, similarity, startingAnswers, isShown, needsHostSteps, nextStep, requirements, text, visibleQuestions} from '../dist/index.js';

const load = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url)));
const cases = await load('show-if-cases');
const schema = (await load('questionnaire-session')).data.profile.form_schema;

test('replays every server computed show_if case', () => {
  assert.equal(cases.conditions.length + cases.show_if.length, 65);
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
});

test('hidden questions are not validated and not sent', () => {
  const answers = {country: 'CM', employment: 'Student', employer: 'Acme', income: '5000', birth_date: '1990-02-28', sources: ['Salary'], sources_other: 'Gift', terms: true};
  assert.deepEqual(answerProblems(schema, answers), {});
  assert.deepEqual(answersPayload(schema, answers), {country: 'CM', employment: 'Student', birth_date: '1990-02-28', sources: ['Salary'], terms: true});
  const employed = {...answers, employment: 'Employed', employer: ''};
  assert.deepEqual(Object.keys(answerProblems(schema, employed)), ['employer']);
  assert.deepEqual(answersPayload(schema, {...employed, employer: ' Acme ', income: '5000.50'}), {country: 'CM', employment: 'Employed', employer: ' Acme ', income: '5000.50', birth_date: '1990-02-28', sources: ['Salary'], terms: true});
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

const question = key => schema.find(item => item.key === key);
const income = {...question('income'), show_if: null, min: null, max: null};

test('numbers keep the exact text the applicant typed', () => {
  const payload = value => answersPayload([income], {income: value}).income;
  assert.equal(payload('5000.5'), 5000.5);
  assert.equal(payload(' 42 '), 42);
  assert.equal(payload('9007199254740993'), '9007199254740993');
  assert.equal(payload('01'), '01');
  assert.equal(payload('-0'), '-0');
  const huge = '9'.repeat(310);
  assert.deepEqual(answerProblems([income], {income: huge}), {});
  assert.equal(payload(huge), huge);
  assert.equal(JSON.parse(JSON.stringify(answersPayload([income], {income: huge}))).income, huge);
});

test('number bounds compare the exact decimal text', () => {
  const bounded = {...question('income'), show_if: null};
  const problem = value => answerProblems([bounded], {income: value}).income?.key ?? null;
  assert.equal(problem('10000000'), null);
  assert.equal(problem('10000000.0000000000000001'), 'questions.number_max');
  assert.equal(problem('-0.0000000000000000001'), 'questions.number_min');
  assert.equal(problem('0.000'), null);
});

test('show_if sees exactly the values that are submitted', () => {
  const follow = {...question('employer'), show_if: {match: 'all', conditions: [{path: 'form.income', op: 'regex', value: '^0'}]}};
  const questions = [income, follow];
  const answers = {income: '01', employer: 'Acme'};
  assert.deepEqual(visibleQuestions(questions, answers).map(item => item.key), ['income', 'employer']);
  const payload = answersPayload(questions, answers);
  assert.deepEqual(payload, {income: '01', employer: 'Acme'});
  assert.ok(isShown(follow, payload));
  const blank = {...question('employer'), show_if: {conditions: [{path: 'form.sources_other', op: 'not_equals', value: 'x'}]}};
  const other = {...question('sources_other'), show_if: null, required: false};
  assert.deepEqual(visibleQuestions([other, blank], {sources_other: '   '}).map(item => item.key), ['sources_other']);
  assert.deepEqual(answersPayload([other, blank], {sources_other: '   '}), {});
});

test('earlier answers decide which outstanding questions are shown', () => {
  const outstanding = [question('employer')];
  assert.deepEqual(visibleQuestions(outstanding, {}, {employment: 'Employed'}).map(item => item.key), ['employer']);
  assert.deepEqual(answersPayload(outstanding, {employer: 'Acme'}, {employment: 'Employed'}), {employer: 'Acme'});
  assert.deepEqual(visibleQuestions(outstanding, {}, {}).map(item => item.key), []);
});

test('text length counts characters, not UTF-16 code units', () => {
  const employer = question('employer');
  assert.equal(answerProblems([{...employer, show_if: null}], {employer: '\u{1F600}'.repeat(2501)}).employer, undefined);
  assert.equal(answerProblems([{...employer, show_if: null}], {employer: '\u{1F600}'.repeat(5001)}).employer.key, 'questions.text_too_long');
});

test('dates in years 0001 to 0099 are real dates', () => {
  const birth = question('birth_date');
  const problem = value => answerProblems([birth], {birth_date: value}).birth_date?.key ?? null;
  assert.equal(problem('0099-01-01'), null);
  assert.equal(problem('0001-12-31'), null);
  assert.equal(problem('0004-02-29'), null);
  assert.equal(problem('0001-02-29'), 'questions.invalid_date');
});

test('founders questions are asked and sent as names and the applicant flag', () => {
  const founders = {...question('employer'), key: 'founders', label: 'Founders', type: 'founders', show_if: null};
  assert.ok(canAskQuestions([founders]));
  assert.equal(answerProblems([founders], {}).founders.key, 'questions.required');
  assert.equal(answerProblems([founders], {founders: {includes_applicant: false, names: ['  ', '']}}).founders.key, 'questions.required');
  assert.deepEqual(answerProblems([founders], {founders: {includes_applicant: true, names: []}}), {});
  assert.deepEqual(answersPayload([founders], {founders: {includes_applicant: false, names: [' Ada Lovelace ', '', 'Grace Hopper']}}), {founders: {includes_applicant: false, names: ['Ada Lovelace', 'Grace Hopper']}});
  assert.deepEqual(answersPayload([{...founders, required: false}], {founders: {includes_applicant: false, names: []}}), {});
});

test('only visible unsupported questions send the form back to the host', async () => {
  const info = JSON.parse(await readFile(new URL('./fixtures/questionnaire-session.json', import.meta.url))).data;
  const future = {...question('employer'), key: 'signature', type: 'signature'};
  const withFuture = {...info, profile: {...info.profile, form_schema: [question('employment'), future]}};
  assert.equal(nextStep(withFuture), 'questions');
  assert.equal(needsHostSteps(withFuture), false);
  assert.notEqual(nextStep(withFuture, {employment: 'Employed'}), 'questions');
  assert.equal(needsHostSteps(withFuture, {employment: 'Employed'}), true);
  assert.ok(!canAskQuestions([{...future, show_if: null}]));
});

test('a question keyed like an object property is looked up as an answer only', () => {
  const ctor = {...question('employer'), key: 'constructor', show_if: null};
  assert.deepEqual(Object.keys(answerProblems([ctor], {})), ['constructor']);
  assert.equal(answerProblems([ctor], {}).constructor.key, 'questions.required');
  assert.deepEqual(answersPayload([ctor], {}), {});
  assert.deepEqual(answersPayload([ctor], {constructor: 'Acme'}), {constructor: 'Acme'});
  const after = {...question('employer'), key: 'after', show_if: {conditions: [{path: 'form.constructor', op: 'is_empty'}]}};
  assert.deepEqual(visibleQuestions([ctor, after], {}).map(item => item.key), ['constructor', 'after']);
});

test('shared helpers work where Object.hasOwn is missing', async () => {
  const fixtures = new URL('./fixtures/', import.meta.url).pathname;
  const script = `
    delete Object.hasOwn;
    const sdk = await import(${JSON.stringify(new URL('../dist/index.js', import.meta.url).href)});
    const {readFileSync} = await import('node:fs');
    const load = name => JSON.parse(readFileSync(${JSON.stringify(fixtures)} + name + '.json', 'utf8'));
    const schema = load('questionnaire-session').data.profile.form_schema;
    const answers = {country: 'CM', employment: 'Employed', employer: 'Acme', birth_date: '1990-01-01', terms: true};
    if (Object.keys(sdk.answerProblems(schema, answers)).length) throw new Error('problems');
    if (sdk.answersPayload(schema, answers).employer !== 'Acme') throw new Error('payload');
    const rejection = load('rejections/phone.not_configured');
    const screen = sdk.rejectionScreen(new sdk.CredflareError(rejection.message, 422, rejection.errors, rejection.code));
    if (screen.action !== 'leave') throw new Error('rejection');
    const cases = load('show-if-cases');
    for (const item of cases.conditions) if (sdk.conditionHolds(item.condition, {form: item.form}) !== item.expect) throw new Error(item.name);
  `;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], {stdio: 'pipe'});
});

test('earlier answers from the session reveal questions after a refresh and are not sent again', async () => {
  const info = JSON.parse(await readFile(new URL('./fixtures/questionnaire-earlier-answers-session.json', import.meta.url))).data;
  const earlier = earlierAnswers(info);
  assert.deepEqual(earlier, info.profile.form_answers);
  assert.equal(nextStep(info), 'questions');
  assert.deepEqual(visibleQuestions(info.profile.form_schema, {}, earlier).map(item => item.key), ['employer']);
  assert.deepEqual(visibleQuestions(info.profile.form_schema, {}).map(item => item.key), []);
  assert.equal(answerProblems(info.profile.form_schema, {}, earlier).employer.key, 'questions.required');
  assert.deepEqual(answersPayload(info.profile.form_schema, {employer: 'Acme'}, earlier), {employer: 'Acme'});
  assert.deepEqual(earlierAnswers({...info, profile: {...info.profile, form_answers: undefined}}, {employment: 'Student'}), {employment: 'Student'});
});

test('clearing an answer that was asked again hides its follow ups and clears it on the server', () => {
  const questions = [question('sources'), question('sources_other')];
  const earlier = {sources: ['Other']};
  const answers = startingAnswers(questions, earlier);
  assert.deepEqual(answers, {sources: ['Other']});
  assert.deepEqual(visibleQuestions(questions, answers, earlier).map(item => item.key), ['sources', 'sources_other']);
  delete answers.sources;
  assert.deepEqual(visibleQuestions(questions, answers, earlier).map(item => item.key), ['sources']);
  assert.deepEqual(answerProblems(questions, answers, earlier), {});
  assert.deepEqual(answersPayload(questions, answers, earlier), {sources: null});
  assert.deepEqual(answersPayload([question('sources_other')], {}, {sources: ['Salary']}), {});
});

test('a form of optional questions left empty sends an empty object', () => {
  const optional = schema.filter(item => !item.required && !item.show_if);
  assert.ok(optional.length > 1);
  assert.deepEqual(answerProblems(optional, {}), {});
  assert.deepEqual(answersPayload(optional, {}), {});
});

test('choices are sent exactly as configured', () => {
  const employment = {...question('employment'), options: [' Employed ', 'Student']};
  assert.deepEqual(answerProblems([employment], {employment: ' Employed '}), {});
  assert.deepEqual(answersPayload([employment], {employment: ' Employed '}), {employment: ' Employed '});
});

test('tiny and huge number bounds compare exactly', () => {
  const income = {...question('income'), show_if: null, min: null, max: 0.0000001};
  const problem = value => answerProblems([income], {income: value}).income?.key ?? null;
  assert.equal(problem('0.0000001'), null);
  assert.equal(problem('0.0000001000000000000000000001'), 'questions.number_max');
  const large = {...income, max: 1e21};
  assert.equal(answerProblems([large], {income: '1000000000000000000000'}).income, undefined);
  assert.equal(answerProblems([large], {income: '1000000000000000000000.1'}).income.key, 'questions.number_max');
});

test('a revealed question of an unknown type hands the form to the host', () => {
  const future = {...question('employer'), type: 'signature'};
  const questions = [question('employment'), future];
  assert.ok(canAskQuestions(questions));
  assert.ok(!canAskQuestions(questions, {}, {employment: 'Employed'}));
  assert.ok(!canAskQuestions(questions, {employment: 'Employed'}));
});

const reference = await (async () => {
  for (const base of ['../.sdk-spec/', '../../sdk-spec/']) {
    try { return await import(new URL(`${base}scripts/conditions.mjs`, import.meta.url)); } catch {}
  }
  return null;
})();

test('conditions agree with the spec reference evaluator on edge inputs', {skip: !reference && 'the spec checkout is not available'}, () => {
  const inputs = [
    ['regex', '\\d+', '\u0663\u0664'], ['regex', '^\\p{Nd}+$', '\u0663\u0664'], ['regex', '^[0-9]$', '\uff11'],
    ['equals', '1e400', '1e401'], ['gt', '1e400', '1'], ['lt', '-1e400', '0'], ['equals', 'Infinity', 'Infinity'],
    ['equals', ' 10 ', '10'], ['contains', 'Ä', '\u0041\u0308'], ['equals', '\u00c5', '\u0041\u030a'],
    ['fuzzy_match', {text: 'J\u00f6rg  M\u00fcller'}, 'jorg muller'], ['fuzzy_match', {text: '\ud83d\ude00 Acme'}, '\ud83d\ude00 acme'],
    ['fuzzy_match', {text: 'Acme'}, '\ud800 acme'], ['contains', '\u0130', 'i\u0307'],
  ];
  const cases = [...cases_conditions(), ...inputs.map(([op, value, answer]) => ({condition: {path: 'form.q', op, value}, form: {q: answer}}))];
  for (const item of cases) assert.equal(conditionHolds(item.condition, {form: item.form}), reference.test(item.condition, {form: item.form}), JSON.stringify(item));
});

function cases_conditions() { return cases.conditions; }

test('fuzzy matching does not need TextEncoder', () => {
  const script = `
    delete globalThis.TextEncoder;
    const sdk = await import(${JSON.stringify(new URL('../dist/index.js', import.meta.url).href)});
    const {readFileSync} = await import('node:fs');
    const cases = JSON.parse(readFileSync(${JSON.stringify(new URL('./fixtures/show-if-cases.json', import.meta.url).pathname)}, 'utf8'));
    for (const item of cases.conditions.filter(item => item.condition.op === 'fuzzy_match')) {
      if (sdk.conditionHolds(item.condition, {form: item.form}) !== item.expect) throw new Error(item.name);
    }
    if (Math.round(sdk.similarity('\u{1F600}a', '\u{1F600}b')) !== 80) throw new Error('bytes');
  `;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], {stdio: 'pipe'});
  assert.equal(similarity('\ud800', '\ufffd'), 100);
});
