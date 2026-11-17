/**
 * motion as
 * runs of whole drawings, the way the reference style plays its sprites, instead of sums of sine waves.
 *
 * A drawing here is a `Pose`: the mould (cat-mold.ts) turns it into one closed silhouette, and the same pose always gives the same
 * mould, so a run of frames costs a handful of moulds that stay in the cache. A sequence is a list of frames, each a key drawing or an
 * in-between drawn between two keys, each held for a fixed time (`Seq`). In-betweens are made once, when the game loads, with the
 * things an animator does by hand: the body eases into the key, and the tail and ears arrive a drawing later (follow-through). Nothing
 * is blended while the game runs, so no shape is ever shown that is not in the list (and the tests look at every one of them).
 *
 * Walking is a list too, but the drawing is picked by the distance walked, not by the clock: a planted paw then stays on its spot at
 * any speed (`GAITS`, `gaitFrame`, `gaitCycle`).
 */
import { lerpPose, pose, STAND, type Pose } from './cat-rig';

export interface Frame {
  pose: Pose;
  /** Seconds this drawing is shown. */
  hold: number;
  name: string;
  /** A deliberate change of drawing (the cat turns to another view): the silhouette may jump here. */
  cut?: boolean;
}

/** A run of frames with fixed times. `loop`: it starts again after the last frame; otherwise the last frame stays. */
export class Seq {
  readonly starts: number[] = [];
  readonly length: number;
  constructor(readonly frames: Frame[], readonly loop = false) {
    let t = 0;
    for (const f of frames) { this.starts.push(t); t += f.hold; }
    this.length = t;
  }
  index(t: number) {
    const u = this.loop ? ((t % this.length) + this.length) % this.length : t;
    let i = 0;
    while (i + 1 < this.frames.length && this.starts[i + 1] <= u + 1e-9) i++;
    return i;
  }
  at(t: number): Pose { return this.frames[this.index(t)].pose; }
}

const ease = {
  /** Slow out of the first key and slow into the next. */
  inout: (u: number) => u * u * (3 - 2 * u),
  /** Fast away, slow into the key (settling into a pose). */
  out: (u: number) => 1 - (1 - u) * (1 - u),
  /** Slow away, fast into the key (a wind-up released). */
  in: (u: number) => u * u,
  linear: (u: number) => u,
};
/** What trails the body by one drawing: the tail and the ears (follow-through). */
const LATE = ['tailA', 'tailBend', 'tailTip', 'tailSway', 'ears'] as const;

/** One key drawing, held. */
export const key = (p: Pose, hold: number, name: string, cut = false): Frame => ({ pose: p, hold, name, cut });

/**
 * `n` in-between drawings from key `a` toward key `b`, each shown `dur` seconds. The body is eased (`how`); the tail and ears are drawn
 * one in-between behind, so they are still arriving when the body is there. Eyes and mouth change with the later half.
 */
export function between(a: Pose, b: Pose, n: number, dur: number, name: string, how: keyof typeof ease = 'inout'): Frame[] {
  const out: Frame[] = [];
  for (let j = 1; j <= n; j++) {
    const u = ease[how](j / (n + 1)), late = ease[how]((j - 1) / (n + 1));
    const p = lerpPose(a, b, u), q = p as unknown as Record<string, number>;
    for (const k of LATE) q[k] = a[k] + (b[k] - a[k]) * late;
    out.push({ pose: p, hold: dur, name: `${name}${n > 1 ? j : ''}` });
  }
  return out;
}

/** The same pose with a few things changed (a settle: the tail swung past and back, the ears back up). */
export const alter = (p: Pose, o: Partial<Pose>): Pose => ({ ...p, ...o });

// ———————————————————————————————————————— walking

