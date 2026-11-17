import { clamp, easeOut, lerp, smooth } from '../core/math';
import { lerpPose, pose, STAND, type Pose } from './cat-rig';
import { breathLevel, burst, earBeat, heldStep, tiltBeat } from './rhythm';
import { HOP_LEN, hopFrame } from './hop';
import { Seq, between, gaitPose, key } from './cat-frames';

/** Key poses. Clips blend between these and add small layered motion per body part. */
/** Side-view sitting, for actions that need the side rig (desk, barbell, bath, swatting): a wide haunch, leaning chest. */
export const SIDE_SIT = pose({ hx: -13, hy: -23, rh: 20, sx: 9, sy: -44, rs: 17.5, arch: -.04, headX: 14, headY: -80, headTurn: .3,
  fnX: 16, fnY: 0, ffX: 22, ffY: -1.5, bnX: 4, bnY: 0, bfX: 10, bfY: -1.5, thigh: 1, tailA: 1.5, tailBend: .12, tailTip: .55, tailLen: 42, tailFront: 1, tailWag: .25 });
/** the reference style sitting cat: hips right under the shoulders (a bell), round haunch, head toward the viewer, tail up behind. */
export const SIT = pose({ hx: -3, hy: -28, rh: 21.5, sx: 4, sy: -47, rs: 18.5, arch: 0, headX: 9, headY: -84, headTurn: .55, front: 1,
  fnX: 15, fnY: 0, ffX: 8, ffY: -1.5, bnX: -4, bnY: 0, bfX: 3, bfY: -1.5, thigh: 1, tailA: -2.95, tailBend: .13, tailTip: -.3, tailLen: 40, tailFront: 0, tailWag: .25 });
export const LOAF = pose({ hx: -17, hy: -19, rh: 18.5, sx: 14, sy: -21, rs: 17, arch: .12, headX: 24, headY: -50, headTurn: .1,
  fnX: 20, fnY: -3, ffX: 26, ffY: -4, bnX: -16, bnY: -4, bfX: -8, bfY: -5, tuck: 1, tuckBack: 1, tailA: 2.95, tailBend: -.3, tailTip: -.2, tailLen: 38, tailFront: 1, tailWag: .2 });
export const CURL = pose({ hx: -13, hy: -19, rh: 21.5, sx: 9, sy: -18, rs: 20, arch: .38, headX: 17, headY: -22, headRot: -.5, headScale: .92, headTurn: .05,
  eyeStyle: 'closed', tuck: 1, tuckBack: 1, fnX: 18, fnY: -3, ffX: 24, ffY: -4, bnX: -14, bnY: -4, bfX: -6, bfY: -5,
  tailA: 2.85, tailBend: -.4, tailTip: -.3, tailLen: 42, tailFront: 1, tailWag: .05 });
/** Lying on the side, belly toward the viewer, legs loose; the head turns with the body. */
// a longer, fuller tube with the head lower and a little smaller, laid further over, so its top
// meets the back line as in the reference style's `139` instead of standing up above it with a notch.
export const SIDE = pose({ hx: -25, hy: -16, rh: 18.5, sx: 12, sy: -18, rs: 19, arch: -.02, headX: 42, headY: -23, headRot: 1.05, headScale: .92, headTurn: .1,
  eyeStyle: 'closed', fnX: 34, fnY: -4, ffX: 40, ffY: -8, bnX: 2, bnY: -3, bfX: 9, bfY: -7, tailA: 3.1, tailBend: .03, tailTip: .2, tailLen: 42, tailWag: .1 });
/** On the back, paws curled on the chest, upside-down face. */
// on its back the cat is a round bun with its paws folded up, not a long log: a shorter, fuller body.
export const BELLY = pose({ hx: -15, hy: -18, rh: 18.5, sx: 9, sy: -18, rs: 17.5, arch: -.12, headX: 35, headY: -24, headRot: 3.0, headTurn: 0,
  eyeStyle: 'happy', fnX: 14, fnY: -46, ffX: 21, ffY: -44, bnX: -20, bnY: -46, bfX: -12, bfY: -44, tuck: .2, tuckBack: .15,
  tailA: 2.95, tailBend: .1, tailLen: 38, bellyUp: 1, blush: .6, tailWag: .15 });
/** Draped over a ball: hips and shoulders level, the back humped over the ball, head low in front, every paw hanging. */
export const DRAPE = pose({ hx: -17, hy: -24, rh: 17.5, sx: 15, sy: -25, rs: 16.5, arch: .3, headX: 37, headY: -30, headRot: .28, headTurn: .35,
  eyeStyle: 'happy', mouth: 'w', blush: .5, fnX: 27, fnY: 7, ffX: 33, ffY: 4, bnX: -27, bnY: 8, bfX: -21, bfY: 5,
  tailA: 2.5, tailBend: .12, tailTip: .5, tailLen: 38, tailWag: .3 });
/** Awake on the back: the head rests on its side on the floor,
 *  face upright and turned to us, as a cat lies when it rolls over to play. Asleep it may still lie with the face upside down (BELLY). */
// awake on its back the cat is the reference style's `095`, a bun
// with its legs folded onto the belly (soft bumps, one closed silhouette) and the head upright at the chest end, tipped back a little,
// looking at us.
export const BELLY_AWAKE = pose({ ...BELLY, rh: 20, rs: 19, headX: 40, headY: -34, headRot: -.32, headTurn: .5, tuck: 1, tuckBack: 1 });
/** On its back with the paws up in the air (playing, being petted): the same upright head. */
const BELLY_PAWS = pose({ ...BELLY_AWAKE, tuck: BELLY.tuck, tuckBack: BELLY.tuckBack });
/** Flat as a pancake, chin on the floor, legs splayed front and back ("ndlosor"). */
export const SPRAWL = pose({ hx: -26, hy: -13, rh: 13.5, sx: 14, sy: -13, rs: 13.5, arch: -.04, headX: 35, headY: -24, headRot: .06, headTurn: .05,
  eyeStyle: 'closed', fnX: 44, fnY: -3, ffX: 50, ffY: -5, bnX: -50, bnY: -3, bfX: -44, bfY: -5, tailA: 3.12, tailBend: .01, tailTip: .2, tailLen: 42, tailWag: .1 });
/** Prone and stretched out like a sleeping person, front legs reaching forward. */
export const SUPERMAN = pose({ hx: -30, hy: -14, rh: 14, sx: 10, sy: -14, rs: 14, arch: 0, headX: 22, headY: -26, headRot: .1, headTurn: .05,
  eyeStyle: 'closed', fnX: 72, fnY: -5, ffX: 78, ffY: -7, bnX: -56, bnY: -3, bfX: -50, bfY: -5, tailA: 3.14, tailBend: 0, tailLen: 44, tailWag: .08 });
/** Face-down puddle: only the back of the head shows. */
export const AWAY = pose({ hx: -22, hy: -15, rh: 16, sx: 14, sy: -15, rs: 16, arch: .1, headX: 26, headY: -27, headRot: .15, headBack: 1,
  tuck: 1, tuckBack: 1, eyeStyle: 'closed', tailA: 3.05, tailBend: -.05, tailTip: .4, tailLen: 40, tailWag: .1 });
export const CROUCH = pose({ hx: -19, hy: -26, rh: 17, sx: 16, sy: -21, rs: 15.5, arch: -.08, headX: 31, headY: -46, headTurn: .5, lookX: .6, eyeStyle: 'wide',
  fnX: 24, fnY: 0, ffX: 30, ffY: -1.5, bnX: -16, bnY: 0, bfX: -9, bfY: -1.5, tailA: 3.05, tailBend: .03, tailTip: .3, tailWag: 0 });
// The play bow (butt up, front paws reaching): shortened by about a fifth. It used to reach 72 units against a sitting cat's 45, and the cat
// seemed to balloon to a much bigger animal for a moment.
export const STRETCH = pose({ hx: -14, hy: -42, rh: 17, sx: 12, sy: -21, rs: 15, arch: -.25, headX: 30, headY: -35, headRot: .12, headTurn: .3,
  fnX: 34, fnY: 0, ffX: 40, ffY: -1.5, bnX: -18, bnY: 0, bfX: -12, bfY: -1.5, tailA: -1.85, tailBend: .1, tailTip: .5 });
export const REAR = pose({ hx: -6, hy: -24, rh: 17, sx: 3, sy: -58, rs: 15, headX: 5, headY: -92, headRot: -.05, headTurn: .4, pawOver: 1,
  fnX: 30, fnY: -66, ffX: 33, ffY: -74, bnX: -10, bnY: 0, bfX: -3, bfY: -1.5, thigh: .4, tailA: 2.5, tailBend: -.04, eyeStyle: 'squint' });
export const SQUAT = pose({ hx: -13, hy: -22, rh: 18.5, sx: 10, sy: -38, rs: 15, headX: 19, headY: -72, headTurn: .3,
  fnX: 13, fnY: 0, ffX: 19, ffY: -1.5, bnX: -2, bnY: -1, bfX: 4, bfY: -2.5, thigh: .9, tailA: -1.85, tailBend: -.02, tailTip: .2, eyeStyle: 'squint', ears: .25 });
