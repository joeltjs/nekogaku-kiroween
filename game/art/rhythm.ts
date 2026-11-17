/**
 * the reference style rhythm (from its SpriteAnimation data: a part plays 4–8 frames at 5 fps, then
 * holds for a random 1–3 s, "delayLoop"): a body part moves in a short burst, then rests still.
 * Returns 0 while resting and rises/falls smoothly to 1 during a burst. Deterministic in `t`, so it
 * needs no state; `salt` gives each part (and each cat, via its time offset) its own pattern.
 */
export function burst(t: number, salt = 0, move = 1.3, restMin = 1, restMax = 3.2) {
  const span = move + (restMin + restMax) / 2, k = Math.floor((t + salt * 7.77) / span);
  const r = (n: number) => { const x = Math.sin((k + n) * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
  // Each cycle: a rest of random length, then the move.
  const start = k * span - salt * 7.77, rest = restMin + r(1) * (restMax - restMin), local = t - start;
  if (local < rest || local > rest + move) return 0;
  const u = (local - rest) / move;
  return Math.sin(u * Math.PI) ** 2;
}

/**
 * the same rest-then-move rhythm, but the move is a flick that overshoots and
 * settles like a spring (a damped swing), −1..1. Sample it a little later for each point further down a tail (`t - i × lag`) and the flick
 * travels from the root to the tip and the tip whips after it: follow-through, without any state.
 */
export function spring(t: number, salt = 0, move = 1.7, restMin = 1.4, restMax = 4.2) {
  const span = move + (restMin + restMax) / 2, k = Math.floor((t + salt * 7.77) / span);
  const r = (n: number) => { const x = Math.sin((k + n) * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
  const start = k * span - salt * 7.77, rest = restMin + r(1) * (restMax - restMin), local = t - start - rest;
  if (local < 0 || local > move) return 0;
  const side = r(2) < .5 ? -1 : 1;
  // Eased in over the first 0.12 s, then a swing of ~1.5 Hz dying away, faded to rest by the end of the move.
  return side * Math.min(1, local / .12) * Math.exp(-local * 2.6) * Math.sin(local * Math.PI * 2 * 1.5) * Math.min(1, (move - local) / .3);
}

// ———————————————————————————————————————— A14: frame rhythm
//
// the reference style does not compute motion: every move is a run of whole drawings played at a fixed pace, then a rest. The numbers below are
// that pace; the drawings themselves are our own poses
// (game/art/cat-frames.ts, cat-clips.ts). Everything here is a pure function of time and a salt, so it needs no state and never touches the
// world's dice: the random length of a rest comes from a hash of the cycle's number.

/** The pace of each run of frames: how many drawings, how long each is shown (s), and the rest after it (s, min..max). */
export const REF_TIMING = {
  /** One swish from root to tip, then still. */
  tail: { frames: 16, dur: .2, rest: [4, 8] },
  /** One breath in and out, then a pause exhaled (the pause grows with the clip's own breathing rate: asleep it is longer). */
  breath: { frames: 5, dur: .4, rest: [1, 2] },
  /** A flick of one ear. */
  ear: { frames: 3, dur: .08, rest: [5, 9] },
  /** The eyes (and a little of the head) go to a new spot in two in-between drawings, then rest there. */
  glance: { frames: 2, dur: .1, rest: [3.5, 6] },
  /** A tilt of the head: over, held, back. */
  tilt: { frames: 8, dur: .2, rest: [5, 9] },
  /**
   * Walking: four key drawings of 0.25 s at the reference style's stroll of 18 px/s, an in-between after each. Our cats walk further and faster, so the
   * drawing is picked by the distance walked (a planted paw then stays on its spot at any speed): one cycle is `pace × keys × key` px.
   */
  walk: { keys: 4, key: .25, pace: 18, frames: 8 },
  /** The legacy clips that still compute their pose are shown on this grid of drawings a second. */
  legacyFps: 10,
} as const;

/** 0..1 from two numbers; the same every time. */
export function hash01(a: number, b = 0) { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }

/**
 * A move of `active` seconds, then a rest of restMin..restMax seconds, again and again. Returns the seconds into the current move
 * (`u`, or −1 while resting) and the number of the cycle (`n`, to pick a side or a variant with hash01).
 */
export function beat(t: number, salt: number, active: number, restMin: number, restMax: number) {
  const half = (restMax - restMin) / 2, span = active + restMin + half, c = t + salt * 7.77, n = Math.floor(c / span);
  // Each move starts a little into its cycle; the rest between two moves then runs from restMin to restMax.
  const u = c - n * span - hash01(n, salt) * half;
  return { u: u >= 0 && u < active ? u : -1, n };
}
/** Time snapped down to a grid of `fps` drawings a second. */
export const stepT = (t: number, fps: number) => Math.floor(t * fps + 1e-6) / fps;

/**
 * The tail's swish, drawn as 16 frames: the root's swing at each frame (a small wind-up the other way, the swing, a pass back through
 * to the other side, a smaller return, rest). A point further down the tail shows the root's drawing of up to three frames earlier
 * (`along` 0 root .. 1 tip), so the bend travels down the tail and the tip arrives last (follow-through).
 */
const TAIL_SWISH = [0, -.2, .28, .8, 1, .78, .3, -.3, -.72, -.8, -.5, -.12, .18, .22, .1, 0];
const TAIL_LAG = 3;
export function tailFlick(t: number, salt: number, along: number) {
  const { frames, dur, rest } = REF_TIMING.tail, b = beat(t, salt, frames * dur, rest[0], rest[1]);
  if (b.u < 0) return 0;
  const f = Math.floor(b.u / dur) - clampUnit(along) * TAIL_LAG;
  if (f <= 0) return 0;
  const i = Math.floor(f), k = f - i, a = TAIL_SWISH[i] ?? 0, c = TAIL_SWISH[i + 1] ?? 0;
  return (hash01(b.n, salt + 1) < .5 ? -1 : 1) * (a + (c - a) * k);
}
const clampUnit = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A breath as 5 frames (0 exhaled .. 1 full), then the pause. `rate` is the clip's breathing period: the pause is .3–.6 of it. */
const BREATH = [.35, .85, 1, .6, .2];
export function breathLevel(t: number, salt = 0, rate = 3.4) {
  const { frames, dur } = REF_TIMING.breath, b = beat(t, salt, frames * dur, rate * .3, rate * .6);
  return b.u < 0 ? 0 : BREATH[Math.min(frames - 1, Math.floor(b.u / dur))];
}

/** One ear flicks: three frames, then still for seconds. 0..1. */
const EAR = [.7, 1, .45];
export function earBeat(t: number, salt: number) {
  const { frames, dur, rest } = REF_TIMING.ear, b = beat(t, salt, frames * dur, rest[0], rest[1]);
  return b.u < 0 ? 0 : EAR[Math.min(frames - 1, Math.floor(b.u / dur))];
}

/**
 * A value that rests on one of `spots`, then goes to the next in two in-between drawings and rests there (the eyes, a turn of the head).
 */
const GLANCE_IN = [.45, .85];
export function heldStep(t: number, salt: number, spots: readonly number[]) {
  const { frames, dur, rest } = REF_TIMING.glance, b = beat(t, salt, frames * dur, rest[0], rest[1]);
  const at = (k: number) => spots[Math.floor(hash01(k, salt + 2) * spots.length) % spots.length];
  // Resting: on this cycle's spot once its move is over, on the last one before it.
  if (b.u < 0) { const span = frames * dur + (rest[0] + rest[1]) / 2, c = t + salt * 7.77, into = c - b.n * span - hash01(b.n, salt) * (rest[1] - rest[0]) / 2; return at(into < 0 ? b.n - 1 : b.n); }
  const from = at(b.n - 1), to = at(b.n);
  return from + (to - from) * GLANCE_IN[Math.min(frames - 1, Math.floor(b.u / dur))];
}

/** A tilt of the head: eased over, held, eased back (8 frames), then a long rest. −1..1 (the side changes from tilt to tilt). */
const TILT = [.5, .9, 1, 1, 1, 1, .6, .2];
export function tiltBeat(t: number, salt: number) {
  const { frames, dur, rest } = REF_TIMING.tilt, b = beat(t, salt, frames * dur, rest[0], rest[1]);
  return b.u < 0 ? 0 : (hash01(b.n, salt + 3) < .5 ? -1 : 1) * TILT[Math.min(frames - 1, Math.floor(b.u / dur))];
}