export interface Gait {
  /** Drawings in one cycle. */
  frames: number;
  /** How far a paw travels on the ground in one step (drawing units). */
  stride: number;
  /** How high a paw lifts as it swings forward. */
  lift: number;
  /** Frames a paw stays on the ground. */
  stance: number;
  /** When each paw lands, in frames: near hind, near fore, far hind, far fore. */
  offsets: readonly [number, number, number, number];
}
/**
 * `slow`: a cat's walk, one paw at a time (near hind, near fore, far hind, far fore), three paws down most of the time; hips and
 * shoulders rise in turn, so the back rocks (the waddle). One cycle carries an adult 18 px: at the reference style's stroll of 18 px/s that is its four
 * key drawings of 0.25 s. `walk`: brisker, the paws in diagonal pairs (a trot), the body bobbing on every step. `run`: a gallop, the
 * hind paws landing together, then the fore paws, the back folding and stretching. `push`: the trot with the head down behind a ball.
 */
export const GAITS = {
  slow: { frames: 8, stride: 10.4, lift: 2.6, stance: 5, offsets: [0, 2, 4, 6] },
  walk: { frames: 8, stride: 10.5, lift: 3.4, stance: 4, offsets: [0, 4, 4, 0] },
  run: { frames: 12, stride: 24, lift: 8, stance: 5, offsets: [0, 6, 1, 7] },
  push: { frames: 8, stride: 16, lift: 5, stance: 5, offsets: [0, 4, 4, 0] },
} as const satisfies Record<string, Gait>;
export type GaitName = keyof typeof GAITS;

/** Drawing units one whole cycle carries the body: while a paw is down for `stance` frames the body passes one stride over it. */
export const gaitCycle = (g: Gait) => g.stride * g.frames / g.stance;

/** Where a paw is at frame `k`: on the ground going back at the body's speed, or swinging forward on an arc. */
function pawAt(g: Gait, k: number, off: number, x0: number, y0: number, bodyLift: number): [number, number] {
  const u = (((k - off) % g.frames) + g.frames) % g.frames;
  // The ground is where it was: a body that rises (lift) stretches its planted legs instead of carrying the paws up.
  if (u <= g.stance) return [x0 + g.stride / 2 - g.stride * u / g.stance, y0 + bodyLift];
  const s = (u - g.stance) / (g.frames - g.stance);
  return [x0 - g.stride / 2 + g.stride * ease.inout(s), y0 + bodyLift - g.lift * Math.sin(s * Math.PI)];
}
function withPaws(p: Pose, g: Gait, k: number): Pose {
  const [bnX, bnY] = pawAt(g, k, g.offsets[0], p.bnX, p.bnY, p.lift), [fnX, fnY] = pawAt(g, k, g.offsets[1], p.fnX, p.fnY, p.lift);
  const [bfX, bfY] = pawAt(g, k, g.offsets[2], p.bfX, p.bfY, p.lift), [ffX, ffY] = pawAt(g, k, g.offsets[3], p.ffX, p.ffY, p.lift);
  return { ...p, bnX, bnY, fnX, fnY, bfX, bfY, ffX, ffY };
}

const TAU = Math.PI * 2;
const WALK_BASE = pose({ headTurn: .38, tailA: -1.9, tailBend: .12, tailTip: .5, tailWag: 0 });
const RUN_BASE = pose({ hx: -21, hy: -36, sx: 19, sy: -37, headX: 32, headY: -70, headTurn: .5, tailA: -2.9, tailBend: .06, tailTip: .3, eyeStyle: 'wide', lookX: .4, tailWag: 0 });
const PUSH_BASE = pose({ sx: 17, sy: -32, headX: 35, headY: -48, headRot: .22, headTurn: .5, lookY: .5, tailA: -2.2, eyeStyle: 'wide', tailWag: 0 });