/** Carried by the scruff like a kitten: body hangs, hind legs dangle, tail tucked. */
export const HELD = pose({ hx: 1, hy: -22, rh: 16, sx: 5, sy: -56, rs: 15, arch: -.15, headX: 9, headY: -86, headRot: -.06, headTurn: .1,
  fnX: 15, fnY: -30, ffX: 20, ffY: -32, bnX: -1, bnY: 3, bfX: 6, bfY: 1, tuck: .35, tailA: 1.65, tailBend: .1, tailTip: .7, tailLen: 40, tailFront: 1,
  eyeStyle: 'blank', ears: .2, tailWag: 0 });
export const LEAP = pose({ hx: -24, hy: -34, rh: 16, sx: 17, sy: -38, rs: 15, arch: -.1, headX: 34, headY: -68, headRot: -.1, headTurn: .5,
  fnX: 42, fnY: -28, ffX: 46, ffY: -31, bnX: -42, bnY: -18, bfX: -36, bfY: -20, tailA: 3.2, tailBend: -.02, eyeStyle: 'wide', tailWag: 0 });

type Key = readonly [number, Pose];
export function keyed(keys: readonly Key[], t: number): Pose {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) { const [t0, a] = keys[i - 1], [t1, b] = keys[i]; return lerpPose(a, b, smooth((t - t0) / (t1 - t0))); }
  }
  return keys[keys.length - 1][1];
}

const sin = Math.sin, TAU = Math.PI * 2;
/**
 * the small movements of a held pose play as the reference style plays its sprites: one part moves in a
 * few whole drawings, then rests; the others stay still meanwhile. The paces are in rhythm.ts (`REF_TIMING`); nothing here is a sine that
 * never stops.
 */
/** Body layer: one breath in five drawings (the ribcage swells, the head lifts a little), then a pause exhaled. */
function breathe(p: Pose, t: number, rate = 3.4, depth = .5): Pose {
  const b = breathLevel(t, 0, rate) * 2 - 1;
  return { ...p, rh: p.rh + b * depth, rs: p.rs + b * depth * .8, headY: p.headY - b * depth * .8, arch: p.arch + b * .01 };
}
/** Head layer: the eyes rest on a spot, go to the next in two drawings and rest there; now and then the head tilts, holds and comes back. */
const LOOKS = [0, -.5, 0, .45, 0, .25];
function glance(p: Pose, t: number, seed: number, amount = 1): Pose {
  const look = heldStep(t, seed, LOOKS), tilt = tiltBeat(t, seed + 3) * .05;
  return { ...p, lookX: p.lookX + look * amount, headRot: p.headRot + tilt * amount, headTurn: p.headTurn + look * .12 * amount };
}
/** Ear layer: an occasional flick of three drawings. */
function earFlick(p: Pose, t: number, seed: number): Pose {
  return { ...p, earTwitch: Math.max(p.earTwitch, earBeat(t, seed)) };
}
const idle = (p: Pose, t: number, seed: number, rate = 3.4) => earFlick(glance(breathe(p, t, rate), t, seed), t, seed);
/** the eyes rest on one spot for a few seconds, then move to the next in a quick glance and rest there. */
const GLANCES = [-.6, .15, .7, -.1, .45];
const heldGlance = (t: number, seed: number, _hold = 4.6) => heldStep(t, seed + 5, GLANCES);

export interface ClipInput { t: number; phase: number; seed: number; intensity: number }
export interface ClipSpec { loop: boolean; duration?: number; fn: (c: ClipInput) => Pose }

/** Diagonal trot: each paw plants, slides back, then lifts on an arc. */
function gait(base: Pose, phase: number, stride: number, lift: number, duty: number, offsets: [number, number, number, number]): Pose {
  const foot = (x: number, y: number, off: number) => {
    const u = ((phase + off) % 1 + 1) % 1;
    if (u < duty) return [x + stride / 2 - stride * (u / duty), y] as const;
    const s = (u - duty) / (1 - duty);
    return [x - stride / 2 + stride * smooth(s), y - lift * sin(s * Math.PI)] as const;
  };
  const [bnX, bnY] = foot(base.bnX, base.bnY, offsets[0]), [fnX, fnY] = foot(base.fnX, base.fnY, offsets[1]);
  const [bfX, bfY] = foot(base.bfX, base.bfY, offsets[2]), [ffX, ffY] = foot(base.ffX, base.ffY, offsets[3]);
  return { ...base, bnX, bnY, fnX, fnY, bfX, bfY, ffX, ffY };
}

function walkPose(phase: number, seed: number, t: number, slow = false): Pose {
  // the reference style waddle: quick short steps, a bouncy body, head turned to the viewer, tail up.
  const base = pose({ headTurn: .38, tailA: -1.9, tailBend: .12, tailTip: .5, tailWag: .7 });
  // the reference style's short stubs take short quick steps (stride 11 → 8.5); game/world/world.ts advances the phase per 23 px to match.
  const p = gait(base, phase, slow ? 6.5 : 8.5, slow ? 2.8 : 4, .58, [0, .5, .5, 0]);
  const bounce = Math.abs(sin(phase * TAU)), rock = sin(phase * TAU);
  return earFlick({
    ...p, hy: p.hy - bounce * 2, sy: p.sy - bounce * 2.2, headY: p.headY - Math.abs(sin(phase * TAU - .5)) * 2.4,
    rot: rock * .02, headRot: rock * -.035, arch: p.arch + bounce * .03, tailSway: -rock * .5,
  }, t, seed);
}

function runPose(phase: number): Pose {
  const base = pose({ hx: -21, hy: -36, sx: 19, sy: -37, headX: 32, headY: -70, headTurn: .5, tailA: -2.9, tailBend: .06, tailTip: .3, eyeStyle: 'wide', lookX: .4, tailWag: .2 });
  const p = gait(base, phase, 24, 8, .42, [0, .52, .1, .62]);
  const c = Math.cos(phase * TAU);
  return { ...p, hx: p.hx - c * 4, sx: p.sx + c * 4, arch: c * .08, hy: p.hy - Math.max(0, sin(phase * TAU)) * 3, sy: p.sy - Math.max(0, -sin(phase * TAU)) * 3, headY: p.headY - c * 1.4, lift: Math.abs(sin(phase * TAU)) * 3, tailSway: c * .6 };
}

function sleepLayer(p: Pose, t: number, seed: number, rate = 4.2): Pose {
  const b = breathe(p, t, rate, .9);
  const dream = ((t + seed * 13) % 23) < .25 ? 1 : 0;
  const paw = ((t + seed * 5) % 17) < .5 ? sin(((t + seed * 5) % 17) / .5 * Math.PI) * 3 : 0;
  // Asleep: only the breath, a twitch of the ear in a dream, and now and then the tail tip.
  return { ...b, earTwitch: dream * .8, fnY: b.fnY - paw, tailSway: 0, tailWag: 0 };
}

/**
 * Where a barbell press is at time `t`: sets of three reps, then a breather. `up` 0..1 is the
 * bar's height, `c` 0..1 the progress through the current rep (or the rest), `rep` 0..2.
 */
export function liftPhase(t: number, tired = false) {
  const period = tired ? 3.4 : 2.2, reps = 3, rest = tired ? 3.4 : 2.6, cycle = reps * period + rest, u = ((t % cycle) + cycle) % cycle;
  if (u >= reps * period) return { up: 0, c: (u - reps * period) / rest, rep: reps - 1, resting: true, strain: false, period };
  const c = (u % period) / period, up = c < .35 ? smooth(c / .35) : c < .6 ? 1 : 1 - smooth((c - .6) / .4);
  return { up, c, rep: Math.floor(u / period), resting: false, strain: c > .2 && c < .45, period };
}

