/**
 * Album slots: one slot per cat and costume. A slot opens the first time that cat wears that
 * costume. Pure functions, so the rules can be tested without the DOM.
 */
import type { CatId } from '../art/cat-look';
import type { CostumeId } from '../halloween/items';

export const SLOT_CATS: readonly CatId[] = ['cecil', 'kuku', 'bolu'];
export const SLOT_COSTUMES: readonly CostumeId[] = ['vampire', 'ghost', 'werewolf', 'bat', 'witch', 'mummy'];
export const SLOT_COUNT = SLOT_CATS.length * SLOT_COSTUMES.length;

export const slotKey = (cat: CatId, costume: CostumeId) => `${cat}:${costume}`;

const VALID = new Set(SLOT_CATS.flatMap(c => SLOT_COSTUMES.map(k => slotKey(c, k))));
export const isSlotKey = (key: unknown): key is string => typeof key === 'string' && VALID.has(key);

/** Keeps only real, unique slot keys from saved data. */
export function cleanSlots(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isSlotKey))];
}

/** Opens the slot for a cat and costume. `fresh` is true only on the first opening. */
export function openSlot(open: readonly string[], cat: CatId, costume: CostumeId): { open: string[]; fresh: boolean } {
  const key = slotKey(cat, costume);
  if (!isSlotKey(key) || open.includes(key)) return { open: [...open], fresh: false };
  return { open: [...open, key], fresh: true };
}

export const slotCount = (open: readonly string[]) => open.filter(isSlotKey).length;