function drawGait(name: GaitName): Pose[] {
  const g: Gait = GAITS[name], N = g.frames, out: Pose[] = [];
  for (let k = 0; k < N; k++) {
    const ph = k / N;
    let p: Pose;
    if (name === 'slow') {
      // Hips are highest when a hind leg stands straight under them (the middle of its time on the ground), shoulders likewise over a
      // fore leg, a quarter of a cycle later: the back rocks like a little boat. The head rides it at half, the tail swings behind.
      const mid = g.stance / N / 2, hips = .5 + .5 * Math.cos(2 * TAU * (ph - mid)), shoulders = .5 + .5 * Math.cos(2 * TAU * (ph - mid - .25));
      const d = 1.2 * (shoulders - hips);
      p = { ...WALK_BASE, lift: 1.3 * hips, sy: WALK_BASE.sy - d, headY: WALK_BASE.headY - d * .5, headRot: -.025 * Math.sin(TAU * (ph - .125)),
        tailSway: .7 * Math.sin(TAU * (ph - .3)), tailTip: .5 + .14 * Math.sin(TAU * (ph - .45)) };
    } else if (name === 'walk' || name === 'push') {
      // A diagonal pair lands at frames 0 and N/2: the body is lowest there and highest as the legs pass; the head nods a drawing
      // later, the tail swings once a cycle and its tip curls after it.
      const bob = [0, .7, 1, .75], b = bob[k % 4] * 1.6, prev = bob[(k + 3) % 4] * 1.6, base = name === 'walk' ? WALK_BASE : PUSH_BASE;
      p = { ...base, lift: b, sy: base.sy + (k % 4 === 0 ? .7 : k % 4 === 2 ? -.3 : 0), headY: base.headY + (b - prev) * .5, headRot: base.headRot - .03 * Math.sin(TAU * (ph - .125)),
        arch: base.arch + bob[k % 4] * .02, tailSway: .55 * Math.sin(TAU * (ph - .25)), tailTip: base.tailTip + .12 * Math.sin(TAU * (ph - .4)) };
      if (name === 'push') p.headX = base.headX + (k % 4 === 1 ? 1.2 : k % 4 === 3 ? -1.2 : 0);
    } else {
      // A gallop: the back folds as the hind paws come under (c > 0) and stretches as they push off (c < 0); the body leaves the ground
      // twice a cycle.
      const c = Math.cos(ph * TAU), s = Math.sin(ph * TAU);
      p = { ...RUN_BASE, hx: RUN_BASE.hx - c * 4, sx: RUN_BASE.sx + c * 4, arch: c * .08, hy: RUN_BASE.hy - Math.max(0, s) * 3, sy: RUN_BASE.sy - Math.max(0, -s) * 3,
        headY: RUN_BASE.headY - c * 1.4, lift: Math.abs(s) * 3, tailSway: .6 * Math.cos(TAU * (ph - 1 / N)), tailA: RUN_BASE.tailA + .08 * Math.cos(TAU * (ph - 2 / N)) };
    }
    out.push(withPaws(p, g, k));
  }
  return out;
}
const GAIT_FRAMES: Record<GaitName, Pose[]> = { slow: drawGait('slow'), walk: drawGait('walk'), run: drawGait('run'), push: drawGait('push') };

/** Which drawing of the cycle shows at `phase` (cycles walked so far). */
export const gaitIndex = (name: GaitName, phase: number) => { const n = GAITS[name].frames, i = Math.floor((phase - Math.floor(phase)) * n + 1e-6); return i >= n ? 0 : i; };
export const gaitFrame = (name: GaitName, phase: number): Pose => GAIT_FRAMES[name][gaitIndex(name, phase)];
export const gaitFrames = (name: GaitName): readonly Pose[] => GAIT_FRAMES[name];
/** How far into the current drawing the walk is, 0..1 (the renderer holds the cat at the spot where the drawing began: see World.stepBack). */
export const gaitInto = (name: GaitName, phase: number) => { const f = (phase - Math.floor(phase)) * GAITS[name].frames; return f - Math.floor(f + 1e-6); };

/**
 * The walk as it is shown: the drawing of the cycle the cat has reached, eased toward the next one by how far into it the walk is. A paw
 * on the ground moves back in a straight line at the body's speed between two drawings, so it stays on its spot at every moment (no
 * slide, and no jump when the drawing changes); the body's rise and the tail's swing pass through the keys the list holds.
 */
export function gaitPose(name: GaitName, phase: number): Pose {
  const list = GAIT_FRAMES[name], n = list.length, f = (phase - Math.floor(phase)) * n, i = Math.min(n - 1, Math.floor(f + 1e-6));
  return lerpPose(list[i], list[(i + 1) % n], Math.max(0, f - i));
}

export { STAND };
