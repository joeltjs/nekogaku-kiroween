// Property-based tests for album slots: one slot per cat and costume, opened on first use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { SLOT_CATS, SLOT_COSTUMES, SLOT_COUNT, cleanSlots, isSlotKey, openSlot, slotCount, slotKey } from '../game/sim/album.ts';

const cat = fc.constantFrom(...SLOT_CATS);
const costume = fc.constantFrom(...SLOT_COSTUMES);

test('there are 3 cats x 6 costumes = 18 slots', () => {
  assert.equal(SLOT_COUNT, 18);
  assert.equal(new Set(SLOT_CATS.flatMap(c => SLOT_COSTUMES.map(k => slotKey(c, k)))).size, 18);
});

test('the first use of a costume opens its slot and reports it as fresh', () => {
  const r = openSlot([], 'kuku', 'vampire');
  assert.equal(r.fresh, true);
  assert.deepEqual(r.open, ['kuku:vampire']);
});

test('a second use of the same cat and costume does not open anything new', () => {
  fc.assert(fc.property(cat, costume, (c, k) => {
    const first = openSlot([], c, k);
    const again = openSlot(first.open, c, k);
    assert.equal(again.fresh, false);
    assert.deepEqual(again.open, first.open);
  }));
});

test('slots are per cat: the same costume on another cat is still a new slot', () => {
  fc.assert(fc.property(cat, cat, costume, (a, b, k) => {
    fc.pre(a !== b);
    const first = openSlot([], a, k);
    assert.equal(openSlot(first.open, b, k).fresh, true);
  }));
});

test('opening slots never removes one that is already open', () => {
  fc.assert(fc.property(fc.array(fc.tuple(cat, costume), { maxLength: 30 }), uses => {
    let open: string[] = [];
    for (const [c, k] of uses) {
      const before = [...open];
      open = openSlot(open, c, k).open;
      for (const key of before) assert.ok(open.includes(key));
    }
    assert.equal(new Set(open).size, open.length);
    assert.ok(slotCount(open) <= SLOT_COUNT);
  }));
});

test('an unknown cat or costume never opens a slot', () => {
  const r = openSlot(['kuku:vampire'], 'nobody' as never, 'vampire');
  assert.equal(r.fresh, false);
  assert.deepEqual(r.open, ['kuku:vampire']);
});

test('saved slot data keeps only real, unique keys', () => {
  assert.deepEqual(cleanSlots(['kuku:vampire', 'kuku:vampire', 'x:y', 3, null, 'bolu:mummy']), ['kuku:vampire', 'bolu:mummy']);
  assert.deepEqual(cleanSlots('not a list'), []);
  assert.deepEqual(cleanSlots(undefined), []);
  assert.equal(isSlotKey('cecil:witch'), true);
  assert.equal(isSlotKey('cecil:broom'), false);
});
