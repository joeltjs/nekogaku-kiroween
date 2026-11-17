import { clamp, lerp, smooth } from '../core/math';

/**
 * A joyful hop with weight. A cat that only rises and falls
 * looks like a card on a string, so the hop has the four things a body does: it crouches to load (squash, head dips, ears
 * back), pushes off and stretches, hangs at the top, then lands with a squash that wobbles out and settles. The body keeps its
 * volume (squashed = wider, stretched = narrower). `u` is the seconds since the hop began; `power` 0..1+ scales the depth and height.
 */
export const HOP = { crouch: .2, air: .5, settle: .55 };
export const HOP_LEN = HOP.crouch + HOP.air + HOP.settle;
/** The lift at the top of a full hop, in the cat's own units (about a fifth of its sitting height). */
export const HOP_HEIGHT = 20;

export interface HopFrame {
  /** Feet off the floor. */
  lift: number; squashY: number; squashX: number;
  /** 0..1: how far into the crouch (head dips, ears go back). */
  load: number;
  /** 0..1: in the air (eyes smile, mouth opens, tail flicks up). */
  air: number;
}
const REST: HopFrame = { lift: 0, squashY: 1, squashX: 1, load: 0, air: 0 };
const wider = (squashY: number) => 1 + (1 - squashY) * .8;

export function hopFrame(u: number, power = 1): HopFrame {
  if (!(u > 0) || u >= HOP_LEN) return REST;
  const { crouch, air, settle } = HOP, dip = .12 * power, stretch = .07 * power;
  if (u < crouch) {
    const squashY = 1 - dip * smooth(u / crouch);
    return { lift: 0, squashY, squashX: wider(squashY), load: smooth(u / crouch), air: 0 };
  }
  if (u < crouch + air) {
    const a = (u - crouch) / air;
    // Out of the crouch into a stretch, then easing back toward its own size on the way up and down.
    const squashY = lerp(1 - dip, 1 + stretch, smooth(a / .22)) - stretch * .7 * smooth((a - .3) / .7);
    return { lift: 4 * a * (1 - a) * HOP_HEIGHT * power, squashY, squashX: wider(squashY), load: 0, air: Math.sin(Math.PI * a) };
  }
  const s = (u - crouch - air) / settle;
  const flyEnd = 1 + stretch * .3, hit = 1 - .18 * power * Math.exp(-4.2 * s) * Math.cos(2 * Math.PI * 1.4 * s);
  // The impact takes three frames: a landing is a snap, then the wobble.
  const squashY = lerp(flyEnd, hit, smooth(s / .09));
  return { lift: 0, squashY, squashX: wider(squashY), load: clamp((1 - squashY) * 6, 0, 1), air: 0 };
}

/**
 * When a pleased cat that is sitting still hops: once every six seconds or so (a little different for each cat, so two
 * cats on one screen do not hop together), never in a row. Seconds into the current hop, or -1 between hops.
 */
export function hopClock(age: number, seed: number) {
  const every = 6 + (Math.abs(seed) % 7) * .15, c = ((age - .15) % every + every) % every;
  return age >= .15 && c < HOP_LEN ? c : -1;
}
export const hopEvery = (seed: number) => 6 + (Math.abs(seed) % 7) * .15;
