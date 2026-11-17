// Property-based tests for the Halloween item unlock rules (R4, R15).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { ITEM_IDS } from '../game/halloween/items.ts';
import { EXAM_TRACKS, START_ITEMS, allExamsPassed, isItemUnlocked, isPassingScore, unlockText } from '../game/sim/unlock.ts';

const subset = fc.subarray([...EXAM_TRACKS]);

test('there are 15 items: 5 open at the start and 10 that open after the exams', () => {
  assert.equal(ITEM_IDS.length, 15);
  assert.equal(START_ITEMS.length, 5);
  assert.equal(new Set(START_ITEMS).size, 5);
  for (const id of START_ITEMS) assert.ok(ITEM_IDS.includes(id));
});

test('R15.1 the first five items are always open, whatever exams are passed', () => {
  fc.assert(fc.property(subset, passed => {
    for (const id of START_ITEMS) assert.equal(isItemUnlocked(id, passed), true);
  }));
});

test('R15.2 the other ten open only when every mock exam is passed', () => {
  fc.assert(fc.property(subset, passed => {
    const all = EXAM_TRACKS.every(t => passed.includes(t));
    for (const id of ITEM_IDS.filter(i => !START_ITEMS.includes(i))) assert.equal(isItemUnlocked(id, passed), all);
    assert.equal(allExamsPassed(passed), all);
  }));
});

test('R15.3 passing more exams never closes an item', () => {
  fc.assert(fc.property(subset, subset, (a, b) => {
    const more = [...new Set([...a, ...b])];
    for (const id of ITEM_IDS) if (isItemUnlocked(id, a)) assert.equal(isItemUnlocked(id, more), true);
  }));
});

test('R15.4 a mock exam passes at 80% or more', () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 50 }), fc.integer({ min: 0, max: 50 }), (total, correct) => {
    const c = Math.min(correct, total);
    assert.equal(isPassingScore(c, total), c / total >= 0.8);
  }));
});

test('R15.5 the locked-item text names the exams still missing, or says all are open', () => {
  fc.assert(fc.property(subset, passed => {
    const text = unlockText(passed), missing = EXAM_TRACKS.filter(t => !passed.includes(t));
    if (missing.length === 0) assert.match(text, /All 15 items are open/);
    else { assert.match(text, /80%/); assert.match(text, /Still to pass: /); }
  }));
});