/** Desk activities. Tired cats (intensity < .4) nod off over whatever they were doing. */
function studyPose(act: 'read' | 'write' | 'lab' | 'globe', t: number, intensity: number): Pose {
  const base = { ...SIDE_SIT, pawOver: 1, tuck: 0, fnX: 24, fnY: -31, ffX: 30, ffY: -31, headTurn: .15, tailWag: .3 };
  if (intensity < .4) {
    const c = t % 7, yawn = c > 5 ? Math.sin((c - 5) / 2 * Math.PI) : 0, nod = Math.max(0, Math.sin(t * 1.3)) ** 3;
    return breathe({ ...base, headY: base.headY + 6 + nod * 6, headRot: .25 + nod * .2 - yawn * .3, headTurn: 0, lookY: .9,
      eyeStyle: yawn > .2 ? 'squint' : 'sleepy', eyes: .35, mouth: yawn > .05 ? 'yawn' : 'w', mouthOpen: yawn, ears: .3, tailWag: 0 }, t, 4);
  }
  if (act === 'read') {
    // Reading, eyes moving along the lines; every few seconds a paw turns the page.
    const c = t % 5, turn = c > 4 ? sin((c - 4) * Math.PI) : 0;
    return breathe({ ...base, headY: base.headY + 4, headRot: .22, lookY: .9, lookX: -.6 + ((t * .5) % 1) * 1.2, fnX: 28 + turn * 14, fnY: -31 - turn * 9, eyeStyle: 'open', mouth: 'w' }, t);
  }
  if (act === 'write') {
    const c = t % 6, write = c < 4, scribble = write ? sin(t * 14) * 2 : 0, think = !write ? sin((c - 4) / 2 * Math.PI) : 0;
    return breathe({ ...base, headY: base.headY + 4 - think * 3, headRot: .2 - think * .3, lookY: write ? .9 : -.6, lookX: write ? sin(t * 1.4) * .5 : .4, fnX: 26 + scribble, fnY: -31 - think * 6,
      eyeStyle: 'open', mouth: write ? 'w' : 'flat', ears: think * .2 }, t);
  }
  if (act === 'lab') {
    // Watching the flask bubble, then giving it a careful shake; delighted when it fizzes.
    const c = t % 6, shake = c > 3 && c < 4.6 ? 1 : 0, fizz = c > 4.6 ? sin((c - 4.6) / 1.4 * Math.PI) : 0;
    return breathe({ ...base, headY: base.headY - 2 - fizz * 4, headRot: -.05 - fizz * .12, lookX: .7, lookY: shake ? .3 : -.2, fnX: 36 + shake * sin(t * 30) * 3, fnY: -31 - shake * 16,
      eyeStyle: fizz > .3 ? 'happy' : 'wide', mouth: fizz > .3 ? 'smile' : 'w', blush: fizz * .8, ears: -fizz * .2 }, t);
  }
  // Globe: tap it, watch it spin.
  const c = t % 3.2, tap = c < .5 ? sin(c / .5 * Math.PI) : 0;
  return breathe({ ...base, headY: base.headY, headRot: .05, lookX: .8, lookY: .1, fnX: 34 + tap * 12, fnY: -31 - tap * 18, eyeStyle: 'wide', mouth: tap > .5 ? 'open' : 'w', mouthOpen: tap * .3 }, t);
}

/** The jolt of a parachute snapping open: the body is pulled taut (stretched), then shakes it off. `t` is seconds since the canopy opened. */
const yank = (t: number) => Math.exp(-t * 7) * Math.cos(t * 24);
/** The standing body under a parachute: `kick` swings the legs in turn (−1..1), `up` pulls the knees up and out. */
const UNDER = (kick: number, up = 0) => ({ upright: 1, stride: kick, strideUp: 0, gait: 0, legSpread: up });

// the stretch as an animator would draw it, in whole drawings: a small rise first (anticipation), down into the front
// stretch with the yawn opening, a deeper push held, forward over the paws into the back-leg stretch, then standing again with the
// tail swinging past and settling. The tail and ears arrive a drawing after the body (cat-frames.ts `between`). 3.4 s, as before.
const STRETCH_UP = pose({ hy: STAND.hy - 2, sy: STAND.sy - 1.5, headY: STAND.headY - 2, eyeStyle: 'squint', tailTip: .5 });
const STRETCH_1 = pose({ ...STRETCH, eyeStyle: 'closed', mouth: 'yawn', mouthOpen: .55 });
const STRETCH_2 = pose({ ...STRETCH, hy: STRETCH.hy - 2.5, sy: STRETCH.sy + 1.5, headY: STRETCH.headY + 1.5, eyeStyle: 'closed', mouth: 'yawn', mouthOpen: .85, tailTip: .9 });
const STRETCH_BACK_1 = pose({ hx: -12, hy: -34, sx: 21, sy: -36, arch: .05, headX: 34, headY: -72, bnX: -31, bnY: -6, bfX: -14, eyeStyle: 'closed' });
const STRETCH_BACK_2 = pose({ hx: -12, hy: -34, sx: 21, sy: -36, arch: .05, headX: 34, headY: -72, bnX: -33, bnY: -8, bfX: -14, eyeStyle: 'happy' });
const STRETCH_SETTLE = pose({ tailSway: .55, tailTip: .6, ears: .15, eyeStyle: 'happy' });
const STRETCH_SEQ = new Seq([
  ...between(STAND, STRETCH_UP, 1, .08, 'up'), key(STRETCH_UP, .12, 'rise'),
  ...between(STRETCH_UP, STRETCH_1, 2, .08, 'down', 'out'), key(STRETCH_1, .5, 'front stretch'),
  ...between(STRETCH_1, STRETCH_2, 1, .1, 'push'), key(STRETCH_2, .64, 'deep stretch'),
  ...between(STRETCH_2, STRETCH_BACK_1, 2, .1, 'over'), key(STRETCH_BACK_1, .3, 'back legs'),
  ...between(STRETCH_BACK_1, STRETCH_BACK_2, 1, .1, 'kick'), key(STRETCH_BACK_2, .75, 'kick held'),
  ...between(STRETCH_BACK_2, STRETCH_SETTLE, 2, .1, 'stand', 'out'), key(STRETCH_SETTLE, .1, 'tail swings past'), key(STAND, .15, 'settled'),
]);

