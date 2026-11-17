/**
 * What a cat does when it has nothing to do (R2.4): wander, sit and groom, nap (more at night),
 * hop on the sofa, or use an item that suits it (R4.4).
 */
import type { ClipName } from '../art/cat-clips';
import { weightedPick } from '../core/math';
import { ITEMS } from '../halloween/items';
import { SOFA, randomFloorPoint } from './room';
import type { Cat, World } from './world';

const IDLE_CLIPS: ClipName[] = ['sit', 'groom', 'stand', 'loaf', 'tailFlick', 'yawn', 'stretch', 'lookUp', 'sitBack'];
const NAP_CLIPS: ClipName[] = ['sleep', 'sleepSide', 'sleepLoaf', 'sleepBelly'];

/** Each cat's habits: Bolu naps a lot, Kuku plays, Cecil sits about and judges. */
const HABITS: Record<string, { wander: number; item: number; nap: number; sit: number; sofa: number }> = {
  cecil: { wander: 2, item: 3, nap: 2, sit: 4, sofa: 2 },
  kuku: { wander: 4, item: 4, nap: 1.5, sit: 2, sofa: 1 },
  bolu: { wander: 2, item: 3, nap: 4, sit: 2, sofa: 2 },
};

export function think(w: World, cat: Cat) {
  const t = w.time, night = w.isNight, h = HABITS[cat.id];
  // A flying costume wants to fly again now and then.
  if (cat.costume && (cat.costume === 'bat' || cat.costume === 'witch') && w.rand() < .55) { w.takeOff(cat); return; }
  // Costume items are mostly for the player to give; on their own the cats use them now and then.
  const free = w.items.filter(i => !i.worn && w.usersOf(i.uid).length === 0 && (!ITEMS[i.id].use.costume || (!cat.costume && w.rand() < .25)));
  const sofaTaken = w.cats.some(c => c !== cat && c.act.k === 'sofa');
  const choice = weightedPick<'wander' | 'item' | 'nap' | 'sit' | 'sofa'>([
    ['wander', h.wander], ['item', free.length ? h.item : 0], ['nap', h.nap * (night ? 2.5 : 1)], ['sit', h.sit], ['sofa', sofaTaken ? 0 : h.sofa],
  ], w.rand) ?? 'sit';
  cat.intensity = 1;
  if (choice === 'wander') {
    const to = randomFloorPoint(w.rand);
    cat.act = { k: 'walk', to, run: false, then: { k: 'idle', until: t + 1.5 + w.rand() * 3 } };
    return;
  }
  if (choice === 'item') {
    const it = free[Math.floor(w.rand() * free.length)], u = ITEMS[it.id].use;
    const side = Math.sign(cat.x - it.x) || 1, at = { x: it.x + (u.z > 30 || u.rim ? 0 : side * Math.abs(u.dx)), y: it.y + (u.z > 30 ? 40 : u.rim ? 30 : u.dy) };
    const stay = u.stay[0] + w.rand() * (u.stay[1] - u.stay[0]) * (u.sleep && night ? 1.6 : 1);
    cat.act = { k: 'walk', to: at, run: false, then: { k: 'use', item: it.uid, until: t + stay + 2 } };
    return;
  }
  if (choice === 'sofa') {
    const x = SOFA.x0 + 40 + w.rand() * (SOFA.x1 - SOFA.x0 - 80);
    cat.act = { k: 'walk', to: { x, y: SOFA.y + 70 }, run: false, then: { k: 'sofa', until: t + 10 + w.rand() * 14 } };
    return;
  }
  if (choice === 'nap') {
    w.setClip(cat, NAP_CLIPS[Math.floor(w.rand() * NAP_CLIPS.length)], .5);
    cat.act = { k: 'idle', until: t + 12 + w.rand() * (night ? 22 : 12) };
    return;
  }
  w.setClip(cat, IDLE_CLIPS[Math.floor(w.rand() * IDLE_CLIPS.length)], .3);
  cat.act = { k: 'idle', until: t + 3 + w.rand() * 5 };
  if (w.rand() < .15) { w.mark(cat, 'dots', 1.2); }
}
