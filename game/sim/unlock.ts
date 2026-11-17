/**
 * Which Halloween items a player can use. Five are open from the start. The other ten open together
 * once every mock exam (JLPT N5 to N1, SSW Kaigo, SSW Food) has been passed with PASS_PERCENT or more.
 * Pure functions, shared by the game and the grimoire.
 */
import type { ItemId } from '../halloween/items';

export const EXAM_TRACKS = ['n5', 'n4', 'n3', 'n2', 'n1', 'kaigo', 'food'] as const;
export const PASS_PERCENT = 80;
export const START_ITEMS: readonly ItemId[] = ['bed', 'candles', 'coffin', 'sheet', 'broom'];

const NAMES: Record<string, string> = { n5: 'JLPT N5', n4: 'JLPT N4', n3: 'JLPT N3', n2: 'JLPT N2', n1: 'JLPT N1', kaigo: 'SSW Kaigo', food: 'SSW Food' };
export const trackName = (id: string) => NAMES[id] ?? id;

/** A mock exam counts when the best score is PASS_PERCENT or more. */
export const isPassingScore = (correct: number, total: number) => total > 0 && correct * 100 >= total * PASS_PERCENT;

export function examsPassed(passed: readonly string[]): string[] {
  return EXAM_TRACKS.filter(t => passed.includes(t));
}
export const allExamsPassed = (passed: readonly string[]) => examsPassed(passed).length === EXAM_TRACKS.length;

export function isItemUnlocked(id: ItemId, passed: readonly string[]): boolean {
  return START_ITEMS.includes(id) || allExamsPassed(passed);
}

/** The sentence a locked item shows: how to open it, and what is still missing. */
export function unlockText(passed: readonly string[]): string {
  const left = EXAM_TRACKS.filter(t => !passed.includes(t)).map(trackName);
  if (!left.length) return 'Every mock exam passed. All 15 items are open.';
  const done = EXAM_TRACKS.length - left.length;
  return `Pass the mock exam with ${PASS_PERCENT}% or more on every track to open 10 more items. ${done} of ${EXAM_TRACKS.length} passed. Still to pass: ${left.join(', ')}.`;
}