export const CLIPS = {
  stand: { loop: true, fn: ({ t, seed }) => idle(STAND, t, seed) },
  // the gaits are lists of drawings picked by the distance walked (cat-frames.ts): a planted paw stays on its spot.
  walk: { loop: true, fn: ({ t, phase, seed }) => earFlick(gaitPose('walk', phase), t, seed) },
  slowWalk: { loop: true, fn: ({ t, phase, seed }) => earFlick(gaitPose('slow', phase), t, seed) },
  run: { loop: true, fn: ({ phase }) => gaitPose('run', phase) },
  sit: { loop: true, fn: ({ t, seed }) => idle(SIT, t, seed) },
  sitFront: { loop: true, fn: ({ t, seed }) => idle({ ...SIT, headTurn: 0, lookX: 0 }, t, seed) },
  // the reference style idle poses, held for a long while (the rhythm layers add the small movements).
  // Sitting with the back to us, looking out (the ears turn now and then).
  // sitting up front-on and batting at a toy by its paws, in the reference style's way: the paw is up or
  // down (a frame swap, quick), with a still hold between taps; eyes on the toy.
  sitPlay: { loop: true, fn: ({ t }) => { const c = t % 1.7, tap = c < .3 || (c > .55 && c < .75); return breathe({ ...SIT, headTurn: 0, lookX: -.35, lookY: .7, eyeStyle: tap ? 'wide' : 'open', pawOver: tap ? 1 : 0, mouth: tap ? 'open' : 'w', mouthOpen: tap ? .25 : 0, tailSway: sin(t * 5) * .35 }, t); } },
  sitBack: { loop: true, fn: ({ t, seed }) => { const p = breathe({ ...SIT, headBack: 1, headTurn: 0 }, t); return { ...p, headRot: burst(t, seed + 9, 1.4, 3, 7) * (((Math.floor((t + seed) / 6) % 2) ? 1 : -1) * .14), earTwitch: earFlick(p, t, seed).earTwitch }; } },
  // Awake loaf with the chin on the front paws, eyes half closed.
  chinRest: { loop: true, fn: ({ t, seed }) => earFlick(glance(breathe({ ...LOAF, eyeStyle: 'sleepy', eyes: .7, headY: LOAF.headY + 9, headX: LOAF.headX + 6, headRot: .12, fnX: 30, ffX: 36 }, t, 3.8), t, seed, .5), t, seed) },
  // Lounging on the side, head up and propped, as if enjoying the afternoon.
  // a longer body and tail, the head a little lower.
  lounge: { loop: true, fn: ({ t, seed }) => earFlick(glance(breathe({ ...SIDE, hx: SIDE.hx - 6, tailLen: SIDE.tailLen + 6, eyeStyle: 'sleepy', eyes: .8, headY: -35, headX: 37, headRot: .25, headScale: 1, ffY: -12, ffX: 36, mouth: 'w', tailWag: .3 }, t, 3.6), t, seed, .6), t, seed) },
  // On the back, awake, paws loose, looking around upside down.
  // the eyes hold, then glance and hold there (no endless sweep); the tail flicks now and then; nothing else moves.
  bellyUp: { loop: true, fn: ({ t, seed }) => { const p = earFlick(breathe({ ...BELLY_AWAKE, eyeStyle: (t + seed) % 7 < 5.5 ? 'open' : 'happy', mouth: 'w' }, t, 2.8, .5), t, seed), g = heldGlance(t, seed); return { ...p, lookX: g, headTurn: p.headTurn + g * .08 }; } },
  loaf: { loop: true, fn: ({ t, seed }) => idle({ ...LOAF, eyeStyle: 'sleepy', eyes: .6 }, t, seed, 3.8) },
  sleep: { loop: true, fn: ({ t, seed }) => sleepLayer(CURL, t, seed) },
  sleepLoaf: { loop: true, fn: ({ t, seed }) => sleepLayer({ ...LOAF, eyeStyle: 'closed', headY: LOAF.headY + 3, headRot: -.08 }, t, seed) },
  sleepSide: { loop: true, fn: ({ t, seed }) => sleepLayer(SIDE, t, seed, 4.4) },
  sleepBelly: { loop: true, fn: ({ t, seed }) => { const p = /* A14: asleep on its back the head lies as it does awake (upright, tipped further back), not upside down: its ears went through the floor. */ sleepLayer({ ...BELLY_AWAKE, headRot: -.5, headY: -32 }, t, seed, 4.4); return { ...p, eyeStyle: 'closed', blush: .3, mouth: 'w' }; } },
  sleepSprawl: { loop: true, fn: ({ t, seed }) => sleepLayer(SPRAWL, t, seed, 4.6) },
  sleepSuperman: { loop: true, fn: ({ t, seed }) => sleepLayer(SUPERMAN, t, seed, 4.6) },
  // Funny sleeps (the reference style-style variety). On the back, frog legs, mouth hanging open, snoring.
  sleepSnore: { loop: true, fn: ({ t, seed }) => { const p = sleepLayer({ ...BELLY, eyeStyle: 'closed', bnX: -30, bnY: -40, bfX: -4, bfY: -42, fnX: 22, fnY: -40, ffX: 30, ffY: -38, blush: .3 }, t, seed, 4.6); const snore = (sin(t / 4.6 * TAU) + 1) / 2; return { ...p, mouth: 'open', mouthOpen: .25 + snore * .35 }; } },
  // Loaf with the chin resting on the front paws.
  sleepChin: { loop: true, fn: ({ t, seed }) => sleepLayer({ ...LOAF, eyeStyle: 'closed', headY: LOAF.headY + 9, headX: LOAF.headX + 6, headRot: .12, fnX: 30, ffX: 36 }, t, seed, 4.2) },
  // On the side, the tip of the tongue sticking out ("blep").
  sleepBlep: { loop: true, fn: ({ t, seed }) => ({ ...sleepLayer(SIDE, t, seed, 4.4), mouth: 'lick', mouthOpen: .35 }) },
  // Curled up with a paw over the eyes.
  sleepPaw: { loop: true, fn: ({ t, seed }) => sleepLayer({ ...CURL, tuck: 0, pawMouth: 1, pawDX: 4, pawDY: -9, fnX: CURL.headX + 4, fnY: CURL.headY - 6 }, t, seed) },
  sleepAway: { loop: true, fn: ({ t, seed }) => sleepLayer(AWAY, t, seed, 4.8) },
  /** Sleep → drowsy loaf: eyes crack open and slip shut twice, the head wobbles. */
  wake: { loop: false, duration: 3.6, fn: ({ t }) => {
    const rise = smooth((t - .3) / 1.6);
    const body = lerpPose(CURL, { ...LOAF, eyeStyle: 'sleepy' }, rise);
    const lids = t < 1.2 ? 0 : t < 1.7 ? (t - 1.2) * 1.2 : t < 2.0 ? .6 - (t - 1.7) * 2 : t < 2.9 ? .25 + (t - 2.0) * .45 : .66;
    return { ...body, eyeStyle: lids < .15 ? 'closed' : 'sleepy', eyes: Math.max(.2, lids), headRot: body.headRot + sin(t * 2.2) * .05 * (1 - rise), ears: .3 * (1 - rise) };
  } },
  yawn: { loop: false, duration: 2.3, fn: ({ t }) => {
    const o = t < .5 ? easeOut(t / .5) : t < 1.5 ? 1 : 1 - smooth((t - 1.5) / .6);
    return { ...SIT, headY: SIT.headY - 5 * o, headRot: -.14 * o, headTurn: 0, mouth: 'yawn', mouthOpen: o, eyeStyle: o > .25 ? 'squint' : 'sleepy', eyes: .6, ears: .35 * o, arch: SIT.arch - .05 * o };
  } },
  /** Front stretch with a yawn, hold, roll forward into a back-leg stretch, settle. */
  // a quick move into each pose, then a hold (the yawn widening, the eyes opening), not one long tween through
  // in-between shapes. Same 3.4 s. The back-leg stretch is a short kick, not a long stick.
  // a run of whole drawings (STRETCH_SEQ below), same 3.4 s.
  stretch: { loop: false, duration: 3.4, fn: ({ t }) => STRETCH_SEQ.at(t) },
  /**
   * Like a real cat: paw up to the mouth, a run of licks where the head dips to the paw with each
   * stroke (tongue out on the way down), then the wet paw wiped over the cheek and up over the ear
   * twice with the head leaning into it, a pause, and again. Every move is eased, never a toggle.
   */
  groom: { loop: true, fn: ({ t, seed }) => {
    const c = (t + seed * 2.3) % 7.2;
    const raise = c < .55 ? smooth(c / .55) : c < 6.4 ? 1 : 1 - smooth((c - 6.4) / .6);
    // Licks: 2.2 per second for 2.6 s, each a dip-and-rise of the head with the tongue out on the dip.
    const licking = c > .5 && c < 3.1, lp = licking ? ((c - .5) * 2.2) % 1 : 0, dip = licking ? Math.max(0, sin(lp * Math.PI)) : 0;
    // Two wipes from the cheek over the ear, the head leaning into the paw.
    const wiping = c > 3.3 && c < 5.9, wp = wiping ? ((c - 3.3) / 1.3) % 1 : 0, wipe = wiping ? sin(wp * Math.PI) : 0, lean = wiping ? smooth(Math.min(1, (c - 3.3) / .3, (5.9 - c) / .3)) : 0;
    const glanceUp = c > 6 ? smooth(Math.min(1, (c - 6) / .4)) : 0;
    return breathe({ ...SIT, pawMouth: raise, pawOver: raise > .3 ? 1 : 0,
      pawDX: -2 + wp * 6 * lean, pawDY: dip * 2 - wipe * 18 * lean,
      headRot: .1 * raise + dip * .06 - lean * (.24 + wipe * .1), headTurn: .05 + glanceUp * .3,
      headY: SIT.headY + 2 * raise + dip * 4 + lean * 3, headX: SIT.headX + dip * 1.5 - lean * 2,
      mouth: 'lick', mouthOpen: licking ? dip * .9 : 0,
      eyeStyle: glanceUp > .5 ? 'open' : lean > .2 ? 'closed' : 'squint', ears: lean * wipe * .45, tailWag: .15 }, t, 3);
  } },
  /** Twisted round to the flank: the head travels along it in long strokes, lifting between them. */
  groomBack: { loop: true, fn: ({ t, seed }) => {
    const c = (t + seed * 1.7) % 6, stroke = c < 4.6 ? (c * 1.6) % 1 : 0;
    const down = c < 4.6 ? sin(Math.min(1, stroke / .75) * Math.PI) : 0, pause = c >= 4.6 ? sin((c - 4.6) / 1.4 * Math.PI) : 0;
    return breathe({ ...SIDE, eyeStyle: 'closed', headTurn: -.75, headRot: -1.05 + down * .18 + pause * .35,
      headX: -2 - stroke * 10 * (down > 0 ? 1 : 0) + pause * 6, headY: -34 + down * 5 - pause * 4,
      mouth: 'lick', mouthOpen: down * .85, fnX: 26, fnY: -5, ffX: 32, ffY: -7, tailWag: .1 }, t, 3.6);
  } },
  knead: { loop: true, fn: ({ t }) => {
    const a = Math.max(0, sin(t * 4.4)), b = Math.max(0, -sin(t * 4.4));
    const base = pose({ hx: -16, hy: -22, rh: 17.5, sx: 14, sy: -29, headX: 26, headY: -60, fnX: 19, ffX: 25, bnX: -18, bnY: 0, bfX: -10, eyeStyle: 'sleepy', eyes: .5, tailA: 2.9, tailBend: -.2, blush: .4, headTurn: .2 });
    return breathe({ ...base, fnY: -6 * a, ffY: -1.5 - 6 * b, sy: base.sy + (a - b) * .7, headRot: (a - b) * .03 }, t);
  } },
  /** Head down in the bowl; the bowl's front rim is drawn over the muzzle. */
  eat: { loop: true, fn: ({ t, seed }) => {
    const c = (t + seed) % 5.4;
    const lift = c > 4.2 ? sin((c - 4.2) / 1.2 * Math.PI) : 0;
    const chew = sin(t * 13);
    const base = pose({ sx: 16, sy: -31, arch: .1, headX: 38, headY: -34 - lift * 16, headRot: .42 - lift * .36, headTurn: .25, fnX: 18, ffX: 25, tailA: -2.5, tailBend: .12, tailTip: .4,
      eyeStyle: lift > .3 ? 'happy' : 'closed', mouth: lift > .3 ? 'lick' : 'chew', mouthOpen: lift > .3 ? .7 : Math.max(0, chew) * .7, tailWag: .4 });
    return { ...base, headY: base.headY + (lift > .3 ? 0 : chew * .9) };
  } },
  /** Feather caught in the mouth: low crouch, head shaking, paws holding on. */
  bite: { loop: true, fn: ({ t }) => {
    const shake = sin(t * 15) * .14;
    return { ...CROUCH, headRot: .15 + shake, headY: CROUCH.headY + 2, headTurn: .3, eyeStyle: 'squint', mouth: 'w', ears: .35, pawOver: 1, fnX: 34, fnY: -20, tailA: CROUCH.tailA + sin(t * 6) * .25 };
  } },
  /** Hand-fed: sitting, chewing with the head bobbing. */
  chew: { loop: true, fn: ({ t }) => {
    const chew = sin(t * 11);
    return { ...SIT, headY: SIT.headY + 2 + chew * 1.2, headRot: .08 + chew * .03, mouth: 'chew', mouthOpen: Math.max(0, chew), eyeStyle: 'happy', blush: .5, tailWag: .6, tailSway: sin(t * 3) * .4 };
  } },
  beg: { loop: true, fn: ({ t }) => {
    const m = (t % 2.4) < .9 ? sin((t % 2.4) / .9 * Math.PI) : 0;
    return { ...SIT, headY: SIT.headY - 4, headRot: -.12, headTurn: 0, mouth: 'meow', mouthOpen: m, eyeStyle: 'wide', lookY: -.5, tailWag: .8 };
  } },
  sniff: { loop: true, fn: ({ t }) => ({ ...pose({ sx: 16, sy: -32, headX: 34, headY: -40, headRot: .3, headTurn: .35, lookY: .6, tailA: -2.2, tailTip: .5 }), headX: 34 + sin(t * 9) * .6, headY: -40 + sin(t * 7) * .5 }) },
  scratchPost: { loop: true, fn: ({ t }) => {
    const a = sin(t * 7.5), b = sin(t * 7.5 + Math.PI);
    return { ...REAR, fnY: REAR.fnY + a * 8, ffY: REAR.ffY + b * 8, fnX: REAR.fnX - Math.max(0, a) * 1.5, headRot: -.05 + a * .03, arch: -.08 + a * .02 };
  } },
  dig: { loop: true, fn: ({ t }) => {
    const c = (t * 2.6) % 1;
    const p = pose({ sx: 15, sy: -30, headX: 32, headY: -48, headRot: .2, headTurn: .35, lookY: .7, tailA: -2.3, tailTip: .4 });
    const near = c < .5, s = near ? c / .5 : (c - .5) / .5;
    const dx = 10 - 22 * s, dy = -7 * sin(s * Math.PI);
    return near ? { ...p, fnX: p.fnX + dx, fnY: dy } : { ...p, ffX: p.ffX + dx, ffY: p.ffY + dy };
  } },
  squat: { loop: true, fn: ({ t }) => ({ ...SQUAT, hy: SQUAT.hy + sin(t * 30) * .25, headY: SQUAT.headY + sin(t * 30) * .2, tailA: SQUAT.tailA + sin(t * 5) * .04 }) },
  cover: { loop: true, fn: ({ t }) => {
    const p = pose({ sx: 14, sy: -31, headX: 31, headY: -52, headTurn: .3, lookY: .5, tailA: -2.2 });
    const a = sin(t * 9), b = sin(t * 9 + Math.PI);
    return { ...p, fnX: p.fnX + a * 8, fnY: -Math.max(0, a) * 4, ffX: p.ffX + b * 8, ffY: p.ffY - Math.max(0, b) * 4 };
  } },
  /** Cheek and flank rub: lean in, glide, tail high with a hooked tip. */
  rub: { loop: true, fn: ({ t, phase, seed }) => {
    // It moves while it rubs, so the legs step (the phase grows with the distance, see behaviors.ts): no gliding on still feet.
    const s = sin(t * 2.4), w = walkPose(phase, seed, t, true);
    return { ...w, rot: -.05 + s * .03, headRot: -.36 + s * .09, headX: 30, headY: -66, headTurn: .1, eyeStyle: 'happy', blush: .6, tailA: -1.7, tailBend: .2, tailTip: .9 };
  } },
  pet: { loop: true, fn: ({ t, intensity }) => {
    const lean = .5 + .5 * sin(t * 2.2);
    return breathe({ ...SIT, headRot: -.2 - lean * .09 * intensity, headX: 10, headY: -80 - lean, headTurn: .05, eyeStyle: 'happy', blush: .8, mouth: 'smile', tailSway: sin(t * 3) * .5, tailWag: 1, earTwitch: 0 }, t, 1.6, .6);
  } },
  // Lazy play: on its back, front paws holding the ball up over the chest, hind legs bicycling it.
  ballLie: { loop: true, fn: ({ t }) => {
    const b = breathe(BELLY_PAWS, t, 2.2, .5), kick = sin(t * 7), roll = sin(t * 1.3);
    return { ...b, eyeStyle: (t % 4) < 2.8 ? 'open' : 'happy', lookY: -.5, mouth: 'w', blush: .4,
      fnX: 24 + roll * 2, fnY: -52 + sin(t * 3.1) * 2, ffX: 30 + roll * 2, ffY: -50 + sin(t * 3.1 + .6) * 2,
      bnX: -10 + kick * 5, bnY: -48 + Math.max(0, kick) * 6, bfX: -2 - kick * 5, bfY: -46 + Math.max(0, -kick) * 6, rot: roll * .04, tailWag: .3 };
  } },
  /**
   * belly down over a big ball, the back rounded over it,
   * the chin and all four paws hanging. The cat is lifted onto the ball by the behaviour (cat.z); here the paws sit below the pose's
   * floor because they dangle. It rocks a little in held drawings (0.4 s each), the tail tip the last to move.
   */
  ballDrape: { loop: true, fn: ({ t, seed }) => {
    const ROCK = [0, 1, 0, -1], k = Math.floor(t / .4), r = ROCK[k % 4], late = ROCK[(k + 3) % 4];
    return earFlick(breathe({ ...DRAPE, rot: r * .035, headRot: DRAPE.headRot + r * .04, fnY: DRAPE.fnY + r * 1.5, bnY: DRAPE.bnY - r * 1.5,
      tailBend: DRAPE.tailBend + late * .03, eyeStyle: (t + seed) % 6 < 4.4 ? 'happy' : 'open' }, t, 3, .4), t, seed);
  } },
  petLie: { loop: true, fn: ({ t }) => ({ ...breathe(BELLY_PAWS, t, 1.8, .7), fnY: BELLY.fnY + sin(t * 3.2) * 3, ffY: BELLY.ffY + sin(t * 3.2 + 1.4) * 3, mouth: 'smile' }) },
  // ——— petting by body part and mood: head, back, belly, tail, paw; pokes are short.
  /** Head, happy: pushes up into the hand, eyes shut, ears softly back, a purring bob. */
  petHead: { loop: true, fn: ({ t, intensity }) => {
    const bump = Math.max(0, sin(t * 2.6)) ** 2;
    return breathe({ ...SIT, headRot: -.3 - bump * .12 * intensity, headX: 12, headY: -80 - bump * 4, headTurn: .1, eyeStyle: 'happy', blush: .9, mouth: 'smile', ears: .35, tailSway: sin(t * 2.2) * .6, tailWag: 1 }, t, 1.4, .7);
  } },
  /** Head, calm: slow blinks (a cat's "I trust you"), leans in a little. */
  petHeadCalm: { loop: true, fn: ({ t }) => {
    const blink = (t % 3) < 1.1;
    return breathe({ ...SIT, headRot: -.12, headX: 10, headY: -82, headTurn: .3, eyeStyle: blink ? 'happy' : 'open', eyes: blink ? 1 : .85, mouth: 'w', ears: .15, tailSway: sin(t * 1.4) * .3 }, t, 2.2, .5);
  } },
  /** Head, sleepy: eyes half shut, the head nods lower, a yawn now and then. */
  petHeadSleepy: { loop: true, fn: ({ t }) => {
    const nod = sin(t * .9) * .5 + .5, y = (t % 6) > 4.6 ? sin(((t % 6) - 4.6) / 1.4 * Math.PI) : 0;
    return breathe({ ...SIT, headRot: .05 + nod * .12, headY: -80 + nod * 4, headX: 9, headTurn: .4, eyeStyle: y > .2 ? 'squint' : 'sleepy', eyes: .45, mouth: y > .2 ? 'yawn' : 'w', mouthOpen: y, ears: .25, tailSway: 0 }, t, 3, .6);
  } },
  petBack: { loop: true, fn: ({ t }) => {
    const s = .5 + .5 * sin(t * 2.4), q = sin(t * 22) * .05;
    //
    return { ...STRETCH, hy: STRETCH.hy - 1 - s * 3, headY: STRETCH.headY + 2 + s * 1.5, headTurn: .25, eyeStyle: 'happy', blush: .6, mouth: 'smile', ears: .15, tailA: -1.62 + q, tailBend: .02, tailTip: .7 + q, tailWag: 0, tailSway: 0 };
  } },
  /** Back, happy, already sitting: stays seated, leans into the hand, head dips, tail sways. Standing up would blend through a ball. */
  petBackSit: { loop: true, fn: ({ t }) => {
    const s = .5 + .5 * sin(t * 2.2);
    return breathe({ ...SIT, headRot: -.06 - s * .05, headY: -83 + s * 2, headX: 10, headTurn: .3, eyeStyle: 'happy', blush: .6, mouth: 'smile', tailSway: sin(t * 2.2) * .35, tailWag: .5 }, t, 2.2, .6);
  } },
  /** Back, calm, already sitting: stays seated and still, the tail rises a little. */
  petBackSitCalm: { loop: true, fn: ({ t }) => {
    const s = .5 + .5 * sin(t * 1.3);
    return breathe({ ...SIT, headTurn: .35, eyeStyle: 'open', eyes: .85, mouth: 'w', tailSway: s * .22 - .08, tailWag: .3 }, t, 2.6, .5);
  } },
  /** Back or rump, calm: the same bow, slower and a little lower (hips up, head down), eyes open, the tail rising slowly with its tip curling. */
  petBackCalm: { loop: true, fn: ({ t }) => {
    const s = .5 + .5 * sin(t * 1.3);
    return { ...STRETCH, hy: STRETCH.hy + 4 - s * 2, headY: STRETCH.headY + 1, headTurn: .35, eyeStyle: 'open', eyes: .85, mouth: 'w', tailA: -1.95 + s * .25, tailTip: .4 + s * .4, tailWag: .3 };
  } },
  /** Back, sleepy: sinks into a loaf under the hand, eyes closing. */
  loafPet: { loop: true, fn: ({ t }) => breathe({ ...LOAF, eyeStyle: (t % 4) < 2.5 ? 'happy' : 'sleepy', eyes: .5, mouth: 'w', blush: .4, headRot: -.06 }, t, 3, .7) },
  /** Belly, very trusting: the trap. Front paws hug the hand, back feet bunny-kick. */
  bellyTrap: { loop: true, fn: ({ t }) => {
    const k = sin(t * 14), b = breathe(BELLY_PAWS, t, 1.6, .5);
    return { ...b, eyeStyle: 'wide', mouth: 'open', mouthOpen: .3, fnX: 22, fnY: -54, ffX: 28, ffY: -55, bnX: -8 + k * 6, bnY: -44 + Math.abs(k) * 6, bfX: -k * 6, bfY: -42, tailWag: .4 };
  } },
  /** Belly, so-so: rolls back over, off its back, onto its feet. */
  rollAway: { loop: false, duration: 1.2, fn: ({ t }) => keyed([[0, BELLY_AWAKE], [.5, { ...SIDE, eyeStyle: 'open' }], [1.2, { ...LOAF, eyeStyle: 'open', ears: .2 }]], t) },
  /** Tail touched, happy: looks round at it and swishes it, ready to play. */
  tailPlay: { loop: true, fn: ({ t }) => {
    const w = sin(t * 3.2);
    return { ...SIDE_SIT, headTurn: -.6, lookX: -.8, eyeStyle: 'wide', mouth: 'w', tailA: SIDE_SIT.tailA + w * .4, tailBend: .22 + w * .12, tailTip: .8, tailWag: .5 };
  } },
  /** Tail, so-so: tucks it round its feet and looks a little put out. */
  tailAway: { loop: true, fn: ({ t }) => ({ ...SIT, tailFront: 1, ears: .4, eyeStyle: 'open', eyes: .8, mouth: 'flat', lookX: -.5, headTurn: .1, tailSway: sin(t * 1.2) * .15 }) },
  /** Tail, sleepy: one lazy flick now and then, otherwise nothing. */
  tailFlick: { loop: true, fn: ({ t, seed }) => {
    const c = t % 3, f = c < .6 ? sin(c / .6 * Math.PI) : 0;
    return { ...idle({ ...LOAF, eyeStyle: 'sleepy', eyes: .5 }, t, seed, 3.8), tailA: LOAF.tailA + f * .6, tailTip: .5 + f * .4 };
  } },
  /** Paw held, happy: lifts it to meet the hand (a high five). */
  pawUp: { loop: true, fn: ({ t }) => {
    const s = .5 + .5 * sin(t * 2);
    return { ...SIDE_SIT, fnX: SIDE_SIT.fnX + 16 + s * 4, fnY: -26 - s * 6, eyeStyle: 'happy', mouth: 'smile', blush: .6, headTurn: .5, tailWag: .8 };
  } },
  /** Paw, so-so: pulls it back and tucks it in. */
  pawPull: { loop: false, duration: .8, fn: ({ t }) => {
    const s = t < .25 ? easeOut(t / .25) : 1 - smooth((t - .25) / .55);
    return { ...SIDE_SIT, fnX: SIDE_SIT.fnX - 8 * s, ears: .3 * s, eyeStyle: 'open', lookY: .5, headTurn: .4 };
  } },
  /** A poke on the head: the ears flick, a quick look up. */
  earFlick: { loop: false, duration: .9, fn: ({ t }) => {
    const s = t < .2 ? easeOut(t / .2) : 1 - smooth((t - .2) / .7);
    return { ...SIT, earTwitch: 1, headRot: -.1 * s, lookY: -.6 * s, eyeStyle: s > .3 ? 'wide' : 'open' };
  } },
  /** A poke on the back: turns to see who did it. */
  lookBack: { loop: false, duration: 1.1, fn: ({ t }) => {
    const s = t < .3 ? easeOut(t / .3) : t < .8 ? 1 : 1 - smooth((t - .8) / .3);
    return { ...SIDE_SIT, headTurn: .5 - 1.1 * s, lookX: -.8 * s, eyeStyle: 'wide', ears: .2 * s };
  } },
  /** A sitting cat poked on the back glances over its shoulder: the same front-facing sit, only head, eyes and ears turn
   * (lookBack swaps to the side-on model, which flipped the body and looked bulky). */
  lookBackSit: { loop: false, duration: 1.1, fn: ({ t }) => {
    const s = t < .3 ? easeOut(t / .3) : t < .8 ? 1 : 1 - smooth((t - .8) / .3);
    return breathe({ ...SIT, headTurn: SIT.headTurn - .75 * s, lookX: -.9 * s, headRot: -.08 * s, eyeStyle: 'wide', ears: .25 * s, tailSway: s * .35 }, t, 2.6, .5);
  } },
  annoyed: { loop: true, fn: ({ t }) => {
    const lash = sin(t * 7);
    return { ...SIT, ears: .95, eyeStyle: 'open', mouth: 'flat', lookX: -.6, headTurn: -.2, brow: -1, tailA: SIT.tailA + lash * .35, tailBend: SIT.tailBend + lash * .1, headRot: .05, tailWag: 0 };
  } },
  swat: { loop: false, duration: .75, fn: ({ t }) => {
    const s = t < .25 ? easeOut(t / .25) : 1 - smooth((t - .25) / .5);
    return { ...SIDE_SIT, pawOver: s > .2 ? 1 : 0, ears: .9, brow: -1, eyeStyle: 'squint', mouth: 'open', mouthOpen: .5, fnX: SIDE_SIT.fnX + 26 * s, fnY: SIDE_SIT.fnY - 34 * s, headRot: -.06 * s, headTurn: .4 };
  } },
  flinch: { loop: false, duration: .9, fn: ({ t }) => {
    const s = t < .2 ? easeOut(t / .2) : 1 - smooth((t - .2) / .7);
    return { ...SIDE_SIT, ears: .8 * s, eyeStyle: s > .3 ? 'squint' : 'open', hx: SIDE_SIT.hx - 3 * s, sx: SIDE_SIT.sx - 4 * s, headX: SIDE_SIT.headX - 6 * s, fur: s, arch: SIDE_SIT.arch + .1 * s };
  } },
  held: { loop: true, fn: ({ t, intensity }) => {
    const s = sin(t * 2.6), happy = intensity > .5;
    return { ...HELD, bnX: HELD.bnX + s * 1.5, bfX: HELD.bfX + s * 1.2, fnY: HELD.fnY + sin(t * 2.1) * 1.2, rot: s * .04,
      eyeStyle: happy ? 'happy' : 'blank', ears: happy ? .1 : .55, mouth: happy ? 'w' : 'flat', blush: happy ? .5 : 0, tailSway: s * .3 };
  } },
  fall: { loop: true, fn: () => ({ ...HELD, bnY: -2, bfY: -3, bnX: -12, bfX: 12, fnY: -26, ffY: -28, fnX: -8, ffX: 22, tuck: 0, eyeStyle: 'wide', tailA: -1.4, tailFront: 0, ears: .4 }) },
  chute: { loop: true, fn: ({ t, seed }) => {
    const sway = sin(t * 2.2 + seed), bob = sin(t * 3.4 + seed), y = yank(t);
    return breathe({ ...SIT, ...UNDER(sin(t * 3.1 + seed) * .5), armsUp: 2, headTurn: 0, headRot: sway * .04, rot: sway * .05, lift: 0, squashY: 1 + .09 * y, squashX: 1 - .05 * y, eyeStyle: 'happy', mouth: 'open', mouthOpen: .35 + bob * .05, blush: .8, ears: .5, tailSway: sway * .5, tailWag: .4 }, t, 2.4, .5);
  } },
  /** Swinging wide like a child on a swing, whooping. */
  chuteSwing: { loop: true, fn: ({ t, seed }) => {
    const a = sin(t * 2.3 + seed), y = yank(t);
    return breathe({ ...SIT, ...UNDER(-a * .6, Math.max(0, a) * .25), armsUp: 2, headTurn: 0, rot: a * .17, headRot: -a * .07, lift: 0, squashY: 1 + .09 * y, squashX: 1 - .05 * y, eyeStyle: 'happy', mouth: 'open', mouthOpen: .45 + Math.abs(a) * .15, blush: .8, ears: .15, tailSway: -a * .9, tailWag: .6 }, t, 2.4, .5);
  } },
  /** Dancing on the strings: a beat of bounces, the body rocking, the tail going. */
  chuteDance: { loop: true, fn: ({ t, seed }) => {
    const b = sin(t * 9 + seed), hit = Math.abs(b), y = yank(t);
    return { ...SIT, ...UNDER(b * .85, hit * .2), armsUp: 2, headTurn: 0, rot: b * .12, headRot: -b * .1, headY: SIT.headY - hit * 2, lift: hit * 5, squashY: 1 - .05 * hit + .09 * y, squashX: 1 + .04 * hit - .05 * y, eyeStyle: 'happy', mouth: 'open', mouthOpen: .4 + hit * .3, blush: .9, ears: .1, tailSway: b * 1.2, tailWag: 1 };
  } },
  /** Taking it easy: head back, eyes half shut, a little smile, hardly swaying. */
  chuteChill: { loop: true, fn: ({ t, seed }) => {
    const a = sin(t * 1.1 + seed), y = yank(t);
    return breathe({ ...SIT, ...UNDER(sin(t * 1.2 + seed) * .12, .1), armsUp: 2, headTurn: 0, rot: a * .05, headRot: -.11 + sin(t * .7 + seed) * .02, headY: SIT.headY + 2, lift: 0, squashY: 1 + .06 * y, eyeStyle: 'sleepy', mouth: 'smile', blush: .25, ears: .25, tailSway: a * .4, tailWag: .15 }, t, 3, .5);
  } },
  /** Terrified: stretched, trembling, fur on end, ears flat, eyes huge. */
  chuteScared: { loop: true, fn: ({ t, seed }) => {
    const y = yank(t), tremble = sin(t * 34 + seed);
    return { ...SIT, ...UNDER(tremble * .08, .5 + sin(t * 6 + seed) * .05), armsUp: 2, headTurn: 0, rot: tremble * .02, headRot: sin(t * 27 + seed) * .03, headY: SIT.headY - 2, lift: 0, squashY: 1.05 + sin(t * 7) * .015 + .09 * y, squashX: .97 - .05 * y, eyeStyle: 'wide', mouth: 'open', mouthOpen: .3 + Math.abs(sin(t * 5)) * .2, blush: 0, ears: .9, fur: .7, tailSway: sin(t * 18 + seed) * .5, tailWag: .1 };
  } },
  /**
   * The free fall before the canopy opens: facing us, both arms flung up as if reaching for the cord, stretched, ears flat, fur on
   * end, flailing a little. It replaces the held-by-the-scruff pose, which hung limp and sideways. Since ng-tom.3: standing body,
   * the legs flung open too, as My Talking Tom in the air.
   */
  chuteFall: { loop: true, fn: ({ t, seed }) => {
    const flail = sin(t * 15 + seed);
    return { ...SIT, ...UNDER(flail * .3, .85 + flail * .1), armsUp: 2, headTurn: 0, rot: flail * .09, headRot: -flail * .06, lift: 0, squashY: 1.07, squashX: .95, headY: SIT.headY - 2, eyeStyle: 'wide', mouth: 'open', mouthOpen: .55, blush: 0, ears: .85, fur: .5, tailSway: sin(t * 22 + seed) * .8, tailWag: .2 };
  } },
  /** Fast asleep up there, head drooping, snoring a little. */
  chuteNap: { loop: true, fn: ({ t, seed }) => {
    const a = sin(t * 1.0 + seed), y = yank(t), snore = Math.max(0, sin(t * 1.9 + seed));
    return breathe({ ...SIT, ...UNDER(a * .04), armsUp: 2, headTurn: 0, rot: a * .045, headRot: .15 + a * .02, headY: SIT.headY + 6, lift: 0, squashY: 1 + .06 * y, eyeStyle: 'closed', mouth: snore > .2 ? 'open' : 'w', mouthOpen: snore * .3, blush: .15, ears: .35, tailSway: a * .3, tailWag: 0 }, t, 3.2, .6);
  } },
  /**
   * Touching down from a parachute: on the feet first, the knees giving (a squash), the arms let go of the strings at
   * once (armsUp between 0 and 1 is the gym's bar curl, so it never lingers there), then it sits down onto the sitting body.
   */
  chuteLand: { loop: false, duration: .9, fn: ({ t }) => {
    const k = t < .1 ? t / .1 : 1 - smooth((t - .1) / .3), sitDown = smooth((t - .4) / .4);
    return { ...SIT, upright: 1 - sitDown, stride: 0, legSpread: 0, armsUp: t < .12 ? 2 : 0, armLA: .25, armRA: .25, headTurn: 0, squashX: 1 + .12 * k, squashY: 1 - .14 * k, eyeStyle: k > .4 ? 'squint' : 'open', mouth: k > .4 ? 'open' : 'w', mouthOpen: .2 * k };
  } },
  land: { loop: false, duration: .55, fn: ({ t }) => {
    const s = t < .12 ? t / .12 : 1 - smooth((t - .12) / .43);
    return { ...STAND, squashX: 1 + .14 * s, squashY: 1 - .16 * s, eyeStyle: s > .4 ? 'squint' : 'open' };
  } },
  shake: { loop: false, duration: .9, fn: ({ t }) => {
    const s = sin(t * 34) * (1 - t / .9);
    return { ...SIT, headRot: s * .3, headX: SIT.headX + s * 2, rot: s * .03, eyeStyle: 'closed', fur: Math.abs(s) * .7, headTurn: 0 };
  } },
  // the wind-up before a pounce as a cat does it: the rump wiggles three quick times (drawings of 0.075 s, the tail tip a drawing
  // behind), then everything is still for half a second, eyes locked, and again.
  crouch: { loop: true, fn: ({ t, intensity }) => {
    const c = t % 1.4, k = Math.floor(c / .075), W = [1, .3, -1, -.3], on = c < .9;
    const w = on ? W[k % 4] * intensity : 0, late = on && k > 0 ? W[(k - 1) % 4] * intensity : 0;
    return { ...CROUCH, hx: CROUCH.hx + w * 1.6, hy: CROUCH.hy - Math.abs(w) * 1.5, bnX: CROUCH.bnX + w * .8, tailA: CROUCH.tailA + late * .12, tailBend: .05 + late * .06, ears: on ? 0 : .12 };
  } },
  leap: { loop: true, fn: () => LEAP },
  bat: { loop: false, duration: .6, fn: ({ t }) => {
    const s = t < .2 ? easeOut(t / .2) : 1 - smooth((t - .2) / .4);
    const base = pose({ hx: -17, hy: -29, sx: 15, sy: -29, headX: 31, headY: -60, headTurn: .5, lookY: .5, eyeStyle: 'wide', tailA: -2.6 });
    return { ...base, fnX: base.fnX + 20 * s, fnY: -20 * s + 15 * s * s };
  } },
  push: { loop: true, fn: ({ phase }) => {
    const p = gait(pose({ sx: 17, sy: -32, headX: 35, headY: -48, headRot: .22, headTurn: .5, lookY: .5, tailA: -2.2, eyeStyle: 'wide' }), phase, 16, 5, .6, [0, .5, .5, 0]);
    return { ...p, headX: p.headX + sin(phase * TAU * 2) * 1.2 };
  } },
  hugKick: { loop: true, fn: ({ t }) => {
    const k = sin(t * 13);
    return { ...SIDE, eyeStyle: 'squint', headX: 28, headY: -30, headRot: .7, fnX: 34, fnY: -16, ffX: 37, ffY: -20, bnX: 18 + k * 7, bnY: -8 + Math.abs(k) * 4, bfX: 21 - k * 7, bfY: -11, mouth: 'open', mouthOpen: .4, tailA: 3.1 + sin(t * 6) * .2 };
  } },
  meow: { loop: false, duration: 1.1, fn: ({ t }) => {
    const o = t < .25 ? easeOut(t / .25) : t < .65 ? 1 : 1 - smooth((t - .65) / .45);
    return { ...SIT, headY: SIT.headY - 3 * o, headRot: -.1 * o, headTurn: .05, mouth: 'meow', mouthOpen: o };
  } },
  lookUp: { loop: true, fn: ({ t }) => {
    const chatter = ((t % 3.2) < 1) ? Math.max(0, sin(t * 26)) * .6 : 0;
    return breathe({ ...SIT, headY: SIT.headY - 2, headRot: -.24, lookY: -1, lookX: .5 + sin(t * .9) * .5, eyeStyle: 'wide', mouth: chatter > .05 ? 'open' : 'w', mouthOpen: chatter, tailSway: sin(t * 4) * .4 }, t);
  } },
  strum: { loop: true, fn: ({ t }) => {
    const s = sin(t * 8);
    return breathe({ ...SIDE_SIT, pawOver: 1, fnX: 25, fnY: -36 + s * 6, eyeStyle: 'happy', blush: .5, headRot: sin(t * 2) * .08 }, t);
  } },
  wheel: { loop: true, fn: ({ phase }) => runPose(phase) },
  hide: { loop: true, fn: ({ t }) => ({ ...breathe(LOAF, t), eyeStyle: ((t % 5) < 2.2 ? 'open' : 'sleepy'), eyes: .8, lookX: sin(t * .7) }) },
  watch: { loop: true, fn: ({ t }) => breathe({ ...LOAF, eyeStyle: 'open', lookX: sin(t * 1.3) * .8, lookY: .3, headTurn: .3 + sin(t * 1.3) * .2, tuck: .8, tailSway: sin(t * 2.5) * .3 }, t) },
  allogroom: { loop: true, fn: ({ t }) => {
    const lick = sin(t * 8) > 0 ? 1 : .2;
    return { ...pose({ sx: 17, sy: -34, headX: 36, headY: -54, headRot: .2, headTurn: .4, tailA: -1.9, tailBend: .2 }), eyeStyle: 'closed', mouth: 'lick', mouthOpen: lick, headY: -54 + sin(t * 8) * 1.2, blush: .4 };
  } },
  breeze: { loop: true, fn: ({ t }) => breathe({ ...LOAF, eyeStyle: (t % 6) < 4 ? 'squint' : 'happy', ears: .3 + sin(t * 9) * .1, fur: .6 + sin(t * 14) * .3 }, t) },
  paw: { loop: true, fn: ({ t }) => {
    const c = t % 2.4, s = c < .5 ? sin(c / .5 * Math.PI) : 0;
    return { ...SIDE_SIT, pawOver: s > .2 ? 1 : 0, fnX: SIDE_SIT.fnX + 20 * s, fnY: -30 * s, lookX: .8, lookY: .2, eyeStyle: 'wide', headTurn: .5 };
  } },
  /**
   * Gym: sitting, facing us (the front model), curling a barbell from the lap up to under the chin
   * with both paws (the bar is drawn through the rig's `props`). Sets of three reps, then a
   * breather. Tired cats lift slower and only halfway, eyes half shut.
   */
  lift: { loop: true, fn: ({ t, intensity }) => {
    const tired = intensity < .4, ph = liftPhase(t, tired), reach = tired ? .55 : 1;
    const base = { ...SIT, headTurn: 0, lookX: 0, tailWag: tired ? 0 : .3 };
    if (ph.resting) {
      // Bar down on the lap, panting, then a proud little smile before the next set.
      const proud = ph.c > .55, pant = (Math.sin(t * 9) + 1) / 2;
      return breathe({ ...base, armsUp: .03, headTurn: proud ? .2 : 0, eyeStyle: proud ? 'happy' : tired ? 'sleepy' : 'open', eyes: tired ? .5 : 1,
        mouth: proud ? 'smile' : 'open', mouthOpen: proud ? 0 : .15 + pant * .2, brow: tired ? .6 : 0, blush: .5, tailWag: tired ? 0 : .5 }, t, 1.4, 1.1);
    }
    return breathe({ ...base, armsUp: .03 + ph.up * .97 * reach, headRot: ph.strain ? -.04 : 0,
      eyeStyle: tired ? 'sleepy' : ph.strain ? 'closed' : 'open', eyes: tired ? .5 : 1, mouth: ph.strain && !tired ? 'flat' : 'w',
      brow: ph.strain ? -.6 : tired ? .6 : 0, blush: ph.strain ? .8 : .2, squashY: 1 - ph.up * .015, squashX: 1 + ph.up * .01 }, t, 2.2, .4);
  } },
  /** Study: side view at the desk, front paws on the desktop (paw y ≈ -31 = desk top). */
  study: { loop: true, fn: ({ t, intensity }) => studyPose('write', t, intensity) },
  studyRead: { loop: true, fn: ({ t, intensity }) => studyPose('read', t, intensity) },
  studyWrite: { loop: true, fn: ({ t, intensity }) => studyPose('write', t, intensity) },
  studyLab: { loop: true, fn: ({ t, intensity }) => studyPose('lab', t, intensity) },
  studyGlobe: { loop: true, fn: ({ t, intensity }) => studyPose('globe', t, intensity) },
  /** Sitting in the bath, unhappy and wet. */
  bath: { loop: true, fn: ({ t, intensity }) => {
    const shiver = sin(t * 24) * .4 * (1 - intensity);
    return { ...SIDE_SIT, ears: .7 - intensity * .5, eyeStyle: intensity > .7 ? 'happy' : intensity > .35 ? 'sleepy' : 'open', mouth: intensity > .6 ? 'w' : 'flat', brow: intensity < .3 ? .8 : 0,
      headX: SIT.headX + shiver, headTurn: 0, fur: .3, tailWag: 0, blush: intensity > .7 ? .6 : 0 };
  } },
  /** A wary stray peeking out: crouched, ears up, huge eyes. */
  peek: { loop: true, fn: ({ t, seed }) => idle({ ...LOAF, tuck: .7, headTurn: 0, eyeStyle: 'wide', ears: (t % 5) < .4 ? .5 : 0, lookX: sin(t * .8 + seed) * .7, tailWag: .2 }, t, seed) },
  /** Fantastic act: a happy bounce; the costume layer is drawn by the renderer. */
  act: { loop: true, fn: ({ t }) => ({ ...SIT, headTurn: 0, eyeStyle: (t % 3) < .25 ? 'happy' : 'open', mouth: 'smile', squashY: 1 + Math.max(0, sin(t * 5)) * .03, squashX: 1 - Math.max(0, sin(t * 5)) * .02 }) },
  /** Tummy rumble: slumped and sad. */
  hungry: { loop: true, fn: ({ t }) => idle({ ...LOAF, eyeStyle: 'sleepy', eyes: .5, brow: .8, mouth: 'flat', ears: .4, headY: LOAF.headY + 4 }, t, 0) },
  /** Excited hop when something nice happens: crouch, push off, hang, land with a wobble (game/art/hop.ts). */
  cheer: { loop: false, duration: HOP_LEN, fn: ({ t }) => {
    const h = hopFrame(t);
    return { ...SIT, headTurn: 0, lift: h.lift, squashY: h.squashY, squashX: h.squashX, headY: SIT.headY + h.load * 3 - h.air * 2, ears: h.load * .35,
      eyeStyle: h.load > .5 ? 'open' : 'happy', mouth: h.air > .2 ? 'open' : 'smile', mouthOpen: h.air * .5, blush: .8, tailA: SIT.tailA - h.air * .6 };
  } },
} satisfies Record<string, ClipSpec>;

