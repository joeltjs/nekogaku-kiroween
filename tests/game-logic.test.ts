// Property-based tests for the house's pure logic (R6, R9, R1.3, R2.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { MS_PER_DAY, MS_PER_HOUR, START_HOUR, arcadeClock, darkness, phaseOf } from '../game/sim/clock.ts';
import { MAX_LEVEL, MAX_LOVE, clampLove, expFor, levelOf, levelProgress, rewardForQuiz } from '../game/sim/progress.ts';
import { WALK, clampToFloor, onFloor } from '../game/sim/room.ts';

const ms = fc.double({ min: 0, max: MS_PER_DAY * 400, noNaN: true });

test('R9.3 the arcade hour is always in [0, 24) and minutes in [0, 59]', () => {
  fc.assert(fc.property(ms, t => {
    const c = arcadeClock(t);
    assert.ok(c.hour >= 0 && c.hour < 24 && c.hours >= 0 && c.hours < 24, `hour ${c.hours}`);
    assert.ok(c.minute >= 0 && c.minute <= 59);
    assert.ok(c.day >= 1);
  }));
});

test('R9.3 arcade time moves forward: later play never shows an earlier moment', () => {
  fc.assert(fc.property(ms, fc.double({ min: 0, max: MS_PER_DAY * 3, noNaN: true }), (t, dt) => {
    const a = arcadeClock(t), b = arcadeClock(t + dt);
    assert.ok(b.day * 24 + b.hours >= a.day * 24 + a.hours - 1e-6);
  }));
});

test('R9.1 one in-game day lasts 10 real minutes and a new house starts at 18:00', () => {
  assert.equal(MS_PER_DAY, 10 * 60 * 1000);
  assert.equal(arcadeClock(0).hour, START_HOUR);
  fc.assert(fc.property(ms, t => { assert.equal(arcadeClock(t + MS_PER_DAY).day, arcadeClock(t).day + 1); }));
  assert.equal(arcadeClock(MS_PER_HOUR * 6).hour, 0); // 18:00 + 6 h = midnight, the witching hour
  assert.equal(arcadeClock(MS_PER_HOUR * 6).phase, 'witching');
});

test('R9.2 every hour has a phase and a darkness between 0 and 1', () => {
  fc.assert(fc.property(fc.double({ min: -100, max: 100, noNaN: true }), h => {
    assert.ok(['day', 'dusk', 'night', 'witching', 'dawn'].includes(phaseOf(h)));
    const d = darkness(h); assert.ok(d >= 0 && d <= 1);
  }));
});

test('R6.2 the level stays in 1..15 and never drops when EXP grows', () => {
  fc.assert(fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), fc.double({ min: 0, max: 1e5, noNaN: true }), (e, more) => {
    const a = levelOf(e), b = levelOf(e + more);
    assert.ok(a >= 1 && a <= MAX_LEVEL);
    assert.ok(b >= a);
  }));
});

test('R6.2 level thresholds agree with levelOf', () => {
  for (let n = 1; n <= MAX_LEVEL; n++) { assert.equal(levelOf(expFor(n)), n); if (n > 1) assert.equal(levelOf(expFor(n) - 1), n - 1); }
  fc.assert(fc.property(fc.integer({ min: 0, max: expFor(MAX_LEVEL) * 2 }), e => {
    const p = levelProgress(e);
    assert.ok(p.ratio >= 0 && p.ratio <= 1);
    if (p.level < MAX_LEVEL) assert.ok(p.into >= 0 && p.into < p.span);
  }));
});

test('R6.4 Love stays within 0..10 whatever is added', () => {
  fc.assert(fc.property(fc.double({ noNaN: false }), x => { const l = clampLove(x); assert.ok(l >= 0 && l <= MAX_LOVE); }));
});

test('R10.6 quiz EXP is bounded and rewards a perfect score', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 50 }), fc.integer({ min: 1, max: 50 }), (c, t) => {
    const e = rewardForQuiz(c, t);
    assert.ok(e >= 0 && e <= t * 4 + 10);
    if (c >= t) assert.equal(e, t * 4 + 10);
  }));
});

test('R1.3 R2.3 a dropped cat always lands on the floor', () => {
  fc.assert(fc.property(fc.double({ noNaN: false }), fc.double({ noNaN: false }), (x, y) => {
    const p = clampToFloor({ x, y });
    assert.ok(onFloor(p), JSON.stringify(p));
    assert.deepEqual(clampToFloor(p), p);
  }));
  assert.ok(WALK.x0 < WALK.x1 && WALK.y0 < WALK.y1);
});
