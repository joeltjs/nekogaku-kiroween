// Property-based tests for the grimoire's quiz builder (R10.5) and access codes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { buildExam, buildQuiz, makeQuestion, rng } from '../lib/quiz.js';
import { newCode, normalizeCode } from '../lib/accounts.js';
import { buildContent } from '../lib/content-build.js';

const text = fc.string({ minLength: 0, maxLength: 12 });
const card = fc.record({ jp: fc.string({ minLength: 1, maxLength: 6 }), reading: text, en: fc.string({ minLength: 1, maxLength: 20 }) });
const unitArb = fc.record({ id: fc.string({ minLength: 1, maxLength: 10 }), kind: fc.constantFrom('vocab', 'kanji', 'grammar'), cards: fc.array(card, { minLength: 0, maxLength: 25 }) });

function valid(q) {
  assert.ok(q.options.length >= 2 && q.options.length <= 4, `options ${q.options.length}`);
  assert.equal(new Set(q.options).size, q.options.length, 'duplicate options');
  assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, 'answer index');
  assert.equal(q.notes.length, q.options.length);
}

test('R10.5 a question has exactly one correct option and no duplicates', () => {
  fc.assert(fc.property(text, fc.array(text, { maxLength: 8 }), fc.integer(), (right, wrong, seed) => {
    const q = makeQuestion({ prompt: 'p', correct: right, distractors: wrong }, rng(seed));
    if (!q) return; // no distinct distractor: no question at all
    valid(q);
    assert.equal(q.options.filter(o => o === right.trim()).length, 1);
  }));
});

test('R10.5 every quiz from any unit is valid and deterministic for a seed', () => {
  fc.assert(fc.property(unitArb, fc.integer({ min: 0, max: 1e6 }), (unit, seed) => {
    const a = buildQuiz(unit, seed), b = buildQuiz(unit, seed);
    assert.deepEqual(a, b);
    assert.ok(a.length <= 10);
    a.forEach(valid);
  }), { numRuns: 300 });
});

test('R10.5 the real curriculum: every unit gives a full, valid quiz with an explanation', () => {
  const { units } = buildContent();
  let questions = 0;
  for (const u of units) {
    const qs = buildQuiz(u, 7, { count: 10 });
    assert.ok(qs.length >= Math.min(4, u.cards.length - 1), `${u.id} only ${qs.length} questions`);
    for (const q of qs) { valid(q); assert.ok(q.explain.length > 0, `${u.id}: no explanation for ${q.prompt}`); questions++; }
  }
  assert.ok(questions > 4000, `${questions} questions`);
});

test('a mock exam mixes units and stays valid', () => {
  const { units } = buildContent();
  fc.assert(fc.property(fc.integer({ min: 0, max: units.length - 10 }), fc.integer(), (start, seed) => {
    const exam = buildExam(units.slice(start, start + 10), seed, 20);
    assert.ok(exam.length >= 10 && exam.length <= 20);
    exam.forEach(valid);
  }), { numRuns: 40 });
});

test('access codes: generated codes normalise to themselves, sloppy typing still works', () => {
  fc.assert(fc.property(fc.constant(0), () => {
    const c = newCode();
    assert.match(c, /^NEKO-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal(normalizeCode(c), c);
    assert.equal(normalizeCode(c.toLowerCase()), c);
    assert.equal(normalizeCode(c.replace(/-/g, '')), c);
  }), { numRuns: 200 });
  fc.assert(fc.property(fc.string(), s => { const n = normalizeCode(s); assert.ok(n === null || /^NEKO-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(n)); }));
});