export type ClipName = keyof typeof CLIPS;
export const clipNames = Object.keys(CLIPS) as ClipName[];

/**
 * the reference style never shows a pose half-way into another; it swaps the drawing in one frame and
 * a little jelly pop covers the change. Between these families of resting poses (sitting up, loaf, lying out, on the back, curled) a
 * tween runs through shapes nobody drew (a body half turned over, a head half way round), so the renderer swaps instead
 * (`poseSwap`). Moves inside a family, and anything from or to walking and standing, still blend.
 */
const POSE_FAMILY: Partial<Record<ClipName, 'sit' | 'loaf' | 'lie' | 'belly' | 'curl'>> = {
  sit: 'sit', sitFront: 'sit', sitBack: 'sit', sitPlay: 'sit', groom: 'sit', yawn: 'sit', lookUp: 'sit', tailAway: 'sit',
  loaf: 'loaf', chinRest: 'loaf', hide: 'loaf', watch: 'loaf', peek: 'loaf', breeze: 'loaf', loafPet: 'loaf', hungry: 'loaf', sleepLoaf: 'loaf', sleepChin: 'loaf',
  lounge: 'lie', sleepSide: 'lie', sleepBlep: 'lie', sleepSprawl: 'lie', sleepSuperman: 'lie', sleepAway: 'lie', groomBack: 'lie',
  ballDrape: 'lie', bellyUp: 'belly', sleepBelly: 'belly', sleepSnore: 'belly', petLie: 'belly', ballLie: 'belly', bellyTrap: 'belly',
  sleep: 'curl', sleepPaw: 'curl',
};
export const poseSwap = (from: ClipName | undefined, to: ClipName) => !!from && !!POSE_FAMILY[from] && !!POSE_FAMILY[to] && POSE_FAMILY[from] !== POSE_FAMILY[to];
/** the reference style's jelly pop over a swap, `u` 0..1 through it: [squashX, squashY] (down, a little up, settle). */
export function swapPop(u: number): [number, number] {
  const k = Math.sin(clamp(u, 0, 1) * Math.PI * 1.6) * (1 - clamp(u, 0, 1)) ** 1.2;
  return [1 + .07 * k, 1 - .1 * k];
}

export function sampleClip(name: ClipName, input: ClipInput): Pose {
  const clip: ClipSpec = CLIPS[name];
  const t = clip.loop ? input.t : clamp(input.t, 0, clip.duration ?? 1);
  return clip.fn({ ...input, t });
}

export const clipDuration = (name: ClipName) => (CLIPS[name] as ClipSpec).duration ?? Infinity;
/** The six ways of riding a parachute. */
export const CHUTE_CLIPS = new Set<ClipName>(['chute', 'chuteSwing', 'chuteDance', 'chuteChill', 'chuteScared', 'chuteNap']);
export const SLEEP_CLIPS = new Set<ClipName>(['sleep', 'sleepLoaf', 'sleepSide', 'sleepBelly', 'sleepSprawl', 'sleepSuperman', 'sleepAway']);
export { lerp };
