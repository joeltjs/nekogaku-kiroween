/**
 * The only two stats a cat has (R6): EXP (which gives its level, 1..15, and so its age and size)
 * and Love (0..10 hearts). Pure functions, property-tested in tests/progress.test.ts.
 */
export const MAX_LEVEL = 15;
export const MAX_LOVE = 10;

/** Total EXP needed to reach `level` (level 1 needs 0). */
export function expFor(level: number): number {
  const n = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return 20 * (n - 1) * n + 20 * (n - 1);
}

export function levelOf(exp: number): number {
  const e = Number.isFinite(exp) && exp > 0 ? exp : 0;
  let level = 1;
  while (level < MAX_LEVEL && e >= expFor(level + 1)) level++;
  return level;
}

/** Progress inside the current level: EXP into it, EXP the level spans, 0..1. */
export function levelProgress(exp: number) {
  const level = levelOf(exp);
  if (level >= MAX_LEVEL) return { level, into: 0, span: 0, ratio: 1 };
  const lo = expFor(level), hi = expFor(level + 1), e = Math.max(0, exp);
  return { level, into: e - lo, span: hi - lo, ratio: (e - lo) / (hi - lo) };
}

export const clampLove = (love: number) => Math.max(0, Math.min(MAX_LOVE, Number.isFinite(love) ? love : 0));
export const clampExp = (exp: number) => Math.max(0, Math.min(expFor(MAX_LEVEL) * 2, Number.isFinite(exp) ? Math.round(exp) : 0));

/** EXP for a finished quiz: 4 per correct answer and 10 more for a perfect score. */
export function rewardForQuiz(correct: number, total: number): number {
  const t = Math.max(0, Math.floor(total)), c = Math.max(0, Math.min(t, Math.floor(correct)));
  return c * 4 + (t > 0 && c === t ? 10 : 0);
}

export const PET_LOVE = .15;
export const PLAY_LOVE = .1;

/** How long a Halloween costume lasts after a cat uses a costume item (seconds of play). */
export const COSTUME_SECONDS = 45;
