import { tailFlick } from './rhythm';
import { clamp } from '../core/math';
import { INK, mix, shade, type CatLook, type Physique } from './cat-look';
import { INNER_LINE, PolyPen, buildMold, capsulePoly, chain, ellipsePoly, extendCache, extendMold, inkSilhouette, innerInk, inside as insidePoly, moldKey, tapMold, underline, moldCache, pathOf, rotate, scale as scaleM, strokePoly, transformPoly, translate, type Mat, type MoldJoin, type MoldPart, type Poly } from './cat-mold';

/**
 * Cut-out cat in the the reference style manner. The body is one smooth outline swept along a bent
 * spine (no seams or folds), legs are thick capsules merged into that outline, the tail is a
 * thick stroke and the big head faces the viewer, turns three-quarters or shows its back.
 * Coordinates face right; the origin is the ground under the cat; y grows downward.
 */
export type EyeStyle = 'open' | 'happy' | 'closed' | 'squint' | 'wide' | 'sleepy' | 'blank';
export type MouthStyle = 'w' | 'open' | 'yawn' | 'lick' | 'meow' | 'flat' | 'chew' | 'smile';

export interface Pose {
  /** Spine: hip and shoulder centres with their radii; `arch` bends the back up (+) or down (−). */
  hx: number; hy: number; sx: number; sy: number; rh: number; rs: number; arch: number;
  headX: number; headY: number; headRot: number; headScale: number;
  /** −1..1: face turned away from (−) or toward (+) the facing direction. */
  headTurn: number;
  /** 0..1: back of the head, face hidden. */
  headBack: number;
  eyes: number; eyeStyle: EyeStyle; mouth: MouthStyle; mouthOpen: number;
  ears: number; earTwitch: number; lookX: number; lookY: number; blush: number; brow: number;
  fnX: number; fnY: number; ffX: number; ffY: number; bnX: number; bnY: number; bfX: number; bfY: number;
  thigh: number; tuck: number; tuckBack: number;
  /** Near front paw drawn over the face (grooming, batting). */
  pawOver: number;
  /** 0..1: near front paw pulled to the mouth, wherever the head is. */
  pawMouth: number;
  /** Offset of that paw from the mouth (wiping cheeks and ears). */
  pawDX: number; pawDY: number;
  tailA: number; tailBend: number; tailTip: number; tailLen: number; tailFront: number; tailWag: number; tailSway: number;
  lift: number; rot: number; squashX: number; squashY: number; fur: number; bellyUp: number;
  /** 0..1: drawn as the reference style's three-quarter sitting cat (the front model) instead of the side rig. */
  front: number;
  /** Front model, 0..1: both front legs up holding a bar, from the lap (0) to under the chin (1); 0 = standing legs. */
  armsUp: number;
  /** 0..1: how strong the cat's arms look (the gym stages): thicker forelegs, a bump of muscle. */
  muscle: number;
  /**
   * Front model standing on two legs: `upright` 0..1 raises the body onto two straight hind legs and turns the
   * front legs into arms. `stride` −1..1: the walk, left foot forward (+) or right (−). Arms: `armLA`/`armRA` the shoulder
   * angle from hanging down (0) through out to the side (π/2) to straight up (π); `armLB`/`armRB` the elbow bend (+ further
   * up and over, − back in front of the chest). All 0 by default: every older pose looks as before.
   * `gait` 0..1: a walk whose steps match the ground: a longer reach (GAIT_REACH) and the foot in the air
   * is the one swinging forward (`strideUp`, the stride's rate of change: + the left foot is swinging up), so the other one
   * stays planted while the body passes over it. 0 keeps the older walk; up to 2 for the longer reach of a run.
   * `legSpread` 0..1: the legs flung open and the knees bent up, as Tom in the air on his bed.
   */
  upright: number; stride: number; armLA: number; armRA: number; armLB: number; armRB: number; gait: number; strideUp: number; legSpread: number;
  /**
   * rise_paw: 0..1, above.5 a SITTING front-model cat facing us
   * lifts a front leg as a short arm with a round paw, the standing cat's arm (`armLA`/`armRA` > 0 pick the side). 0 by default: every
   * older pose looks as before.
   */
  sitArm: number;
  headPitch: number;
  /**
   * The face's emotion layer. All default to "no change", so every older pose looks as before.
   * `lid` 0..1: an upper eyelid covering the top of the eye; `lidTilt` −1..1: more cover at the nose end (+, cross) or at the outer end (−, sad);
   * `pupil`: size of the pupil (1 usual, small in fright, big in delight); `browLift` −1..1 raises both brows, `browAsym` −1..1 raises one alone;
   * `mouthCurve`: the bend of the cat mouth (1 the usual ω, 0 flat, −1 turned down); `tear` 0..1: tears on the lower lids.
   */
  lid: number; lidTilt: number; pupil: number; browLift: number; browAsym: number; mouthCurve: number; tear: number;
}

export const NUMERIC_KEYS = ['hx', 'hy', 'sx', 'sy', 'rh', 'rs', 'arch', 'headX', 'headY', 'headRot', 'headScale', 'headTurn', 'headBack', 'eyes', 'mouthOpen', 'ears', 'earTwitch',
  'lookX', 'lookY', 'blush', 'brow', 'fnX', 'fnY', 'ffX', 'ffY', 'bnX', 'bnY', 'bfX', 'bfY', 'thigh', 'tuck', 'tuckBack', 'pawOver', 'pawMouth', 'pawDX', 'pawDY',
  'tailA', 'tailBend', 'tailTip', 'tailLen', 'tailFront', 'tailWag', 'tailSway', 'lift', 'rot', 'squashX', 'squashY', 'fur', 'bellyUp', 'front', 'armsUp', 'muscle', 'upright', 'stride', 'armLA', 'armRA', 'armLB', 'armRB', 'gait', 'strideUp', 'legSpread', 'sitArm', 'headPitch',
  'lid', 'lidTilt', 'pupil', 'browLift', 'browAsym', 'mouthCurve', 'tear'] as const;

// the reference style's cat on four legs is long and low (W/H 1.16 without the tail); the spine was 36 long (W/H 1.05), now 44.
export const STAND: Pose = {
  hx: -23, hy: -35, sx: 21, sy: -37, rh: 17.5, rs: 16.5, arch: .06,
  headX: 29, headY: -73, headRot: 0, headScale: 1, headTurn: .25, headBack: 0,
  eyes: 1, eyeStyle: 'open', mouth: 'w', mouthOpen: 0, ears: 0, earTwitch: 0, lookX: 0, lookY: 0, blush: 0, brow: 0,
  fnX: 15, fnY: 0, ffX: 22, ffY: -2, bnX: -22, bnY: 0, bfX: -15, bfY: -2,
  thigh: 0, tuck: 0, tuckBack: 0, pawOver: 0, pawMouth: 0, pawDX: 0, pawDY: 0,
  tailA: -2.05, tailBend: .1, tailTip: .35, tailLen: 40, tailFront: 0, tailWag: .5, tailSway: 0,
  lift: 0, rot: 0, squashX: 1, squashY: 1, fur: 0, bellyUp: 0, front: 0, armsUp: 0, muscle: 0,
  upright: 0, stride: 0, armLA: 0, armRA: 0, armLB: 0, armRB: 0, gait: 0, strideUp: 0, legSpread: 0, sitArm: 0, headPitch: 0,
  lid: 0, lidTilt: 0, pupil: 1, browLift: 0, browAsym: 0, mouthCurve: 1, tear: 0,
};

export function pose(overrides: Partial<Pose> = {}, base: Pose = STAND): Pose { return { ...base, ...overrides }; }

/** The spine's geometry: hip and shoulder positions and radii. */
const SPINE_KEYS = new Set<string>(['hx', 'sx', 'rh', 'rs']);
const spineLength = (p: Pose) => Math.hypot(p.sx - p.hx, p.sy - p.hy);

/**
 * Blends two poses. A plain straight blend between sitting (hip under the shoulders, a short bell) and standing
 * (a long spine) passes through a ball: the spine is half as long while the radii are still fat (ng-dkx.25, the
 * "montok" cat when petted). So the spine stretches first when the cat rises, and collapses last when it sits down.
 */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = { ...b } as Pose;
  const record = out as unknown as Record<string, number>;
  const spineT = spineLength(b) > spineLength(a) ? 1 - (1 - t) * (1 - t) : t * t;
  for (const key of NUMERIC_KEYS) record[key] = (a[key] as number) + ((b[key] as number) - (a[key] as number)) * (SPINE_KEYS.has(key) ? spineT : t);
  out.eyeStyle = t < .5 ? a.eyeStyle : b.eyeStyle;
  out.mouth = t < .5 ? a.mouth : b.mouth;
  return out;
}

export interface DrawOptions {
  facing: 1 | -1;
  scale: number;
  blink?: number;
  time?: number;
  /** Clip everything below this local y (peeking out of boxes and tubs). */
  clipBelow?: number;
  /** 0..1 grime from a dirty litter box; 0..1 wet fur in the bath. */
  dirt?: number; wet?: number;
  /**
   * Things the cat holds or leans on (a barbell, a desk and its book), drawn in the cat's own space
   * (feet at 0, unscaled units) after the body and head but under a raised front paw, so props sit
   * exactly at the paws whatever the cat's age or size and the near paw grips over them.
   */
  props?: (ctx: CanvasRenderingContext2D, paws: { near: P; far: P; legScale: number }) => void;
}

export const OUTLINE = 2;
type P = { x: number; y: number };

// ———————————————————————————————————————— geometry

interface Spine { pts: P[]; nrm: P[]; tan: P[]; rTop: number[]; rBot: number[]; len: number; hip: P; shoulder: P; rh: number; rs: number; drop: number }
const SAMPLES = 12;
/** the reference style cats are chunky: a solid torso under a wide head. */
const BODY_K = 1.12;

/** Lowers the whole body onto the reference style's short legs (genes, kittens, fat too) so paws stay on the ground. */
function legDrop(p: Pose, phys: Physique) {
  const gap = Math.max(0, -Math.max(p.hy + p.rh, p.sy + p.rs) - 2);
  return gap * (1 - (phys.stance ?? phys.leg)) * (1 - p.tuck * .9);
}

function spine(p: Pose, phys: Physique): Spine {
  const drop = legDrop(p, phys);
  const mid = { x: (p.hx + p.sx) / 2, y: (p.hy + p.sy) / 2 + drop };
  const hip = { x: mid.x + (p.hx - mid.x) * phys.bodyLen, y: mid.y + (p.hy - (p.hy + p.sy) / 2) * phys.bodyLen };
  const shoulder = { x: mid.x + (p.sx - mid.x) * phys.bodyLen, y: mid.y + (p.sy - (p.hy + p.sy) / 2) * phys.bodyLen };
  const dx = shoulder.x - hip.x, dy = shoulder.y - hip.y, len = Math.hypot(dx, dy) || 1;
  const up = { x: dy / len, y: -dx / len };
  const arch = p.arch + phys.thin * .14 * (p.bellyUp > .5 ? -1 : 1);
  const ctrl = { x: mid.x + up.x * arch * len, y: mid.y + up.y * arch * len };
  // Grown cats are a slimmer bean, not a tube: deep chest, the belly rising toward the hind legs
  // (tuck-up), a gentle dip behind the shoulders. Kittens stay round, fat cats fill it in.
  const adult = 1 - phys.kitten, fill = Math.min(1, Math.max(0, phys.body - 1) * 3), shape = adult * (1 - fill);
  // the reference style's grown cats are a chunky bean, not a lean athlete (the slimming was.12 and the flank tuck.24).
  const slim = 1 - .03 * adult * (1 - fill);
  const rh = p.rh * phys.body * BODY_K * slim, rs = p.rs * (1 + (phys.body - 1) * .75) * BODY_K * slim;
  const pts: P[] = [], tan: P[] = [], nrm: P[] = [], rTop: number[] = [], rBot: number[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    pts.push({ x: a * hip.x + b * ctrl.x + c * shoulder.x, y: a * hip.y + b * ctrl.y + c * shoulder.y });
    const tx = 2 * (1 - u) * (ctrl.x - hip.x) + 2 * u * (shoulder.x - ctrl.x), ty = 2 * (1 - u) * (ctrl.y - hip.y) + 2 * u * (shoulder.y - ctrl.y), tl = Math.hypot(tx, ty) || 1;
    tan.push({ x: tx / tl, y: ty / tl }); nrm.push({ x: ty / tl, y: -tx / tl });
    const r = rh + (rs - rh) * (u * u * (3 - 2 * u));
    const sag = phys.belly * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 1.4;
    // Bellies sag toward the ground even when the cat lies on its back.
    const tuck = phys.thin * r * .28 * Math.sin(Math.PI * u);
    const chest = Math.exp(-(((u - .8) / .17) ** 2)), flank = Math.exp(-(((u - .3) / .15) ** 2));
    const back = r * (1 - .08 * shape * Math.sin(Math.PI * u) + .03 * shape * Math.exp(-(((u - .1) / .12) ** 2)));
    const belly = r * (1 + .08 * shape * chest - .07 * shape * flank);
    rTop.push(p.bellyUp > .5 ? belly + sag - tuck : back); rBot.push(p.bellyUp > .5 ? back : belly + sag - tuck);
  }
  return { pts, nrm, tan, rTop, rBot, len, hip, shoulder, rh, rs, drop };
}

/** Point on the body: u along the spine 0..1, v across from back (−1) to belly (1). */
function bodyPoint(s: Spine, u: number, v: number): P & { r: number } {
  const f = Math.max(0, Math.min(1, u)) * SAMPLES, i = Math.min(SAMPLES - 1, Math.floor(f)), t = f - i;
  const c = { x: s.pts[i].x + (s.pts[i + 1].x - s.pts[i].x) * t, y: s.pts[i].y + (s.pts[i + 1].y - s.pts[i].y) * t };
  const n = { x: s.nrm[i].x + (s.nrm[i + 1].x - s.nrm[i].x) * t, y: s.nrm[i].y + (s.nrm[i + 1].y - s.nrm[i].y) * t };
  const r = v < 0 ? s.rTop[i] + (s.rTop[i + 1] - s.rTop[i]) * t : s.rBot[i] + (s.rBot[i + 1] - s.rBot[i]) * t;
  // Beyond the ends, continue along the tangent.
  const ext = u < 0 ? u * s.len : u > 1 ? (u - 1) * s.len : 0;
  const tg = u < 0 ? s.tan[0] : s.tan[SAMPLES];
  return { x: c.x - n.x * v * r + tg.x * ext, y: c.y - n.y * v * r + tg.y * ext, r };
}

function bodyOutline(s: Spine, fluff: number): P[] {
  const out: P[] = [];
  // on the inside of a tight curl (a fat cat asleep in a ball) the belly line is offset further than the spine bends, and the offset
  // folds back on itself into a little loop that drew as a blob under the cat. A point that does not move on along the spine is dropped.
  const along = (q: P, i: number, dir: 1 | -1) => { const last = out[out.length - 1]; return !last || ((q.x - last.x) * s.tan[i].x + (q.y - last.y) * s.tan[i].y) * dir > 0; };
  for (let i = 0; i <= SAMPLES; i++) { const q = { x: s.pts[i].x + s.nrm[i].x * s.rTop[i], y: s.pts[i].y + s.nrm[i].y * s.rTop[i] }; if (along(q, i, 1)) out.push(q); }
  const cap = (i: number, dir: 1 | -1, from: 'top' | 'bot') => {
    const c = s.pts[i], n = s.nrm[i], t = s.tan[i], rt = s.rTop[i], rb = s.rBot[i];
    for (let k = 1; k < 10; k++) {
      const a = (k / 10) * Math.PI;
      const side = from === 'top' ? Math.cos(a) : -Math.cos(a);
      const rn = side >= 0 ? rt : rb, rr = (rt + rb) / 2 * 1.02;
      out.push({ x: c.x + n.x * side * rn + t.x * dir * Math.sin(a) * rr, y: c.y + n.y * side * rn + t.y * dir * Math.sin(a) * rr });
    }
  };
  cap(SAMPLES, 1, 'top');
  const bottom = out.length;
  for (let i = SAMPLES; i >= 0; i--) { const q = { x: s.pts[i].x - s.nrm[i].x * s.rBot[i], y: s.pts[i].y - s.nrm[i].y * s.rBot[i] }; if (out.length === bottom || along(q, i, -1)) out.push(q); }
  cap(0, -1, 'bot');
  return fluff > .05 ? tufted(out, fluff) : out;
}

/** Turns a smooth outline into soft fur tufts (long hair, round fat cats, fluffy kittens). */
function tufted(poly: P[], fluff: number): P[] {
  const dense: P[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / 2.2));
    for (let k = 0; k < n; k++) dense.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
  }
  const cx = dense.reduce((s, p) => s + p.x, 0) / dense.length, cy = dense.reduce((s, p) => s + p.y, 0) / dense.length;
  let arc = 0;
  return dense.map((p, i) => {
    if (i) arc += Math.hypot(p.x - dense[i - 1].x, p.y - dense[i - 1].y);
    const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
    const wave = Math.abs(Math.sin(arc / 7.5 * Math.PI)) ** .6;
    const k = (wave - .55) * 2.4 * fluff;
    return { x: p.x + dx / d * k, y: p.y + dy / d * k };
  });
}



/**
 * A soft limb: one tube along a curve from `a` through the bend `b` to `c`, thick at the
 * root and tapering (r0 → r1 at the bend → r2), so a leg is a drumstick with a knee and an arm bends round its elbow instead of two
 * straight sticks. `fill` is the closed shape; `side` is its outline without the root, for a limb that grows out of the body (an arm
 * in front of the chest) so no line cuts across where it joins.
 */
export function limb(a: P, b: P, c: P, r0: number, r1: number, r2: number, from = .16) {
  const k = { x: 2 * b.x - (a.x + c.x) / 2, y: 2 * b.y - (a.y + c.y) / 2 }, N = 16, left: P[] = [], right: P[] = [], ang: number[] = [];
  const ease = (u: number) => u * u * (3 - 2 * u);
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    const x = u * u * a.x + 2 * u * t * k.x + t * t * c.x, y = u * u * a.y + 2 * u * t * k.y + t * t * c.y;
    let dx = 2 * u * (k.x - a.x) + 2 * t * (c.x - k.x), dy = 2 * u * (k.y - a.y) + 2 * t * (c.y - k.y);
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const r = t < .5 ? r0 + (r1 - r0) * ease(t * 2) : r1 + (r2 - r1) * ease((t - .5) * 2), nx = -dy, ny = dx;
    left.push({ x: x + nx * r, y: y + ny * r }); right.push({ x: x - nx * r, y: y - ny * r }); ang.push(Math.atan2(ny, nx));
  }
  const fill = new Path2D(), side = new Path2D(), i0 = Math.round(from * N);
  fill.moveTo(left[0].x, left[0].y);
  for (let i = 1; i <= N; i++) fill.lineTo(left[i].x, left[i].y);
  fill.arc(c.x, c.y, r2, ang[N], ang[N] - Math.PI, true);
  for (let i = N; i >= 0; i--) fill.lineTo(right[i].x, right[i].y);
  fill.arc(a.x, a.y, r0, ang[0] + Math.PI, ang[0], true);
  fill.closePath();
  side.moveTo(left[i0].x, left[i0].y);
  for (let i = i0 + 1; i <= N; i++) side.lineTo(left[i].x, left[i].y);
  side.arc(c.x, c.y, r2, ang[N], ang[N] - Math.PI, true);
  for (let i = N; i >= i0; i--) side.lineTo(right[i].x, right[i].y);
  // The same outline as a polygon, for the mould.
  const pen = new PolyPen();
  pen.moveTo(left[0].x, left[0].y);
  for (let i = 1; i <= N; i++) pen.lineTo(left[i].x, left[i].y);
  pen.arc(c.x, c.y, r2, ang[N], ang[N] - Math.PI, true);
  for (let i = N; i >= 0; i--) pen.lineTo(right[i].x, right[i].y);
  pen.arc(a.x, a.y, r0, ang[0] + Math.PI, ang[0], true);
  return { fill, side, poly: pen.done()[0] };
}

/** A point on limb's centre line at `t` (0 root .. 1 end) and the limb's half-width there, the same curve and taper limb draws. */
export function limbAt(a: P, b: P, c: P, r0: number, r1: number, r2: number, t: number) {
  const k = { x: 2 * b.x - (a.x + c.x) / 2, y: 2 * b.y - (a.y + c.y) / 2 }, u = 1 - t, ease = (v: number) => v * v * (3 - 2 * v);
  return { x: u * u * a.x + 2 * u * t * k.x + t * t * c.x, y: u * u * a.y + 2 * u * t * k.y + t * t * c.y, r: t < .5 ? r0 + (r1 - r0) * ease(t * 2) : r1 + (r2 - r1) * ease((t - .5) * 2) };
}

/** Whether a coat colour is so dark that an ink outline vanishes on it (Mochi): its limbs then get a faint light rim. */
const isDark = (c: string) => { const m = /^#([0-9a-f]{6})$/iu.exec(c ?? ''); if (!m) return false; const n = parseInt(m[1], 16); return (.299 * (n >> 16 & 255) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255 < .3; };


// ———————————————————————————————————————— head

export interface HeadGeom { x: number; y: number; rot: number; W: number; H: number; mouth: P; scale: number }
const HEAD_W = 34, HEAD_H = 25;
/** How far a foot reaches from under the body in the ground-matched walk (`gait` 1), in head widths (front model). */
export const GAIT_REACH = .26; // shorter than.3 so the feet do not cross in the three-quarter view (game/kota-walk.ts slows to match)
/** How far the head sits from the shoulders relative to the pose (see headGeom). */
const HEAD_SEAT = .8;
/**
 * on all fours the reference style's head is about as wide as the body is long and sits low on the shoulders. The side
 * rig draws the head this much bigger than the physique's head (the sitting cat has its own SIT_HEAD), and seats it a little lower.
 */
export const SIDE_HEAD = 1.14;

export function headGeom(p: Pose, phys: Physique): HeadGeom {
  const drop = legDrop(p, phys);
  const W = HEAD_W * phys.head * p.headScale * SIDE_HEAD, H = HEAD_H * phys.head * phys.headRound * p.headScale * SIDE_HEAD;
  // Poses place the head for a full-size skull; the head is smaller than that, so it sits
  // proportionally closer to the shoulders (on the body, the reference style style, not up on a neck).
  // It follows the shoulder as the body grows or shrinks (spine scales the torso by bodyLen).
  const cx = (p.hx + p.sx) / 2, cy = (p.hy + p.sy) / 2, sx = cx + (p.sx - cx) * phys.bodyLen, sy = cy + (p.sy - cy) * phys.bodyLen;
  const x = sx + (p.headX - p.sx) * HEAD_SEAT, y = sy + drop + (p.headY - p.sy) * HEAD_SEAT;
  const fx = p.headTurn * W * .22, my = H * .36;
  const c = Math.cos(p.headRot), s = Math.sin(p.headRot);
  return { x, y, rot: p.headRot, W, H, scale: W / HEAD_W, mouth: { x: x + fx * c - my * s, y: y + fx * s + my * c } };
}

function earShape(W: number, H: number, side: number, look: CatLook, phys: Physique, flat: number, twitch: number, turn: number) {
  const size = phys.ear * (1 - flat * .3);
  // the reference style ears: short, wide-based triangles with a round tip on the corners of a broad head, about
  // a third of the half-width tall (they were .4 and narrower: "pointy and tall").
  const inner = { x: side * W * (.26 + .04 * look.earSpread) + turn * W * .1, y: -H * .97 };
  const outer = { x: side * W * .99 + turn * W * .06, y: -H * .36 };
  let tip = look.earFold ? { x: side * W * .9 + turn * W * .08, y: -H * 1.04 - W * .07 * size } : { x: side * W * .78 + turn * W * .1, y: -H - W * .23 * size };
  const cx = (inner.x + outer.x) / 2, cy = (inner.y + outer.y) / 2;
  const rot = side * (flat * .9 + twitch * .3);
  const r = (q: P) => ({ x: cx + (q.x - cx) * Math.cos(rot) - (q.y - cy) * Math.sin(rot), y: cy + (q.x - cx) * Math.sin(rot) + (q.y - cy) * Math.cos(rot) });
  tip = r(tip);
  // Turned heads hide a little of the far ear behind the skull.
  const k = 1 - Math.max(0, -side * turn) * .18;
  // the reference style never draws a needle tip: even the "runcing" gene keeps a soft round end.
  return { inner, outer: { x: outer.x * k + inner.x * (1 - k), y: outer.y }, tip, round: look.earFold ? .9 : .38 + look.earRound * .5 };
}

/** Adds a closed polygon with clockwise winding, so overlapping parts of one silhouette never cancel out. */
function addPolygon(path: Path2D, pts: P[]) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a.x * b.y - b.x * a.y; }
  const list = area < 0 ? [...pts].reverse() : pts;
  path.moveTo(list[0].x, list[0].y); for (let i = 1; i < list.length; i++) path.lineTo(list[i].x, list[i].y); path.closePath();
}

function earPoints(e: ReturnType<typeof earShape>): P[] {
  const { inner, outer, tip, round } = e;
  const t = .16 + round * .3, out: P[] = [inner];
  const a = { x: tip.x + (inner.x - tip.x) * t, y: tip.y + (inner.y - tip.y) * t }, b = { x: tip.x + (outer.x - tip.x) * t, y: tip.y + (outer.y - tip.y) * t };
  out.push(a);
  for (let k = 1; k < 6; k++) { const u = k / 6, m = 1 - u; out.push({ x: m * m * a.x + 2 * m * u * tip.x + u * u * b.x, y: m * m * a.y + 2 * m * u * tip.y + u * u * b.y }); }
  out.push(b, outer, { x: (inner.x + outer.x) / 2, y: (inner.y + outer.y) / 2 + 8 });
  return out;
}
function addEar(path: Path2D, e: ReturnType<typeof earShape>) { addPolygon(path, earPoints(e)); }

/**
 * The head as polygons in head space: the mochi, its cheek tufts and both ears, each its own piece so the mould can round the
 * ears into the crown. headPath is these same polygons, so the fill, the clip and the silhouette all agree to the pixel.
 */
export function headPolys(W: number, H: number, look: CatLook, phys: Physique, p: Pose): { id: string; poly: Poly }[] {
  const pen = new PolyPen();
  const bulge = 1 + phys.kitten * .03;
  // A mochi (the reference style): broad and flat on top, the cheeks fullest below the eyes, a wide flat chin.
  pen.moveTo(0, -H);
  pen.bezierCurveTo(W * .72, -H * 1.0, W * .98, -H * .74, W * 1.0 * bulge, -H * .06);
  pen.bezierCurveTo(W * 1.06 * bulge, H * .62, W * .84, H * .97, 0, H * .97);
  pen.bezierCurveTo(-W * .84, H * .97, -W * 1.06 * bulge, H * .62, -W * 1.0 * bulge, -H * .06);
  pen.bezierCurveTo(-W * .98, -H * .74, -W * .72, -H * 1.0, 0, -H);
  const out = [{ id: 'head', poly: pen.done()[0].slice(0, -1) }];
  // Cheek tufts on long-haired and chubby cats.
  const cheek = Math.min(1, look.cheek + Math.max(0, phys.fluff - .3) * .5);
  if (cheek > .15) for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
    const y = H * (.12 + k * .24), x = side * W * (1.0 - k * .06) * bulge;
    out.push({ id: `tuft${side}${k}`, poly: [{ x: x - side * 4, y: y - 5 }, { x: x + side * (3 + 4 * cheek), y: y + 1 }, { x: x - side * 4, y: y + 5 }] });
  }
  for (const side of [-1, 1]) out.push({ id: side < 0 ? 'earL' : 'earR', poly: earPoints(earShape(W, H, side, look, phys, p.ears, side === 1 ? p.earTwitch : 0, p.headTurn)) });
  return out;
}

export function headPath(W: number, H: number, look: CatLook, phys: Physique, p: Pose) {
  return pathOf(headPolys(W, H, look, phys, p).map(q => q.poly));
}

function lidLine(cx: number, cy: number, rx: number, ry: number, side: number, lid: number, tilt: number): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= 4; i++) {
    const u = -1 + i * .5, cover = clamp(lid + tilt * .5 * u, 0, .94);
    pts.push({ x: cx - side * u * (rx + 2), y: cy - ry - 1 + (2 * ry + 1) * cover });
  }
  return pts;
}
/** Limits the drawing that follows to the part of the eye below the lid line. */
function clipBelowLid(ctx: CanvasRenderingContext2D, line: P[], cy: number, ry: number) {
  ctx.beginPath(); ctx.moveTo(line[0].x, line[0].y);
  for (const q of line) ctx.lineTo(q.x, q.y);
  ctx.lineTo(line[line.length - 1].x, cy + ry + 4); ctx.lineTo(line[0].x, cy + ry + 4); ctx.closePath(); ctx.clip();
}
function strokeLid(ctx: CanvasRenderingContext2D, line: P[], k: number) {
  ctx.lineWidth = 1.9 * Math.max(.8, k); ctx.beginPath(); ctx.moveTo(line[0].x, line[0].y);
  for (const q of line) ctx.lineTo(q.x, q.y);
  ctx.stroke();
}
/**
 * What sits around an eye whatever its shape: tears on the lower lid and the brow. 'all' draws the tilted brow of the older poses too;
 * 'light' only the raised or dropped brow of the emotion layer (the other eye shapes have their own look); 'tears' only the tears.
 */
function eyeExtras(ctx: CanvasRenderingContext2D, p: Pose, side: number, ex: number, ey: number, e: number, k: number, mode: 'all' | 'light' | 'tears') {
  if (p.tear > .02) {
    const t = clamp(p.tear, 0, 1), r = (1 + 1.1 * t) * e, tx = ex + side * 1.2 * e, ty = ey + (4.6 + 2.2 * t) * e;
    ctx.save(); ctx.fillStyle = '#bfe3f2'; ctx.lineWidth = 1.2 * Math.max(.8, k);
    ctx.beginPath(); ctx.moveTo(tx, ty - r * 1.9); ctx.quadraticCurveTo(tx + r * 1.15, ty, tx, ty + r); ctx.quadraticCurveTo(tx - r * 1.15, ty, tx, ty - r * 1.9); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  if (mode === 'tears') return;
  const lift = p.browLift + (side === 1 ? p.browAsym : 0), tilted = mode === 'all' && Math.abs(p.brow) > .05;
  if (!tilted && Math.abs(lift) < .05) return;
  ctx.lineWidth = 1.8 * k;
  const y0 = ey - 7.5 * e - lift * 3.2 * e;
  ctx.beginPath(); ctx.moveTo(ex - side * 4.2 * e, y0); ctx.lineTo(ex + side * 3.4 * e, y0 + (mode === 'all' ? p.brow : 0) * 2.6 * e); ctx.stroke();
}

function drawEyes(ctx: CanvasRenderingContext2D, p: Pose, look: CatLook, phys: Physique, blink: number, fx: number, fy: number, k: number) {
  const open = Math.max(0, Math.min(1, p.eyes * blink));
  let style: EyeStyle = p.eyeStyle;
  if (open < .2 && (style === 'open' || style === 'wide' || style === 'sleepy')) style = 'closed';
  if (style === 'open' && look.eyeShape === 'sleepy') style = 'sleepy';
  const gap = 12.4 * look.eyeGap * k, ey = (1.5 + phys.eyeY * 8) * k + fy, e = phys.eye * k;
  // The emotion layer: an upper lid over the eye and the size of the pupil.
  const lidAmt = clamp(p.lid, 0, 1), lidSlope = clamp(p.lidTilt, -1, 1), lidOn = lidAmt > .02 || Math.abs(lidSlope) > .02, pupilK = Math.max(.25, p.pupil);
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    // A turned head foreshortens the far eye.
    const far = Math.max(0, -side * p.headTurn), ex = fx + side * gap * (1 - far * .25), squeeze = 1 - far * .25;
    ctx.lineWidth = 2.1 * Math.max(.8, k);
    if (style === 'happy') { ctx.beginPath(); ctx.arc(ex, ey + 2.4 * e, 3.6 * e * squeeze, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke(); eyeExtras(ctx, p, side, ex, ey, e, k, 'light'); continue; }
    if (style === 'closed') { ctx.beginPath(); ctx.arc(ex, ey - 1.4 * e, 3.8 * e * squeeze, Math.PI * .14, Math.PI * .86); ctx.stroke(); eyeExtras(ctx, p, side, ex, ey, e, k, 'light'); continue; }
    if (style === 'squint') { ctx.beginPath(); ctx.moveTo(ex - side * 3.4 * e, ey - 2.8 * e); ctx.lineTo(ex + side * 2.4 * e, ey); ctx.lineTo(ex - side * 3.4 * e, ey + 2.8 * e); ctx.stroke(); eyeExtras(ctx, p, side, ex, ey, e, k, 'tears'); continue; }
    if (style === 'blank') { ctx.beginPath(); ctx.moveTo(ex - 3.6 * e, ey); ctx.lineTo(ex + 3.6 * e, ey); ctx.stroke(); eyeExtras(ctx, p, side, ex, ey, e, k, 'tears'); continue; }
    // Grumpy face (from teen age): the upper lid always covers half the eye, sloping down a little
    // toward the nose, with a flat brow above. It stays in every mood, except that raised brows (surprise, delight) open it.
    const grump = grumpOf(look, phys) * clamp(1 - Math.max(0, p.browLift) * .9, 0, 1);
    if (grump > .05 && (style === 'open' || style === 'wide' || style === 'sleepy' || style === 'happy')) {
      const colored = !!look.eyeColor && look.eyeShape !== 'dot';
      const rx = (colored ? 5.1 : 3.4) * e * squeeze, ry = (colored ? 4.6 : 4) * e, cut = ry * (1 - 1.05 * grump) * (style === 'wide' ? 1.15 : 1);
      ctx.save(); ctx.translate(ex, ey + ry * .2);
      // Lid height across the eye: lower toward the inner corner (nose side).
      const lidAt = (x: number) => -cut + (-x * side / rx) * .2 * ry;
      ctx.beginPath(); ctx.moveTo(-rx - 2, lidAt(-rx - 2)); for (let u = -1; u <= 1.001; u += .25) ctx.lineTo(u * (rx + 2), lidAt(u * (rx + 2))); ctx.lineTo(rx + 2, ry + 2); ctx.lineTo(-rx - 2, ry + 2); ctx.closePath(); ctx.clip();
      if (colored) {
        ctx.fillStyle = look.eyeColor!; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.6 * Math.max(.8, k); ctx.stroke();
        const [pw, ph] = pupilSize(look, e, pupilK, ry * .78, false);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(p.lookX * 1.4 * e, p.lookY * .8 * e + ry * .15, pw, ph, 0, 0, Math.PI * 2); ctx.fill();
      } else { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(p.lookX * 1.2 * e, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      // The heavy lid line and a low, flat brow.
      ctx.lineWidth = 2.3 * Math.max(.8, k); ctx.beginPath(); ctx.moveTo(ex - rx - 1.2, ey + ry * .2 + lidAt(-rx - 1.2)); ctx.lineTo(ex + rx + 1.2, ey + ry * .2 + lidAt(rx + 1.2)); ctx.stroke();
      ctx.lineWidth = 1.7 * Math.max(.8, k); ctx.globalAlpha = .85 * grump;
      ctx.beginPath(); ctx.moveTo(ex - side * 3.6 * e, ey - 6.4 * e); ctx.lineTo(ex + side * 3.4 * e, ey - 5.6 * e); ctx.stroke(); ctx.globalAlpha = 1;
      eyeExtras(ctx, p, side, ex, ey, e, k, 'tears');
      continue;
    }
    const lid = style === 'sleepy' ? .45 : 1;
    const big = style === 'wide' ? 1.18 : 1;
    if (look.eyeColor && look.eyeShape !== 'dot' && look.eyeShape !== 'sleepy') {
      const rx = (look.eyeShape === 'almond' ? 5.2 : 4.7) * e * big * squeeze, ry = (look.eyeShape === 'almond' ? 3.8 : 4.7) * e * big * Math.min(open, lid);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(look.eyeShape === 'almond' ? side * -.18 : 0);
      const cover = lidOn ? lidLine(0, 0, rx, Math.max(.7, ry), side, lidAmt, lidSlope) : null;
      ctx.save(); if (cover) clipBelowLid(ctx, cover, 0, Math.max(.7, ry));
      ctx.fillStyle = look.eyeColor; ctx.beginPath(); ctx.ellipse(0, 0, rx, Math.max(.7, ry), 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1.6 * Math.max(.8, k); ctx.stroke();
      const [pw, ph] = pupilSize(look, e, pupilK, Math.max(.5, ry * .82), style === 'wide');
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(p.lookX * 1.4 * e, p.lookY * .8 * e, pw, ph, 0, 0, Math.PI * 2); ctx.fill();
      // The glint comes with wide pupils (a cuddly, excited moment), at any age; normal eyes have none.
      if (style === 'wide' || pupilK > 1.2) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(1.4 * e, -1.6 * e, (pupilK > 1.6 ? 1.5 : 1.2) * e, 0, Math.PI * 2); ctx.fill(); if (pupilK > 1.6) { ctx.beginPath(); ctx.arc(-1.2 * e, 1.3 * e, .55 * e, 0, Math.PI * 2); ctx.fill(); } }
      ctx.restore();
      if (cover) strokeLid(ctx, cover, k);
      // A queen's lashes: two little strokes off the outer top of each eye.
      // A kitten's face is plain ("polos"): no lashes yet.
      if (look.lashes && phys.kitten < .5 && !cover && ry > 2) { ctx.lineWidth = 1.5 * Math.max(.8, k); ctx.beginPath(); for (const a of [-.55, -.25]) { const x0 = Math.cos(a) * rx * side, y0 = Math.sin(a) * ry; ctx.moveTo(side > 0 ? x0 : -Math.abs(x0), y0); ctx.lineTo((side > 0 ? x0 : -Math.abs(x0)) + side * 2.2 * e, y0 - 1.6 * e); } ctx.stroke(); }
      if (lid < 1) { ctx.lineWidth = 1.9 * k; ctx.beginPath(); ctx.moveTo(-rx - .5, -ry + .6); ctx.lineTo(rx + .5, -ry + .6); ctx.stroke(); }
      ctx.restore();
    } else {
      // A plain dark eye grows a little with a big pupil and shrinks with a small one.
      const dk = 1 + (pupilK - 1) * .45;
      const rx = 3.15 * e * big * squeeze * dk, full = 3.95 * e * big * dk, ry = full * Math.min(open, lid);
      const cy = ey + (full - ry) * .55, ecx = ex + p.lookX * 1.2 * e, ecy = cy + p.lookY * .8 * e;
      const cover = lidOn ? lidLine(ecx, ecy, rx, Math.max(.6, ry), side, lidAmt, lidSlope) : null;
      ctx.save(); if (cover) clipBelowLid(ctx, cover, ecy, Math.max(.6, ry));
      ctx.beginPath(); ctx.ellipse(ecx, ecy, rx, Math.max(.6, ry), 0, 0, Math.PI * 2); ctx.fill();
      if (style === 'wide' || pupilK > 1.2) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 1 * e + p.lookX * 1.2 * e, cy - 1.4 * e, 1.1 * e, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = INK; }
      ctx.restore();
      if (cover) strokeLid(ctx, cover, k);
      if (lid < 1) { ctx.lineWidth = 1.8 * k; ctx.beginPath(); ctx.moveTo(ex - rx - 1, cy - ry + .2); ctx.lineTo(ex + rx + 1, cy - ry + .2); ctx.stroke(); }
    }
    // Older cats: heavy upper lid line and a soft brow tuft.
    if (phys.senior > .2) {
      ctx.globalAlpha = Math.min(1, phys.senior * 1.4); ctx.lineWidth = 1.6 * k;
      ctx.beginPath(); ctx.arc(ex, ey + 1.2 * e, 5 * e, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex - side * 1 * e, ey - 7.6 * e); ctx.lineTo(ex + side * 4.4 * e, ey - 6.2 * e); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    eyeExtras(ctx, p, side, ex, ey, e, k, 'all');
  }
}

/** 0..1 how "jutek" a grumpy cat's face is: none as a kitten, full from teen age (level 4) on. */
// The sour look comes with growing up.
function grumpOf(look: CatLook, phys: Physique) { return look.grumpy ? Math.max(0, Math.min(1, (1 - phys.kitten - phys.teen - .55) / .2)) : 0; }

/** The nose and the mouth (w, smile, open, yawn, flat, lick, chew, Cecil's sour one); also drawn on the the reference style pictures (fc-cat.ts). */
export function drawMouth(ctx: CanvasRenderingContext2D, p: Pose, look: CatLook, phys: Physique, fx: number, fy: number, k: number,
  /** the reference style faces: the nose and the mouth's top at their own places, the nose its own size (fc-cat.ts drawFcMouth). */
  at?: { ny: number; my: number; noseK: number }) {
  const ny = at ? at.ny : 6.8 * k + fy, my = at ? at.my : 9 * k + fy, o = p.mouthOpen, nk = at ? at.noseK : k;
  ctx.fillStyle = look.nose; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.moveTo(fx - 2.2 * nk, ny - 1.1 * nk); ctx.lineTo(fx + 2.2 * nk, ny - 1.1 * nk); ctx.quadraticCurveTo(fx, ny + 2.2 * nk, fx - 2.2 * nk, ny - 1.1 * nk); ctx.fill();
  ctx.lineWidth = 1.75 * Math.max(.8, k); ctx.lineCap = 'round';
  if ((p.mouth === 'yawn' || p.mouth === 'open' || p.mouth === 'meow') && o > .05) {
    // On an the reference style face the open mouth keeps about the nose's size.
    if (at) k = Math.min(k, at.noseK * 1.15);
    const yawn = p.mouth === 'yawn';
    const w = (yawn ? 4.6 + 2 * o : 3.3) * k, h = (yawn ? 2.4 + 7 * o : 1.4 + 3 * o) * k, cy = my + h * .55;
    ctx.fillStyle = '#82343a'; ctx.beginPath(); ctx.ellipse(fx, cy, w, h, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f19aa1'; ctx.beginPath(); ctx.ellipse(fx, cy + h * .45, w * .7, h * .42, 0, 0, Math.PI * 2); ctx.fill();
    if (yawn && o > .5) { ctx.fillStyle = '#fff'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(fx + s * w * .6, cy - h * .8); ctx.lineTo(fx + s * w * .45, cy - h * .45); ctx.lineTo(fx + s * w * .32, cy - h * .82); ctx.fill(); } }
  } else if (p.mouth === 'flat') {
    ctx.beginPath(); ctx.moveTo(fx - 3.4 * k, my + .8 * k); ctx.lineTo(fx + 3.4 * k, my + .8 * k); ctx.stroke();
  } else if (grumpOf(look, phys) > .5 && p.mouth !== 'lick' && p.mouth !== 'chew' && p.mouth !== 'smile') {
    //
    // Jutek: a short line down from the nose, then the corners of the mouth turned down.
    ctx.beginPath(); ctx.moveTo(fx, ny + 1 * k); ctx.lineTo(fx, my - .2 * k);
    ctx.moveTo(fx - 4 * k, my + 2.8 * k); ctx.quadraticCurveTo(fx - 1.8 * k, my - .9 * k, fx, my - .2 * k); ctx.quadraticCurveTo(fx + 1.8 * k, my - .9 * k, fx + 4 * k, my + 2.8 * k);
    ctx.stroke();
  } else {
    const chew = p.mouth === 'chew' ? o : 0, smile = p.mouth === 'smile' ? 1.25 : 1;
    const squash = 1 - Math.min(.6, (p.mouth === 'lick' ? o : chew) * .6);
    // `mouthCurve` bends the two arcs of the cat mouth: 1 is the usual w, 0 a flat line, below 0 turned down.
    const bend = p.mouthCurve, rise = Math.max(.01, 2.6 * k * squash * Math.abs(bend));
    for (const s of [-1, 1]) {
      ctx.beginPath();
      if (bend >= 0) ctx.ellipse(fx + s * 2.7 * k * smile, my, 2.8 * k * smile, rise, 0, 0, Math.PI);
      else ctx.ellipse(fx + s * 2.7 * k * smile, my + rise, 2.8 * k * smile, rise, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    if (p.mouth === 'lick' && o > .05) {
      ctx.fillStyle = '#f08f99'; ctx.beginPath(); ctx.ellipse(fx + .6 * k, my + (3.4 * o + 1.8) * k, 2.4 * k, (1.4 + 2.2 * o) * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.2 * k; ctx.stroke();
    }
  }
}

/** `whiskers` false: the head they go on already has its own (the the reference style pose pictures, game/art/fc-cat.ts). */
export function drawFaceFeatures(ctx: CanvasRenderingContext2D, p: Pose, look: CatLook, phys: Physique, blink: number, W: number, H: number, alpha = 1, whiskers = true) {
  const k = W / HEAD_W, fx = p.headTurn * W * .22 + p.lookX * 1.6 * k, fy = p.lookY * 1.4 * k + H * .02 - (p.headPitch ?? 0) * H * .34;
  ctx.save(); ctx.globalAlpha *= alpha;
  if (p.blush > .01 || look.blush) {
    ctx.save(); ctx.globalAlpha *= Math.min(1, (look.blush ? .55 : 0) + p.blush * .5);
    ctx.fillStyle = look.blush ?? '#f3a093';
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(fx + side * 19 * k * look.eyeGap, fy + 8.5 * k, 4.8 * k, 2.7 * k, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  // Age shows in the face: a kitten's face is plain; a grown cat gets the
  // dotted whisker pads; an old one brow whiskers, soft lines under the eyes, tufts on the cheeks and a third whisker.
  const grown = clamp(1 - phys.kitten - phys.teen * .7, 0, 1), old = phys.senior;
  const gap = 12.4 * look.eyeGap * k, ey = (1.5 + phys.eyeY * 8) * k + fy, e = phys.eye * k;
  if (old > .2) {
    ctx.save(); ctx.globalAlpha *= old * .55; ctx.strokeStyle = INK; ctx.lineWidth = 1.1 * Math.max(.8, k); ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const cx = fx + side * gap;
      ctx.beginPath(); ctx.arc(cx, ey + e * 3.4, e * 2.2, Math.PI * .2, Math.PI * .8); ctx.stroke(); // a soft line under the eye
    }
    ctx.restore();
  }
  drawEyes(ctx, p, look, phys, blink, fx, fy, k);
  drawMouth(ctx, p, look, phys, fx, fy, k);
  if (grown > .3 && !p.headBack) {
    ctx.save(); ctx.globalAlpha *= grown * .5; ctx.fillStyle = INK;
    for (const side of [-1, 1]) for (const [dx, dy] of [[6.5, 7.6], [9.2, 9.4], [6.8, 10.8]] as const) { ctx.beginPath(); ctx.arc(fx + side * dx * k * phys.muzzle, fy + dy * k, .62 * k, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  // Whiskers cross the outline, two per cheek (three when old); older cats' whiskers droop.
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5 * Math.max(.8, k);
  const droop = phys.senior * 3;
  if (whiskers) for (const side of [-1, 1]) {
    const x0 = side * (W - 5 * k), x1 = side * (W + 7 * k), sh = p.headTurn * side * 2 * k;
    ctx.beginPath(); ctx.moveTo(x0 + sh, 3.5 * k + fy * .5); ctx.lineTo(x1 + sh, (1.5 + droop) * k + fy * .5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 + sh, 8.4 * k + fy * .5); ctx.lineTo(x1 + sh, (10 + droop) * k + fy * .5); ctx.stroke();
    if (old > .4) { ctx.beginPath(); ctx.moveTo(x0 + sh, 6 * k + fy * .5); ctx.lineTo(x1 + 2 * k * side + sh, (6 + droop * 1.4) * k + fy * .5); ctx.stroke(); }
  }
  if (old > .3) {
    ctx.save(); ctx.globalAlpha *= old * .8; ctx.lineWidth = 1.2 * Math.max(.8, k); ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      // Brow whiskers: two long hairs arching up from above each eye.
      const bx = fx + side * gap;
      for (const [o, h] of [[-.3, 1], [.35, .85]] as const) { ctx.beginPath(); ctx.moveTo(bx + side * o * e * 3, ey - e * 3.4); ctx.quadraticCurveTo(bx + side * (o * e * 3 + e * 2), ey - e * (6 + h * 3), bx + side * (o * e * 3 + e * 4.5), ey - e * (5 + h * 4)); ctx.stroke(); }
      // Cheek tufts: the fur stands out a little at the jaw.
      for (const t of [0, 1]) { const y = H * (.18 + t * .14); ctx.beginPath(); ctx.moveTo(side * (W - 1.5 * k), y); ctx.lineTo(side * (W + 2.6 * k), y + 1.6 * k); ctx.lineTo(side * (W - .5 * k), y + 3.4 * k); ctx.stroke(); }
    }
    ctx.restore();
  }
  ctx.restore();
}

export function paintHeadFill(ctx: CanvasRenderingContext2D, p: Pose, look: CatLook, phys: Physique, W: number, H: number, path: Path2D, back: boolean) {
  ctx.fillStyle = look.base; ctx.fill(path);
  ctx.save(); ctx.clip(path);
  const k = W / HEAD_W, shift = p.headTurn * W * .19, mirror = back ? -1 : 1;
  for (const [side, color] of [[-1, look.earLeft], [1, look.earRight]] as const) {
    if (!color) continue;
    const e = earShape(W, H, side * mirror, look, phys, p.ears, side * mirror === 1 ? p.earTwitch : 0, p.headTurn);
    ctx.fillStyle = color; const ear = new Path2D(); addEar(ear, e); ctx.fill(ear);
  }
  for (const patch of look.headPatches) {
    ctx.fillStyle = patch.color; ctx.beginPath();
    ctx.ellipse(patch.x * W * mirror + (back ? 0 : shift * (1 - Math.abs(patch.x))), patch.y * H, patch.rx * W, patch.ry * H, (patch.rot ?? 0) * mirror, 0, Math.PI * 2); ctx.fill();
  }
  if (look.stripes) {
    ctx.strokeStyle = look.stripes; ctx.lineCap = 'round'; ctx.lineWidth = 3 * k;
    for (const x of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo((x * 1.12) * k + shift * .6, -H + 1); ctx.lineTo(x * k + shift * .6, -H + (10 - Math.abs(x) * .3) * k); ctx.stroke(); }
    if (!back) for (const side of [-1, 1]) for (const y of [-.05, .25]) { ctx.beginPath(); ctx.moveTo(side * W, y * H); ctx.lineTo(side * (W - 8 * k), y * H + 1.5 * k); ctx.stroke(); }
  }
  if (look.muzzle && !back) {
    const fx = p.headTurn * W * .22;
    ctx.fillStyle = look.muzzle; ctx.beginPath(); ctx.ellipse(fx, H * .42, 12.5 * k * phys.muzzle, 9 * k * phys.muzzle, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (look.faceMarks && !back) for (const m of look.faceMarks) {
    ctx.fillStyle = m.color; ctx.beginPath();
    ctx.ellipse(m.x * W + shift * (1 - Math.abs(m.x)), m.y * H, m.rx * W, m.ry * H, m.rot ?? 0, 0, Math.PI * 2); ctx.fill();
  }
  if (phys.senior > .1 && !back) {
    // Greying muzzle (clearer with the years).
    ctx.globalAlpha = phys.senior * .6; ctx.fillStyle = mix(look.muzzle ?? look.base, '#ffffff', .6);
    ctx.beginPath(); ctx.ellipse(p.headTurn * W * .22, H * .45, 13 * k, 8 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export interface HeadDrawOptions { blink?: number; outline?: boolean; facePatch?: (ctx: CanvasRenderingContext2D) => void }

/** Draws the head at the current transform origin, already rotated and scaled by the caller. */
/** `ink` false: the head is part of a moulded silhouette that is already inked; only its fill and face are drawn here. */
export function drawHeadAt(ctx: CanvasRenderingContext2D, p: Pose, look: CatLook, phys: Physique, W: number, H: number, blink = 1, ink = true) {
  const back = p.headBack > .5;
  const path = headPath(W, H, look, phys, p);
  ctx.lineJoin = 'round';
  if (ink) { ctx.strokeStyle = INK; ctx.lineWidth = OUTLINE * 2; ctx.stroke(path); }
  paintHeadFill(ctx, p, look, phys, W, H, path, back);
  if (back) {
    // Back of the head: a hint of the far cheeks and whisker tips only.
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.globalAlpha = .9;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * (W + 1), H * .2); ctx.lineTo(side * (W + 6), H * .14); ctx.stroke(); }
    ctx.globalAlpha = 1;
  } else drawFaceFeatures(ctx, p, look, phys, blink, W, H, Math.max(0, 1 - p.headBack * 2));
}


// ———————————————————————————————————————— legs and tail

interface Leg { ax: number; ay: number; px: number; py: number }
/** How far a raised paw can reach from the shoulder, so arms never stretch into sticks. */
const REACH = 18;
/** Where a grooming paw goes: just beside and below the mouth, so the face stays visible. */
export function mouthTarget(p: Pose, head: HeadGeom) { return { x: head.mouth.x + 8 * head.scale + p.pawDX * head.scale, y: head.mouth.y + 11 * head.scale + p.pawDY * head.scale }; }
function legs(p: Pose, s: Spine, phys: Physique, head: HeadGeom) {
  const up = p.bellyUp > .5 ? -1 : 1;
  const front = bodyPoint(s, .86, .5 * up), back = bodyPoint(s, .14, .45 * up);
  // Paw targets follow the body length, so short kittens do not cross their legs.
  const midX = (p.hx + p.sx) / 2, k = phys.bodyLen;
  const along = (x: number) => midX + (x - midX) * k;
  const make = (ax: number, ay: number, px: number, py: number, tuck: number): Leg => {
    const ty = py + (ay - py) * tuck * .86, tx = px + (ax - px) * tuck * .55;
    return { ax, ay, px: tx, py: ty };
  };
  const raised = p.pawOver > .5 || p.pawMouth > .01;
  // A raised paw grows from the upper chest so the foreleg stays short and round, never a long stick.
  const chest = bodyPoint(s, 1.0, .15 * up);
  const fn = raised ? { ax: chest.x - 2, ay: chest.y + 4, px: p.fnX, py: p.fnY } : make(front.x - 1, front.y, along(p.fnX), p.fnY, p.tuck);
  if (p.pawMouth > .01) {
    const target = mouthTarget(p, head);
    fn.px += (target.x - fn.px) * p.pawMouth; fn.py += (target.y - fn.py) * p.pawMouth;
  }
  if (raised) {
    const dx = fn.px - fn.ax, dy = fn.py - fn.ay, d = Math.hypot(dx, dy), reach = (p.pawMouth > .5 ? REACH : REACH * 1.5) * phys.leg;
    if (d > reach) { fn.px = fn.ax + dx / d * reach; fn.py = fn.ay + dy / d * reach; }
  }
  const ff = make(front.x + 3, front.y - 2, p.pawOver > .5 && p.ffY < -20 ? p.ffX : along(p.ffX), p.ffY, p.tuck);
  if (p.pawOver > .5 && p.ffY < -20) { const dx = ff.px - ff.ax, dy = ff.py - ff.ay, d = Math.hypot(dx, dy), reach = REACH * phys.leg; if (d > reach) { ff.px = ff.ax + dx / d * reach; ff.py = ff.ay + dy / d * reach; } }
  // Both front paws raised to the same height (a barbell, a desktop): the far paw's shorter reach
  // would leave it lower, so both settle at the height both can reach.
  if (raised && p.pawMouth <= .01 && p.pawOver > .5 && p.ffY < -20 && Math.abs(p.fnY - p.ffY) < 1) { const y = Math.max(fn.py, ff.py); fn.py = y; ff.py = y; }
  return { fn, ff, bn: make(back.x + 1, back.y, along(p.bnX), p.bnY, p.tuckBack), bf: make(back.x + 4, back.y - 2, along(p.bfX), p.bfY, p.tuckBack) };
}

function tailPoints(p: Pose, s: Spine, time: number, len: number) {
  // Lying down with the tail in front: it wraps round the rump and lies along the floor in
  // front of the belly, hugging the body (the reference style loaf and curl), instead of hooking off the back.
  if (p.tailFront >= .5 && p.tuck >= .5 && len > 26) return wrappedTail(p, s, time, len);
  const base = bodyPoint(s, -.02, -.5);
  const pts: P[] = [{ x: base.x - s.tan[0].x * s.rh * .5, y: base.y - s.tan[0].y * s.rh * .5 }];
  const n = 10, seg = len / n;
  let a = p.tailA;
  for (let i = 1; i <= n; i++) {
    const w = i / n;
    // at rest the tail is still, then swishes once in the reference style's 16 drawings of 0.2 s, the bend running down it (the tip shows the
    // root's drawing of three frames earlier), then rests 4–8 s. A wagging tail (tailWag > .6: an excited clip) keeps its swing.
    a += p.tailBend + (i > n - 4 ? p.tailTip / 4 : 0) + p.tailSway * .12 * w + (p.tailWag > .6 ? Math.sin(time * 4.4 - i * .5) * .02 * i : tailFlick(time, 2, w) * .05 * i) * p.tailWag;
    const prev = pts[i - 1];
    pts.push({ x: prev.x + Math.cos(a) * seg, y: prev.y + Math.sin(a) * seg });
  }
  return pts;
}

function wrappedTail(p: Pose, s: Spine, time: number, _len: number) {
  const pts: P[] = [];
  // A smooth sweep round the rump, then along the floor in front of the belly to the front paws.
  const dir = Math.sign(s.shoulder.x - s.hip.x) || 1, c = bodyPoint(s, .04, 0), r = s.rh * 1.02;
  const floor = Math.min(-4.5, c.y + r * .92);
  // It shows from the back of the rump down (the base is hidden behind the body).
  for (let i = 0; i <= 7; i++) {
    const a = Math.PI * (1.04 - .54 * i / 7);
    pts.push({ x: c.x + Math.cos(a) * r * .93 * dir, y: Math.min(floor, c.y + Math.sin(a) * r * .98) });
  }
  const front = bodyPoint(s, .78, 1).x, from = pts[pts.length - 1].x;
  for (let i = 1; i <= 7; i++) {
    const u = i / 7, tip = Math.max(0, (u - .72) / .28);
    pts.push({ x: from + (front - from) * u, y: floor - tip * tip * (5 + tailFlick(time, 4, u) * p.tailWag * 6) });
  }
  return pts;
}

/**
 * Roki's back: two soft dark spots and a curved patch below them, like a smiling face. Drawn in
 * layers of decreasing width and opacity so the edges look like fur, not ink.
 */
function drawBackSmile(ctx: CanvasRenderingContext2D, s: Spine, color: string, up: number) {
  // Roki's saddle: a faint darker patch over the haunch with two eye spots and a smile in it.
  // Fur, not a drawing: blobby edges, tapered ends, the same flat fills as the other patches.
  const r = s.rh, ang = Math.atan2(s.tan[4].y, s.tan[4].x);
  const blob = (u: number, v: number, rx: number, ry: number, rot = 0) => { const c = bodyPoint(s, u, v * up); ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, ang + rot, 0, Math.PI * 2); ctx.fill(); };
  ctx.save(); ctx.fillStyle = color;
  ctx.globalAlpha = .22; blob(.27, -.42, r * .95, r * .62); blob(.16, -.2, r * .55, r * .5, .4);
  ctx.globalAlpha = .9;
  // Eyes: each two overlapping blobs, slightly different.
  blob(.15, -.66, r * .17, r * .14, .5); blob(.17, -.58, r * .12, r * .12);
  blob(.37, -.7, r * .16, r * .15, -.3); blob(.39, -.62, r * .11, r * .1);
  // Smile: a crescent, thick in the middle and thin at the ends.
  const pts: P[] = [], back: P[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, u = .08 + t * .38, w = Math.sin(t * Math.PI) ** .8 * .17;
    const v = -.3 + Math.sin(t * Math.PI) * .26;
    pts.push(bodyPoint(s, u, (v - w * .4) * up)); back.push(bodyPoint(s, u, (v + w * .6) * up));
  }
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (const q of pts) ctx.lineTo(q.x, q.y); for (const q of back.reverse()) ctx.lineTo(q.x, q.y); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** Where the collar sits: a band round the neck, the tag at the throat. */
function collarGeom(h: HeadGeom, s: Spine, up: number) {
  // Under the jaw: from behind the cheek round to the throat, turning with the head.
  const c = Math.cos(h.rot), sn = Math.sin(h.rot), at = (x: number, y: number) => ({ x: h.x + x * c - y * sn, y: h.y + x * sn + y * c });
  const back = at(-h.W * .55, h.H * .72), front = at(h.W * .18, h.H * 1.02), mid = at(-h.W * .15, h.H * 1.08);
  void s; void up;
  return { back, front, mid, tag: { x: front.x, y: front.y + 2 } };
}
function drawCollarBand(ctx: CanvasRenderingContext2D, look: CatLook, c: ReturnType<typeof collarGeom>, rs: number) {
  const w = Math.max(3.2, rs * .28);
  ctx.save(); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(c.back.x, c.back.y); ctx.quadraticCurveTo(c.mid.x + 3, c.mid.y, c.front.x, c.front.y);
  ctx.strokeStyle = INK; ctx.lineWidth = w + 3.2; ctx.stroke();
  ctx.strokeStyle = look.collar!; ctx.lineWidth = w; ctx.stroke();
  if (look.collarDots) { ctx.fillStyle = look.collarDots; for (let i = 1; i < 5; i++) { const u = i / 5, x = (1 - u) ** 2 * c.back.x + 2 * u * (1 - u) * (c.mid.x + 3) + u * u * c.front.x, y = (1 - u) ** 2 * c.back.y + 2 * u * (1 - u) * c.mid.y + u * u * c.front.y; ctx.beginPath(); ctx.arc(x, y, w * .2, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
}
function drawCollarTag(ctx: CanvasRenderingContext2D, at: P, rs: number) {
  const r = Math.max(2.6, rs * .22);
  ctx.save(); ctx.fillStyle = '#e8b84a'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(at.x, at.y + r * .6, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff3c8'; ctx.beginPath(); ctx.arc(at.x - r * .3, at.y + r * .3, r * .3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function tailWidth(look: CatLook, phys: Physique) { return 9.6 * (1 + look.tailFluff * .45 + Math.max(0, phys.body - 1) * .25) * (1 - phys.kitten * .25); }
/**
 * A thick, bushy tail: it swells to a plume past its
 * root, its edges go in soft clumps of fur, and it ends in a soft point. Long tails with tailFluff ≥ 1 only (Roki, Coki, Piw Piw, Mochi);
 * a bobbed tail keeps its round puff.
 */
export const bushyTail = (look: CatLook) => look.tailFluff >= 1 && look.tailLen >= .5;
export function bushyTailPoly(pts: P[], width: number, look: CatLook): Poly {
  const n = pts.length - 1, left: P[] = [], right: P[] = [], swell = .32 + (look.tailFluff - 1) * .25;
  for (let i = 0; i <= n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)], len = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    const u = i / n, clump = i > 1 && i < n ? (i % 2 ? .13 : -.03) : 0;
    // Narrower where it leaves the body, fullest two thirds along, drawn in to a soft point at the tip.
    const hw = width / 2 * (.82 + swell * Math.sin(Math.min(1, u * 1.25) * Math.PI * .8)) * (u > .86 ? 1 - (u - .86) / .14 * .55 : 1);
    left.push({ x: pts[i].x + nx * hw * (1 + clump), y: pts[i].y + ny * hw * (1 + clump) });
    right.push({ x: pts[i].x - nx * hw * (1 + clump * .8), y: pts[i].y - ny * hw * (1 + clump * .8) });
  }
  const e = pts[n], d = pts[n - 1], dl = Math.hypot(e.x - d.x, e.y - d.y) || 1, tip = { x: e.x + (e.x - d.x) / dl * width * .42, y: e.y + (e.y - d.y) / dl * width * .42 };
  return [...left, tip, ...right.reverse()];
}
/** `ink` only draws the outline (behind a body it merges with), `fill` only the coat over it. */
export function strokeTail(ctx: CanvasRenderingContext2D, pts: P[], look: CatLook, phys: Physique, widthOverride?: number, mode: 'both' | 'ink' | 'fill' = 'both') {
  const width = widthOverride ?? tailWidth(look, phys);
  if (bushyTail(look)) {
    const plume = pathOf([bushyTailPoly(pts, width, look)]);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (mode !== 'fill') { ctx.strokeStyle = INK; ctx.lineWidth = OUTLINE * 2; ctx.stroke(plume); }
    if (mode === 'ink') return;
    ctx.fillStyle = look.tail; ctx.fill(plume);
    ctx.save(); ctx.clip(plume);
    if (look.tailRings) {
      ctx.strokeStyle = look.tailRings; ctx.lineCap = 'butt'; ctx.lineWidth = width * 1.6;
      for (let i = 3; i < pts.length - 1; i += 2) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x * .5 + pts[i].x * .5, pts[i + 1].y * .5 + pts[i].y * .5); ctx.stroke(); }
    }
    if (look.tailTip) { ctx.strokeStyle = look.tailTip; ctx.lineWidth = width * 1.8; ctx.beginPath(); const k = pts.length - 4; ctx.moveTo(pts[k].x, pts[k].y); for (let i = k + 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.lineTo(pts[pts.length - 1].x + (pts[pts.length - 1].x - pts[k].x), pts[pts.length - 1].y + (pts[pts.length - 1].y - pts[k].y)); ctx.stroke(); }
    // A few soft strands of fur inside the plume, along its length.
    ctx.strokeStyle = shade(look.tail, .78); ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    for (let i = 4; i < pts.length - 2; i += 3) {
      const a = pts[i], b = pts[i + 2], nx = -(b.y - a.y), ny = b.x - a.x, l = Math.hypot(nx, ny) || 1;
      for (const sd of [-1, 1]) { const o = width * .22 * sd / l; ctx.beginPath(); ctx.moveTo(a.x + nx * o, a.y + ny * o); ctx.lineTo(b.x + nx * o * 1.3, b.y + ny * o * 1.3); ctx.stroke(); }
    }
    ctx.restore();
    return;
  }
  const trace = (from: number, to: number) => { ctx.beginPath(); ctx.moveTo(pts[from].x, pts[from].y); for (let i = from + 1; i <= to; i++) ctx.lineTo(pts[i].x, pts[i].y); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  trace(0, pts.length - 1);
  if (mode !== 'fill') { ctx.strokeStyle = INK; ctx.lineWidth = width + OUTLINE * 2; ctx.stroke(); }
  if (mode === 'ink') { if (look.tailLen < .5) { ctx.lineWidth = OUTLINE * 2; ctx.stroke(pathOf([tailPuff(pts, width, look)])); } return; }
  ctx.strokeStyle = look.tail; ctx.lineWidth = width; ctx.stroke();
  if (look.tailRings) {
    ctx.strokeStyle = look.tailRings; ctx.lineCap = 'butt'; ctx.lineWidth = width;
    for (let i = 3; i < pts.length - 1; i += 2) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x * .5 + pts[i].x * .5, pts[i + 1].y * .5 + pts[i].y * .5); ctx.stroke(); }
    ctx.lineCap = 'round';
  }
  if (look.tailTip) { trace(pts.length - 3, pts.length - 1); ctx.strokeStyle = look.tailTip; ctx.lineWidth = width; ctx.stroke(); }
  if (look.tailFluff > .3) {
    // Fluffy tails get a few soft tufts along the edge.
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
    for (let i = 2; i < pts.length - 1; i += 2) {
      const a = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x) - Math.PI / 2, r = width / 2 + OUTLINE;
      ctx.beginPath(); ctx.moveTo(pts[i].x + Math.cos(a) * r, pts[i].y + Math.sin(a) * r); ctx.lineTo(pts[i].x + Math.cos(a) * (r + 3) - Math.cos(a + Math.PI / 2) * 2, pts[i].y + Math.sin(a) * (r + 3) - Math.sin(a + Math.PI / 2) * 2); ctx.stroke();
    }
  }
  // A bobbed tail ends in a round puff, like a rabbit's.
  if (look.tailLen < .5) {
    const puff = pathOf([tailPuff(pts, width, look)]);
    // Moulded, the puff's outline is the silhouette's; a line where it meets the tail would be a seam.
    if (mode !== 'fill') { ctx.strokeStyle = INK; ctx.lineWidth = OUTLINE * 1.6; ctx.stroke(puff); }
    ctx.fillStyle = look.tailTip ?? look.tail; ctx.fill(puff);
  }
}
/** The round puff of a bobbed tail, as a polygon (part of the silhouette). */
export function tailPuff(pts: P[], width: number, look: CatLook): Poly {
  const e = pts[pts.length - 1], r = width * (.7 + look.tailFluff * .12), out: Poly = [];
  for (let i = 0; i < 18; i++) { const a = i * Math.PI / 9, rr = r * (1 + (i % 2 ? .14 : 0)); out.push({ x: e.x + Math.cos(a) * rr, y: e.y + Math.sin(a) * rr }); }
  return out;
}

const LEG_R = 6.8, PAW_R = 7.4;

// ———————————————————————————————————————— public

export interface CatShapes { head: P & { r: number }; body: P & { rx: number; ry: number }; tail: P; paw: P; pawFar: P; mouth: P; neck: P }

/** Local-space (pre-facing) contact shapes for hit-testing, feeding, toys and holding. */
export function catShapes(p: Pose, phys: Physique): CatShapes {
  if (p.front >= .5) {
    // Mirrored like the drawing: the model's +x side (tail) is away from the gaze.
    // Standing: the body is the standing one, raised by its legs, as drawFrontCat draws it.
    const up = clamp(p.upright ?? 0, 0, 1), g = frontGeom(phys, 0, up), legH = g.W * STAND_LEG * up, m = -1;
    // The picture is raised by the legs, squashed, then turned about the feet, then lifted (drawFrontCat), and only then mirrored
    // (drawCat): the points follow it in that order, so what hangs from a paw (the strings of a parachute) stays on the paw while
    // the cat swings. Mirroring before the turn turned it the wrong way.
    const cs = Math.cos(p.rot), sn = Math.sin(p.rot);
    const at = (x: number, y: number): P => { const sx = x * p.squashX, sy = (y - legH) * p.squashY; return { x: m * (sx * cs - sy * sn), y: sx * sn + sy * cs - p.lift }; };
    const [near, far]: [P, P] = p.armsUp > 1 ? overheadGrips(g) : [{ x: g.lx1, y: -4 }, { x: g.lx1, y: -4 }];
    return {
      head: { ...at(0, g.headY), r: Math.max(g.W, g.H) * 1.02 },
      body: { ...at(g.off, g.top / 2), rx: g.botHalf, ry: g.bodyH / 2 },
      tail: at(g.R + g.W * .3, g.top),
      paw: at(near.x, near.y), pawFar: at(far.x, far.y), mouth: at(g.mouth.x, g.mouth.y),
      neck: at(0, g.top + 4),
    };
  }
  const s = spine(p, phys), head = headGeom(p, phys), tail = tailPoints(p, s, 0, p.tailLen * (.9 + .1 * phys.bodyLen)), leg = legs(p, s, phys, head);
  const cx = (s.hip.x + s.shoulder.x) / 2, cy = (s.hip.y + s.shoulder.y) / 2;
  return {
    head: { x: head.x, y: head.y, r: Math.max(head.W, head.H) * 1.02 },
    body: { x: cx, y: cy, rx: Math.abs(s.shoulder.x - s.hip.x) / 2 + (s.rh + s.rs) / 2, ry: Math.abs(s.shoulder.y - s.hip.y) / 2 + (s.rh + s.rs) / 2 },
    tail: tail[tail.length - 2], paw: { x: leg.fn.px, y: leg.fn.py }, pawFar: { x: leg.ff.px, y: leg.ff.py }, mouth: head.mouth,
    neck: bodyPoint(s, 1, -.7),
  };
}

export function drawCat(ctx: CanvasRenderingContext2D, p: Pose, look: CatLook, phys: Physique, options: DrawOptions) {
  // Sitting is drawn like the reference style: the three-quarter front model, tail on the side away from the gaze.
  if (p.front >= .5) {
    // Like the reference style switching sprites: the three-quarter front model, tail on the side away from the gaze.
    ctx.save(); ctx.scale(-options.facing, 1);
    if (options.clipBelow !== undefined) { ctx.beginPath(); ctx.rect(-260, -400, 520, 400 + options.clipBelow / (options.scale * phys.scale)); ctx.clip(); }
    drawFrontCat(ctx, look, phys, { scale: options.scale, time: options.time, blink: options.blink, pose: { ...p, headTurn: -p.headTurn }, props: options.props });
    ctx.restore();
    return;
  }
  const blink = options.blink ?? 1, time = options.time ?? 0;
  ctx.save();
  ctx.scale(options.scale * phys.scale * options.facing, options.scale * phys.scale);
  if (options.clipBelow !== undefined) { ctx.beginPath(); ctx.rect(-260, -400, 520, 400 + options.clipBelow); ctx.clip(); }
  ctx.translate(0, -p.lift);
  ctx.rotate(p.rot);
  ctx.scale(p.squashX, p.squashY);
  const s = spine(p, phys);
  let head = headGeom(p, phys);
  const leg = legs(p, s, phys, head);
  if (p.pawMouth > .01) {
    // The paw cannot reach the mouth: the head bows down to meet it instead.
    const t = mouthTarget(p, head), k = Math.min(1, p.pawMouth) * .7;
    p = { ...p, headX: p.headX + (leg.fn.px - t.x) * k, headY: p.headY + (leg.fn.py - t.y) * k };
    head = headGeom(p, phys);
  }
  const tail = tailPoints(p, s, time, p.tailLen * look.tailLen * (.9 + .1 * phys.bodyLen) * (1 - phys.kitten * .15));
  const legScale = (1 + Math.max(0, phys.body - 1) * .35) * (1 - phys.thin * .3);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const wet = options.wet ?? 0;
  const coat = wet > 0 ? { ...look, base: mix(look.base, shade(look.base, .78), wet), tail: mix(look.tail, shade(look.tail, .78), wet) } : look;
  // A wrapped tail lies round the rump and along the floor in front of the belly (the reference style loaf and curl).
  const wrapped = p.tailFront >= .5 && p.tuck >= .5 && look.tailLen >= .55;
  const over = p.pawOver > .5 || p.pawMouth > .5;
  const up = p.bellyUp > .5 ? -1 : 1;
  const sm = sideMold(p, look, phys, s, head, leg, tail, legScale, over, wrapped);
  const mold = sm.mold, ink = innerInk(coat.base);
  const socks = (l: Leg) => { ctx.fillStyle = coat.socks!; ctx.beginPath(); ctx.ellipse(l.px, l.py - 1, PAW_R * 1.25 * legScale, PAW_R * 1.15 * legScale, 0, 0, Math.PI * 2); ctx.fill(); };

  // head, body, legs and tail are ONE silhouette with rounded joins (cat-mold.ts), inked once; everything below only paints inside it.
  inkSilhouette(ctx, mold, coat.base, OUTLINE * 2, () => strokeTail(ctx, tail, coat, phys, undefined, 'ink'));
  // The far legs, behind the body: a shade darker so they read as further away.
  if (mold.has('far')) {
    const far = mold.path(['far']);
    ctx.fillStyle = shade(coat.base, .9); ctx.fill(far);
    if (coat.socks) { ctx.save(); ctx.clip(far); ctx.fillStyle = shade(coat.socks, .93); for (const l of sm.farLegs) { ctx.beginPath(); ctx.ellipse(l.px, l.py, PAW_R * 1.3, PAW_R * 1.2, 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
  }
  // The tail behind the body: only its fur (its outline is the silhouette's, so no line crosses its root).
  if (sm.tailGroup === 'tail') strokeTail(ctx, tail, coat, phys, undefined, 'fill');

  // Body, haunch and near legs: one region (with the fillets that join them), painted over the far legs and the tail's root. Where the
  // region lies over a far leg or the tail, a thin line goes down first and the fill covers its inner half (and every edge between the
  // body's own pieces), so only its outer half shows, thinner than the outline.
  const group = mold.path(['body']);
  const body = pathOf([mold.part('body')!.poly]);
  const bodyEdge = mold.path(['body'], false);
  if (mold.has('far')) underline(ctx, bodyEdge, mold.path(['far'], false), ink);
  // Only when the tail beyond its root really passes behind the body (it hangs down behind the legs): most of the time it rises clear.
  const bodyPoly = mold.part('body')!.poly;
  if (sm.tailGroup === 'tail' && tail.length > 6 && tail.slice(4).some(q => insidePoly(bodyPoly, q))) underline(ctx, bodyEdge, pathOf([strokePoly(tail.slice(4), tailWidth(coat, phys))]), ink);
  ctx.fillStyle = coat.base; ctx.fill(group);
  ctx.save(); ctx.clip(group);
  // Belly and chest markings stay on the torso (clipped to it), never spilling down the legs.
  ctx.save(); ctx.clip(body);
  if (coat.belly) {
    // One smooth band along the underside, from the haunch to the chest.
    ctx.fillStyle = coat.belly; ctx.beginPath();
    for (let i = 0; i <= 12; i++) { const q = bodyPoint(s, -.05 + i / 12 * 1.1, 1.3 * up); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); }
    for (let i = 12; i >= 0; i--) { const u = i / 12, q = bodyPoint(s, -.05 + u * 1.1, (1.02 - Math.sin(u * Math.PI) ** .6 * .66) * up); ctx.lineTo(q.x, q.y); }
    ctx.closePath(); ctx.fill();
  }
  if (coat.chest) { const c = bodyPoint(s, 1.0, .3 * up); ctx.fillStyle = coat.chest; ctx.beginPath(); ctx.ellipse(c.x + 2, c.y, s.rs * .7, s.rs * .9, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  for (const patch of coat.bodyPatches) {
    const c = bodyPoint(s, patch.u, patch.v * up);
    ctx.fillStyle = patch.color; ctx.beginPath(); ctx.ellipse(c.x, c.y, patch.ru * (s.len + s.rh), patch.rv * c.r * 1.1, Math.atan2(s.tan[6].y, s.tan[6].x), 0, Math.PI * 2); ctx.fill();
  }
  if (coat.backSmile) drawBackSmile(ctx, s, coat.backSmile, up);
  if (coat.stripes && !coat.stripesHeadOnly) {
    ctx.strokeStyle = coat.stripes; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    for (const u of [.1, .32, .54, .76]) { const a = bodyPoint(s, u, -1.15 * up), b = bodyPoint(s, u - .05, -.3 * up); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2 - 2, (a.y + b.y) / 2, b.x, b.y); ctx.stroke(); }
  }
  if (coat.socks && p.tuck < .95) { if (!over) socks(leg.fn); if (p.tuckBack < .95) socks(leg.bn); }
  if (options.dirt) drawDirt(ctx, s, options.dirt, time);
  if (phys.thin > .35) {
    // Ribs showing on a very thin cat.
    ctx.strokeStyle = shade(coat.base, .72); ctx.lineWidth = 1.8; ctx.globalAlpha = Math.min(1, (phys.thin - .35) * 2.2);
    for (const u of [.42, .52, .62, .72]) { const a = bodyPoint(s, u, -.1 * up), b = bodyPoint(s, u - .03, .7 * up); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2 + 3, (a.y + b.y) / 2, b.x, b.y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (p.thigh > .35) {
    // Haunch line, the one interior line the reference style draws on sitting cats.
    const hip = bodyPoint(s, .06, .2);
    ctx.strokeStyle = ink; ctx.lineWidth = INNER_LINE; ctx.globalAlpha = Math.min(1, (p.thigh - .35) * 3);
    ctx.beginPath(); ctx.ellipse(hip.x + 3, hip.y + 2, s.rh * (.66 + .3 * p.thigh), s.rh * (.58 + .3 * p.thigh), -.25, -Math.PI * .98, -Math.PI * .08); ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (sm.folds.length) {
    // The folded legs: paw-coloured, with the curl of the leg where it lies on the belly (the reference style's one interior line), no line across the root.
    ctx.save(); ctx.clip(group);
    for (const f of sm.folds) { if (coat.socks) { ctx.fillStyle = coat.socks; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 1.08, f.r, f.a, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); } }
    ctx.strokeStyle = ink; ctx.lineWidth = INNER_LINE;
    for (const f of sm.folds) { ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 1.08, f.r, f.a, Math.PI * .12, Math.PI * .88); ctx.stroke(); }
    ctx.restore();
  } else if (mold.has('tuckPaw')) {
    // Tucked front paws peek out as small ovals under the chest: part of the silhouette, a thin line where they lie on the chest.
    const paws = mold.path(['tuckPaw'], false);
    underline(ctx, paws, body, ink);
    ctx.fillStyle = coat.socks ?? coat.base; ctx.fill(paws);
  }
  if (sm.tailGroup === 'tailFront') {
    if (!wrapped) underline(ctx, pathOf([strokePoly(tail, tailWidth(coat, phys))]), group, ink);
    strokeTail(ctx, tail, coat, phys, undefined, 'fill');
    // The line where the tail lies against the body.
    if (wrapped) {
      const w = tailWidth(coat, phys) / 2, ref = bodyPoint(s, .45, -.2), from = 2, to = tail.length - 2;
      ctx.strokeStyle = ink; ctx.lineWidth = INNER_LINE; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      for (let i = from; i <= to; i++) { const t0 = tail[i], dx = ref.x - t0.x, dy = ref.y - t0.y, d = Math.hypot(dx, dy) || 1, q = { x: t0.x + dx / d * w, y: t0.y + dy / d * w }; if (i === from) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); }
      ctx.stroke();
    }
  }
  if (p.fur > .01) {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.7; ctx.globalAlpha = Math.min(1, p.fur);
    for (const u of [.08, .3, .52, .74]) { const a = bodyPoint(s, u, -1.06 * up); ctx.beginPath(); ctx.moveTo(a.x - 3, a.y - 1 * up); ctx.lineTo(a.x, a.y - 6 * up); ctx.lineTo(a.x + 3, a.y - 1 * up); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (phys.thin > .4) p = { ...p, brow: Math.max(p.brow, (phys.thin - .4) * 1.6), ears: Math.max(p.ears, phys.thin * .35) };
  const headFirst = p.headBack > .5 && p.pawOver > .5;
  const collar = coat.collar && p.bellyUp < .5 && p.headBack < .5 ? collarGeom(headGeom(p, phys), s, up) : undefined;
  if (collar) drawCollarBand(ctx, coat, collar, s.rs);
  // The head: its fill and face over the body, and a thin line where it lies over the body (it fades into the round neck join).
  const paintHead = () => {
    underline(ctx, mold.path(['head'], false), mold.path(['body', 'far', 'tail', 'tailFront', 'tuckPaw'], false), ink);
    ctx.save(); ctx.translate(head.x, head.y); ctx.rotate(head.rot);
    drawHeadAt(ctx, p, coat, phys, head.W, head.H, blink, false);
    ctx.restore();
  };
  if (!headFirst) paintHead();
  if (collar) drawCollarTag(ctx, collar.tag, s.rs);
  options.props?.(ctx, { near: { x: leg.fn.px, y: leg.fn.py }, far: { x: leg.ff.px, y: leg.ff.py }, legScale });
  if (mold.has('paw')) {
    // A raised front paw (grooming, batting): a round the reference style stub, no toe lines, a thin line where it lies over head or body.
    const paw = mold.path(['paw']);
    underline(ctx, mold.path(['paw'], false), mold.path(['head', 'body'], false), ink);
    ctx.fillStyle = coat.base; ctx.fill(paw);
    if (coat.socks) { ctx.save(); ctx.clip(paw); socks(leg.fn); ctx.restore(); }
  }
  if (headFirst) paintHead();
  if (wet > .05) drawWet(ctx, s, head, wet, time);
  ctx.restore();
}

/** A long-haired cat's cheek tufts reach over the shoulders: the corners they make with the body are rounded like the neck's. */
export const tuftJoins = (parts: readonly MoldPart[], r: number): MoldJoin[] => parts.filter(p => p.id.startsWith('tuft')).map(p => ({ a: 'body', b: p.id, r, owner: 'body' }));
/** The shape genes and the whole physique (age, weight): what, besides the pose, decides the mould. */
export const genesOf = (look: CatLook, phys: Physique) => `${look.earSize},${look.earRound},${look.earFold ? 1 : 0},${look.earSpread},${look.cheek},${look.tailFluff},${look.tailLen},${look.longHair ? 1 : 0},${(Object.keys(phys) as (keyof Physique)[]).map(k => Math.round((phys[k] as number) * 400)).join(',')}`;
function legParts(id: string, group: string, l: Leg, k: number, hind: boolean): MoldPart[] {
  // A leg tapers from a full top (a thicker thigh behind) to a slim ankle and ends in the reference style's rounded stub of a paw.
  const top = LEG_R * k * (hind ? 1.24 : 1.08), ankle = LEG_R * k * .94;
  return [{ id, group, poly: capsulePoly(l.ax, l.ay, top, l.px, l.py, ankle) }, { id: `${id}Paw`, group, poly: ellipsePoly(l.px + 1.2 * k, l.py + ankle * .15, ankle * 1.06, ankle * .86) }];
}
function smoothPoly(pts: P[]): Poly {
  const n = pts.length, pen = new PolyPen(), mid = (a: P, b: P) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), seg = n > 80 ? 1 : 3;
  const start = mid(pts[n - 1], pts[0]);
  pen.moveTo(start.x, start.y);
  for (let i = 0; i < n; i++) { const m = mid(pts[i], pts[(i + 1) % n]); pen.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y, seg); }
  return pen.done()[0];
}

/**
 * The side rig's mould: body, head and ears, near and far legs, the haunch, folded or tucked paws, a raised paw and the tail, with
 * the joins the reference style draws round: neck, tail root, where each leg leaves the body, the ankles, the haunch. Cached by the geometry itself.
 */
function sideMold(p: Pose, look: CatLook, phys: Physique, s: Spine, head: HeadGeom, leg: ReturnType<typeof legs>, tail: P[], legScale: number, over: boolean, wrapped: boolean) {
  const tailGroup = wrapped || p.tailFront >= .5 ? 'tailFront' : 'tail';
  const farLegs: Leg[] = [];
  if (p.tuck < .95) farLegs.push(leg.ff);
  if (p.tuckBack < .95 && p.thigh < .6) farLegs.push(leg.bf);
  const up = p.bellyUp > .5 ? -1 : 1;
  const folds: { x: number; y: number; r: number; a: number }[] = [];
  if (p.bellyUp > .5) {
    // on its back an the reference style cat folds its legs onto its belly: soft bumps on the belly line, part of the silhouette.
    const fold = (u: number, k: number) => { const q = bodyPoint(s, u, -.72), i = Math.round(clamp(u, 0, 1) * SAMPLES); folds.push({ x: q.x, y: q.y, r: q.r * k * legScale, a: Math.atan2(s.tan[i].y, s.tan[i].x) }); };
    if (p.tuck >= .95) { fold(.78, .4); fold(.94, .46); }
    if (p.tuckBack >= .95) { fold(.1, .44); fold(.27, .5); }
  }
  const tuckPaws = !folds.length && p.tuck > .55;
  const raised = over && p.tuck < .95;
  // The cached part is the body and legs; the head (it glances, its ears flick) and the tail (it flicks and sways) are added each frame.
  // Keyed by the pose's own few numbers (the spine, the paws' targets; the physique is in the key's prefix), not by the hundred points they
  // make: a slow breath then crosses a rounding step a few times a breath instead of nearly every frame.
  const ratios = [p.arch, p.thigh, p.tuck, p.tuckBack, p.bellyUp, p.pawOver > .5 ? 1 : 0, p.pawMouth, over ? 1 : 0, wrapped ? 1 : 0, p.tailFront];
  const units: number[] = [p.hx, p.hy, p.sx, p.sy, p.rh, p.rs, p.fnX, p.fnY, p.ffX, p.ffY, p.bnX, p.bnY, p.bfX, p.bfY];
  if (p.pawMouth > .01) units.push(leg.fn.px, leg.fn.py);
  // The root of the tail is moulded with the body (a round join); the rest sways and flicks nearly all the time and is inked with the
  // silhouette each frame instead (drawCat), so a flick never rebuilds the mould.
  // The stub is the tail at rest (no wag, no flick), so the mould does not follow the sway; the swaying tail drawn over it stays within
  // its ink (a fraction of a unit at the root).
  const stub = p.tailWag || p.tailSway ? tailPoints({ ...p, tailWag: 0, tailSway: 0 }, s, 0, Math.hypot(tail[1].x - tail[0].x, tail[1].y - tail[0].y) * 10).slice(0, 4) : tail.slice(0, 4);
  for (const q of stub) units.push(q.x, q.y);
  const key = `side|${genesOf(look, phys)}|${moldKey(units, ratios)}`;
  const tw = tailWidth(look, phys);
  const base = moldCache(key, holes => {
    const parts: MoldPart[] = [{ id: 'tail', group: tailGroup, poly: strokePoly(stub, tw) }], joins: MoldJoin[] = [];
    joins.push(tailGroup === 'tail' ? { a: 'body', b: 'tail', r: tw * .9 } : { a: 'body', b: 'tail', r: tw * .5, owner: 'tailFront' });
    const legR = LEG_R * legScale;
    if (p.tuck < .95) parts.push(...legParts('farF', 'far', leg.ff, legScale, false));
    if (p.tuckBack < .95 && p.thigh < .6) parts.push(...legParts('farB', 'far', leg.bf, legScale, true));
    parts.push({ id: 'body', group: 'body', poly: smoothPoly(bodyOutline(s, phys.fluff)) });
    if (p.thigh > .02) { const hip = bodyPoint(s, .06, .2); parts.push({ id: 'thigh', group: 'body', poly: ellipsePoly(hip.x + 3, hip.y + 2, s.rh * (.66 + .3 * p.thigh), s.rh * (.58 + .3 * p.thigh), -.25) }); joins.push({ a: 'body', b: 'thigh', r: 4 }); }
    if (p.tuck < .95 && !over) parts.push(...legParts('nearF', 'body', leg.fn, legScale, false));
    if (p.tuckBack < .95) parts.push(...legParts('nearB', 'body', leg.bn, legScale, true));
    folds.forEach((f, i) => parts.push({ id: `fold${i}`, group: 'body', poly: ellipsePoly(f.x, f.y, f.r * 1.08, f.r, f.a) }));
    if (tuckPaws) {
      const chest = bodyPoint(s, .97, .82 * up);
      [0, 7.5].forEach((dx, i) => parts.push({ id: `tuck${i}`, group: 'tuckPaw', poly: ellipsePoly(chest.x + dx + 4, chest.y + 1.5 * up, 5.6, 3.8) }));
    }
    if (raised) {
      const l = leg.fn;
      if (p.pawMouth > .5) {
        // A licking paw folds at the elbow: upper arm forward and down, forearm up to the chin.
        const ex = l.ax + 9 * legScale + (l.px - l.ax) * .25, ey = Math.max(l.ay, l.py) + 7 * legScale;
        parts.push({ id: 'paw', group: 'paw', poly: capsulePoly(l.ax, l.ay, legR * 1.1, ex, ey, legR * 1.05) }, { id: 'paw2', group: 'paw', poly: capsulePoly(ex, ey, legR * 1.05, l.px, l.py, PAW_R * legScale * 1.2) });
        joins.push({ a: 'paw', b: 'paw2', r: 3, owner: 'paw' });
      } else parts.push({ id: 'paw', group: 'paw', poly: capsulePoly(l.ax, l.ay, legR * 1.1, l.px, l.py, PAW_R * legScale * 1.2) });
      joins.push({ a: 'body', b: 'paw', r: 3.5, owner: 'paw' });
    }
    // The joins the reference style draws round. Radii follow the parts, so a fat cat's joins are fuller and a kitten's smaller.
    for (const id of ['nearF', 'nearB']) joins.push({ a: 'body', b: id, r: legR * 1.1 }, { a: id, b: `${id}Paw`, r: 2.2 });
    for (const id of ['farF', 'farB']) joins.push({ a: 'body', b: id, r: legR * 1.1, owner: 'far' }, { a: id, b: `${id}Paw`, r: 2.2, owner: 'far' });
    joins.push({ a: 'thigh', b: 'nearB', r: legR }, { a: 'body', b: 'tuck0', r: 2, owner: 'tuckPaw' }, { a: 'body', b: 'tuck1', r: 2, owner: 'tuckPaw' });
    return buildMold(parts, joins, holes ? 16 : 0);
  });
  // The head (it glances, its ears flick) goes on top of the cached body, cached in its turn.
  const mold = extendCache(`${key}#${moldKey([head.x, head.y, head.W, head.H], [head.rot, p.ears, p.earTwitch, p.headTurn])}`, holes => {
    const hm: Mat = chain(translate(head.x, head.y), rotate(head.rot));
    const headParts: MoldPart[] = headPolys(head.W, head.H, look, phys, p).map(h => ({ id: h.id, group: 'head', poly: transformPoly(h.poly, hm) }));
    return extendMold(base, headParts, [{ a: 'body', b: 'head', r: head.H * .34 }, { a: 'head', b: 'earL', r: 1.8, owner: 'head' }, { a: 'head', b: 'earR', r: 1.8, owner: 'head' }, ...tuftJoins(headParts, head.H * .2)], holes ? 16 : 0);
  });
  return { mold: tapMold(mold, 'side', () => [strokePoly(tail, tw), ...(look.tailLen < .5 ? [tailPuff(tail, tw, look)] : [])]), farLegs, folds, tailGroup };
}

function drawDirt(ctx: CanvasRenderingContext2D, s: Spine, dirt: number, time: number) {
  ctx.globalAlpha = Math.min(.75, dirt * .9);
  ctx.fillStyle = '#7a5b3c';
  for (const [u, v, r] of [[.2, .3, 6], [.5, -.4, 5], [.75, .5, 7], [.35, .75, 4], [.9, -.2, 4]] as const) {
    if (dirt < r / 14) continue;
    const c = bodyPoint(s, u, v); ctx.beginPath(); ctx.ellipse(c.x, c.y, r * 1.3, r * .8, u * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (dirt > .6) {
    // Tiny flies circling a very dirty cat.
    ctx.fillStyle = '#3b3530';
    for (let i = 0; i < 2; i++) { const a = time * 5 + i * Math.PI, c = bodyPoint(s, .5, -1.6); ctx.beginPath(); ctx.arc(c.x + Math.cos(a) * 16, c.y + Math.sin(a * 1.3) * 6, 1.6, 0, Math.PI * 2); ctx.fill(); }
  }
}

function drawWet(ctx: CanvasRenderingContext2D, s: Spine, head: HeadGeom, wet: number, time: number) {
  ctx.fillStyle = '#9fd3ee'; ctx.strokeStyle = '#5a9ec0'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const c = i < 3 ? bodyPoint(s, .2 + i * .3, .9) : { x: head.x + (i - 3.5) * head.W, y: head.y + head.H * .8 };
    const fall = ((time * .8 + i * .37) % 1) * 10;
    ctx.globalAlpha = wet * (1 - fall / 10);
    ctx.beginPath(); ctx.ellipse(c.x, c.y + fall, 2, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export interface FrontOptions { scale: number; time?: number; blink?: number; face?: Partial<Pose>; dirt?: number; pose?: Pose; props?: DrawOptions['props'] }
/**
 * A cat sitting and facing the viewer: pear-shaped body, two front legs with paws, hind feet
 * peeking out on both sides and the tail wrapped around the front. Origin is the ground point.
 */
/** Measurements of the three-quarter sitting cat, shared by drawing and hit tests (unscaled units). */
/**
 * `stand` 0..1: the standing cat's own proportions, My Talking Tom style: a shorter
 * body that is more of a pear (narrower shoulders, wider hips), so with the longer legs (STAND_LEG) the head is about 40%
 * of the height, the body about 25% and the legs about 28%. 0: the sitting cat as before.
 */
/** How big a sitting cat's head is drawn against the body it was measured on. */
//.78 →.94, on a shorter, wider body (frontGeom).
export const SIT_HEAD = .94;
export function frontGeom(phys: Physique, breath = 0, stand = 0, rear = 0) {
  const W = HEAD_W * phys.head, H = HEAD_H * phys.head * phys.headRound;
  // Weight only: the kitten's extra roundness in phys.body is not fat.
  const kit = phys.kitten, teen = phys.teen, fat = Math.max(0, phys.body - 1 - kit * .05 - phys.senior * .05), thin = phys.thin, old = phys.senior;
  // Measured from the reference style's sitting cats: body about 0.7 of the head's half-width on each side and
  // 1.2 of it tall below the chin. Kittens: shorter and rounder. Teens: taller and slimmer.
  // Seniors: settled, a little wider at the bottom. Fat makes it a pear, thin a narrow tube.
  const st = clamp(stand, 0, 1);
  // Standing, the reference style's body is a little TALLER than the sitting one (no folded legs under it) and narrower at the hips: a pear about as
  // tall as the head, on short stubs (measured on the reference style's cats on two legs, `042`, `024`). A13: +40% (was +16%): the head was .62 of the
  // height on the moulded silhouette, the reference style's .56.
  const bodyH = W * (1.16 - kit * .26 + teen * .1 - old * .04 + fat * .05) * (.92 + phys.leg * .1) * (1 + .4 * st) + breath * .45;
  const off = W * .15, top = -bodyH;
  let topHalf = W * (.66 + fat * .2 - thin * .08 + kit * .03 - teen * .04) * (1 - .2 * st); let botHalf = W * (.8 + fat * .5 - thin * .1 + old * .07 + kit * .04 - teen * .05) * (1 - .06 * st);
  const headY = top - H * .8 + W * .14 - breath * .4;
  // seen from behind, the sitting cat is one round back, as wide as its head.
  // rounder and wider still, the tail lying further out (drawFrontCat).
  if (rear > 0) { const k = clamp(rear, 0, 1); topHalf *= 1 + .28 * k; botHalf *= 1 + .42 * k; }
  return { W, H, kit, fat, thin, old, bodyH, off, top, topHalf, botHalf, L: off - botHalf, R: off + botHalf, lx1: off - botHalf * .4, lx2: off + botHalf * .14, headY, mouth: { x: 0, y: headY + H * .36 } };
}

/** Leg length of the standing cat, in head widths. */
// the reference style's cat on two legs stands on stubs (legs ~.06–.10 of its height):.9 →.38 (the round hips hide the top of them).
export const STAND_LEG = .405;
/**
 * The pupil of a coloured eye: normally a round
 * black disc; the old upright slit only when the pupil is narrowed (`pupilK` < .75: startled, scared, angry, about to pounce, bright
 * sun outdoors; see World.updatePose). `look.pupil` makes the disc bigger (Kuku, the big-eyed one). `maxH`: the slit's height.
 */
export function pupilSize(look: { pupil?: number }, e: number, pupilK: number, maxH: number, wide: boolean): [number, number] {
  if (pupilK < .75) return [(wide ? 2.6 : 1.7) * e * pupilK, maxH];
  const r = Math.min(maxH, (wide ? 2.8 : 2.45) * e * Math.min(pupilK, 1.9) * (look.pupil ?? 1));
  return [r, r];
}

/** The standing cat's measures (front model, drawing units), the same numbers drawFrontCat uses. For the tests and layout. */
export function standGeom(phys: Physique) {
  const g = frontGeom(phys, 0, 1), legH = g.W * STAND_LEG, headH = g.H * 2, overlap = Math.max(0, g.headY + g.H - g.top);
  return { ...g, legH, headH, overlap, footW: g.botHalf * .3 * 1.85 };
}

/** Where the two hands hold the strings overhead (front model, drawing space): either side of the head, a little above it. */
export function overheadGrips(g: ReturnType<typeof frontGeom>): [P, P] {
  // ABOVE the head and just outside it, so the arms show whole
  // along the sides of the head and the paws close on the strings over the ear tips, not on the ears.
  const y = g.headY - g.H - g.W * .4, cx = g.off * .4;
  return [{ x: cx - g.W * 1.16, y }, { x: cx + g.W * 1.16, y }];
}

/** The shadow an arm casts on the body it hangs in front of: the arm's shape, nudged in and down, clipped to the body, a shade darker. */
function armShade(ctx: CanvasRenderingContext2D, body: Path2D, shapes: { fill: Path2D; sd: number }[], base: string) {
  ctx.save(); ctx.clip(body); ctx.fillStyle = shade(base, isDark(base) ? .7 : .86); ctx.globalAlpha = .7;
  for (const sh of shapes) { ctx.save(); ctx.translate(-sh.sd * 2.2, 2.6); ctx.fill(sh.fill); ctx.restore(); }
  ctx.restore();
}

/**
 * An arm of the standing or holding cat: the limb and its paw. A13: both are pieces of the moulded silhouette (their outer ink is
 * the silhouette's); painted here only as fills with a thin line where they lie over the body or the head (no ring round the arm, no line
 * across the wrist: the fill of the paw covers the arm's line there).
 */
interface ArmSpec { poly: Poly; pawPoly: Poly; fill: Path2D; paw: Path2D; e: P; h: P; front: boolean }
function armSpec(sh: { poly: Poly; e: P; h: P }, pr: number, front: boolean): ArmSpec {
  const dir = Math.atan2(sh.h.y - sh.e.y, sh.h.x - sh.e.x), cx = sh.h.x + Math.cos(dir) * pr * .22, cy = sh.h.y + Math.sin(dir) * pr * .22;
  const pawPoly = ellipsePoly(cx, cy, pr * 1.06, pr * .9, dir);
  return { poly: sh.poly, pawPoly, fill: pathOf([sh.poly]), paw: pathOf([pawPoly]), e: sh.e, h: sh.h, front };
}
function paintArm(ctx: CanvasRenderingContext2D, a: ArmSpec, armFill: string, pawFill: string, over: Path2D, ink: string, pawOnly = false) {
  underline(ctx, pathOf(pawOnly ? [a.pawPoly] : [a.poly, a.pawPoly]), over, ink);
  // A dark arm is a touch lighter than the body behind it (light falls on what is nearer), so it reads without a hard rim.
  if (!pawOnly) { ctx.fillStyle = isDark(armFill) ? mix(armFill, '#ffffff', .07) : armFill; ctx.fill(a.fill); }
  ctx.fillStyle = pawFill; ctx.fill(a.paw);
}

export function drawFrontCat(ctx: CanvasRenderingContext2D, look: CatLook, phys: Physique, o: FrontOptions) {
  const t = o.time ?? 0, breath = Math.sin(t / 3.4 * Math.PI * 2);
  const pp = o.pose, upright = clamp(pp?.upright ?? 0, 0, 1);
  const g = frontGeom(phys, breath, upright, pp && pp.headBack > .5 && upright < .5 ? 1 : 0), { W, H, kit, thin, bodyH, off, top, topHalf, botHalf, L, R, lx1, lx2 } = g;
  ctx.save();
  ctx.scale(o.scale * phys.scale, o.scale * phys.scale);
  if (pp) { ctx.translate(0, -pp.lift); ctx.rotate(pp.rot); ctx.scale(pp.squashX, pp.squashY); }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const ink = innerInk(look.base);
  // Standing on two legs: the body rises by the legs' height.
  const standing = upright > .5, legH = W * STAND_LEG * upright;
  // each leg a soft drumstick that bends at the
  // knee as the foot lifts (limb), the foot a bean. A13: legs, feet and the web between them are pieces of the moulded silhouette.
  const legParts: { leg: Poly; foot: Poly; sock: [number, number, number, number]; hip: P; knee: P; ankle: P; ar: number }[] = [];
  let web: Poly | null = null, crease: Path2D | null = null;
  const legFill = look.legs ?? look.base, footFill = look.socks ?? legFill;
  if (upright > 0) {
    ctx.translate(0, -legH);
    const stride = clamp(pp!.stride, -1, 1);
    const gait = clamp(pp!.gait, 0, 2), reach = .16 + gait * (GAIT_REACH - .16), spread = clamp(pp!.legSpread ?? 0, 0, 1), hang = clamp((pp!.armsUp ?? 0) - 1, 0, 1);
    const r0 = botHalf * .48, r1 = botHalf * .32;
    for (const sd of [-1, 1]) {
      // Hanging, the legs dangle closer together under the body (a held-up cat), not planted wide like a stool's.
      const swing = stride * -sd, x = off + sd * botHalf * .44 * (1 - .22 * clamp((pp!.armsUp ?? 0) - 1, 0, 1));
      // The feet a little wider than the hips, so the gap between the legs is a soft Λ and not a box. Flung open (legSpread):
      // the feet go out to the sides and up, the knee bent outwards.
      const fx = x + sd * botHalf * .14 + swing * W * reach + sd * spread * W * .4;
      const lift = (1 - Math.min(1, gait)) * Math.max(0, swing) * W * .1 + Math.min(1, gait) * Math.max(0, -sd * clamp(pp!.strideUp, -1, 1)) * W * .13 + spread * legH * .3;
      const bend = clamp(lift / (W * .13), 0, 1.4);
      // A bean of a paw, toes a little outwards. Hanging, the hind legs dangle like a real cat's held up
      // under the arms: a small round paw at the end of the leg, toes down, no wide flat sole.
      const ar = botHalf * .2 * (1 - hang * .08);
      const rx = botHalf * .3 * 1.4 * (1 - hang) + ar * 1.3 * hang, ry = W * .11 * (1 - hang) + ar * 1.18 * hang;
      const cx = fx + sd * W * .05 * (1 - hang), cy = legH - ry + W * .035 - lift + hang * W * .02;
      // The ankle ends INSIDE the paw.
      const ankle = { x: fx + sd * W * .02 * (1 - hang), y: cy - ry * (.15 + hang * .2) };
      // The knee: a little out (a chubby cat stands slightly bow-legged), further out and up as the leg lifts or opens.
      const hip = { x, y: -bodyH * .14 };
      const knee = { x: (hip.x + ankle.x) / 2 + sd * W * (.035 + bend * .07 + spread * .14), y: (hip.y + ankle.y) / 2 - bend * W * .02 };
      legParts.push({ leg: limb(hip, knee, ankle, r0, r1, ar).poly, foot: ellipsePoly(cx, cy, rx, ry, sd * (spread * .5 + .06) * (1 - hang * .7)), sock: [ankle.x, cy - ry * .5, ar * 1.6, ry * 1.25], hip, knee, ankle, ar });
    }
    const [La, Ra] = legParts[0].knee.x < legParts[1].knee.x ? [legParts[0], legParts[1]] : [legParts[1], legParts[0]];
    let minGap = Infinity;
    for (const u of [.4, .55, .7, .85]) { const l = limbAt(La.hip, La.knee, La.ankle, r0, r1, La.ar, u), r = limbAt(Ra.hip, Ra.knee, Ra.ankle, r0, r1, Ra.ar, u); minGap = Math.min(minGap, (r.x - r.r) - (l.x + l.r)); }
    const lev = minGap < W * .32 ? 0 : 2; // the thinnest cat's standing Λ measures .34 W (13 cats × 3 ages × 3 weights)
    if (lev < 2 && spread < .5) {
      const inner = (q: typeof La, sd: number) => ({ h: { x: q.hip.x + sd * r0 * .7, y: q.hip.y }, k: { x: q.knee.x + sd * r1 * .7, y: q.knee.y }, a: { x: q.ankle.x + sd * q.ar * .6, y: q.ankle.y } });
      const iL = inner(La, 1), iR = inner(Ra, -1), a = iL.a, b = iR.a, topY = Math.min(La.hip.y, Ra.hip.y) - W * .05;
      const pen = new PolyPen(); pen.moveTo(La.hip.x, topY); pen.lineTo(iL.k.x, iL.k.y);
      pen.lineTo(a.x, a.y); pen.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - Math.max(W * .02, Math.abs(b.x - a.x) * .7), b.x, b.y);
      pen.lineTo(iR.k.x, iR.k.y); pen.lineTo(Ra.hip.x, topY);
      web = pen.done()[0];
      // Merged down to the shins, the leg in front keeps a thin inner line from the knee down, so it reads as one leg over the other.
      const [q, sd] = stride >= 0 ? [La, 1] : [Ra, -1];
      crease = new Path2D();
      for (let i = 0; i <= 8; i++) { const c = limbAt(q.hip, q.knee, q.ankle, r0, r1, q.ar, .42 + i / 8 * .4); const x = c.x + sd * c.r, y = c.y; if (i) crease.lineTo(x, y); else crease.moveTo(x, y); }
    }
  }
  // the reference style's sitting cat seen three-quarter: one bell of a body almost as wide as the head, leaning toward the tail side, the front legs only
  // two short lines at the bottom, a rounded haunch, and the tail rising behind. Kittens: a shorter, rounder bean and a short thin tail.
  const tailW = W * (.27 - kit * .07) * (1 + look.tailFluff * .4), tailLen = (1 - kit * .3) * look.tailLen;
  // the reference style sitting cats keep the tail still, then swish it once, then rest again.
  const sway0 = pp ? pp.tailSway * .8 : 0;
  const tail: P[] = [], restTail: P[] = [];
  for (let i = 0; i <= 5; i++) { const u = i / 16, rise = Math.max(0, u - .18) / .82 * bodyH * 1.12 * Math.min(1, tailLen) / (1 + look.tailFluff * .25); restTail.push({ x: R - W * .3 + Math.sin(Math.min(1, u * 1.5) * Math.PI * .5) * W * .82 * tailLen, y: top + bodyH * .78 - rise - Math.sin(u * Math.PI) * W * .05 }); }
  for (let i = 0; i <= 16; i++) {
    // the reference style's swish in 16 drawings, travelling from the root to the tip (rhythm.ts tailFlick).
    const u = i / 16, sway = sway0 + tailFlick(t, 6, u) * .95, rise = Math.max(0, u - .18) / .82 * bodyH * 1.12 * Math.min(1, tailLen) / (1 + look.tailFluff * .25);
    // a long or fluffy tail must not reach the cheek: tail, body and head then closed a pocket that drew as a black slot.
    const back = Math.max(0, u - .74) ** 2 * W * 1.3 * tailLen * (1 - Math.min(.7, look.tailFluff * .45));
    tail.push({ x: R - W * .3 + Math.sin(Math.min(1, u * 1.5) * Math.PI * .5) * W * .82 * tailLen - back + sway * u * u * W * .14, y: top + bodyH * .78 - rise - Math.sin(u * Math.PI) * W * .05 });
  }
  // Seen from behind (the reference style's "sitting with its back to us" poses): the tail lies on the floor in front of the body instead of rising
  // behind it, no bib, no front legs; the back's markings show.
  const back = !!pp && pp.headBack > .5;
  const lie: P[] = [];
  const restLie: P[] = [];
  if (back) for (let i = 0; i <= 4; i++) { const u = i / 14; restLie.push({ x: off + u * W * 1.7 * look.tailLen, y: -W * .06 - Math.max(0, u - .7) ** 2 * W * 1.6 }); }
  if (back) for (let i = 0; i <= 14; i++) { const u = i / 14; lie.push({ x: off + u * W * 1.7 * look.tailLen, y: -W * .06 - Math.max(0, u - .7) ** 2 * W * 1.6 - tailFlick(t, 8, u) * Math.max(0, u - .5) * W * .34 }); }
  const bodyPen = new PolyPen();
  bodyPen.moveTo(off - topHalf, top + W * .1);
  bodyPen.quadraticCurveTo(off, top - W * .12, off + topHalf, top + W * .1, 8);
  bodyPen.bezierCurveTo(off + topHalf + W * .1, top + bodyH * .35, R + W * .08, top + bodyH * .62, R, -bodyH * .16);
  bodyPen.quadraticCurveTo(R - W * .02, 0, R - W * .28, 0);
  // Flat bottom: the two front legs are drawn on top, below. Standing, the bottom rounds down into a full belly and hips the legs
  // come out of, a pear and not a box; sitting it stays exactly as it was.
  const sag = W * .17 * clamp((upright - .3) / .5, 0, 1);
  if (sag > 0) bodyPen.quadraticCurveTo(off, sag * 2, L + W * .14, 0, 8); else bodyPen.lineTo(L + W * .14, 0);
  bodyPen.quadraticCurveTo(L - W * .02, 0, L - W * .01 * (1 + kit * 6), -bodyH * .22);
  bodyPen.bezierCurveTo(L - W * (.02 + kit * .06), top + bodyH * .45, off - topHalf - W * .03, top + bodyH * .2, off - topHalf, top + W * .1);
  const bodyPoly = bodyPen.done()[0], body = pathOf([bodyPoly]);
  // Back feet: the reference style's ¾ sitting cat shows only the far haunch's foot, a low lobe on the tail side.
  const lobe = standing || back ? null : ellipsePoly(R - W * .12, -W * .06, W * .2, W * .1);
  const raise = pp ? Math.max(pp.pawMouth, pp.pawOver > .5 ? 1 : 0) : 0;
  const holding = (pp?.armsUp ?? 0) > .001 && !!pp && pp.headBack < .5;
  // rise_paw: a sitting cat facing us with a front leg up as an arm (Pose.sitArm).
  const sitArms = !standing && !holding && !back && !!pp && (pp.sitArm ?? 0) > .5 && (pp.armLA > .05 || pp.armRA > .05);
  const sitArmL = sitArms && pp!.armLA > .05, sitArmR = sitArms && pp!.armRA > .05;
  // Head, sitting on the body; it bows a little to a raised paw.
  const pose: Pose = { ...STAND, headTurn: 0, headRot: Math.sin(t * .7) * .03, ...(pp ?? {}), ...o.face };
  const bow = pp && pp.pawMouth > .01 ? pp.pawMouth : 0;
  // Standing, the head sits a little lower over the body's top edge, so no line shows under the chin like a neck joint.
  const hx = (pp ? pp.headTurn * -W * .12 : 0), hy = g.headY + bow * W * .1 + W * .07 * clamp((upright - .3) / .5, 0, 1);
  const headRot = pose.headRot * (pp ? .6 : 1) - bow * .16, headPose: Pose = { ...pose, headTurn: pose.headTurn * .5 };
  // A sitting cat's head, smaller on its body, scaled about the chin so it
  // stays on the shoulders. The round portraits keep their size.
  const hs = SIT_HEAD * (1 + kit * .04), chin = H * .72;
  const headM: Mat = chain(translate(hx, hy), rotate(headRot), translate(0, chin), scaleM(hs), translate(0, -chin));
  const armFill = look.legs ?? look.base, pawFill = look.socks ?? look.legs ?? look.chest ?? look.base;
  const arms: (ArmSpec & { sd: number; s: P; pawFront: boolean })[] = [], hands: P[] = [];
  let strong = 0, armR = 0;
  if (holding) {
    // armsUp 0..1 curls a bar up to the chin (the gym); 1..2 goes on up to both hands overhead, beside the head, gripping
    // the strings of the parachute.
    const up = clamp(pp!.armsUp, 0, 1), over = clamp(pp!.armsUp - 1, 0, 1);
    strong = clamp(pp!.muscle ?? 0, 0, 1);
    const hand = overheadGrips(g);
    const gripY = (-bodyH * .26 + (top + bodyH * .12 + bodyH * .26) * up) * (1 - over) + hand[0].y * over, gripX = (topHalf + W * .1) * (1 - over) + (hand[1].x - off) * over;
    armR = botHalf * .2 * (1 + strong * .4) * (1 + over * .3);
    const pawR = botHalf * .26 * (1 + strong * .2);
    for (const sd of [-1, 1]) {
      // Hanging: the elbows go out beside the jaw, so the upper arm shows leaving the body under the cheek and the forearm runs up
      // beside the head to the hand: the arm reads whole, like a child hanging from a bar.
      const sx = off + sd * topHalf * (.74 + .2 * over), sy = top + bodyH * .3, gx = (off + sd * gripX) * (1 - over) + hand[sd < 0 ? 0 : 1].x * over;
      const ex = off + sd * (botHalf * .92 + strong * W * .05) * (1 - over) + (off * .4 + sd * W * 1.34) * over, ey = (top + bodyH * .64) * (1 - over) + (g.headY + H * .3) * over;
      const e = { x: ex, y: ey }, h = { x: gx, y: gripY };
      hands.push(h);
      arms.push({ ...armSpec({ poly: limb({ x: sx, y: sy }, e, h, armR * 1.2, armR * 1.02, armR * .86).poly, e, h }, pawR, over < .5), sd, s: { x: sx, y: sy }, pawFront: false });
    }
  } else if (standing || sitArms) {
    // Arms of the standing cat: from the shoulders, an upper arm at the shoulder angle and a forearm bent at the elbow.
    // rise_paw: a sitting cat's arm (Pose.sitArm) is the same short arm on its shorter body.
    const l1 = bodyH * .3, l2 = bodyH * .3, chinY = hy + H * .9;
    for (const sd of [-1, 1]) {
      if (!standing && !(sd < 0 ? sitArmL : sitArmR)) continue;
      const a = sd < 0 ? pp!.armLA : pp!.armRA, b = sd < 0 ? pp!.armLB : pp!.armRB;
      // From the shoulders at the sides of the body, not from the neck.
      const s0 = { x: off + sd * topHalf * 1.02, y: top + bodyH * .32 };
      const e = { x: s0.x + sd * Math.sin(a) * l1, y: s0.y + Math.cos(a) * l1 };
      const h = { x: e.x + sd * Math.sin(a + b) * l2, y: e.y + Math.cos(a + b) * l2 };
      hands.push(h);
      arms.push({ ...armSpec({ poly: limb(s0, e, h, botHalf * .3, botHalf * .23, botHalf * .19).poly, e, h }, botHalf * .33, false), sd, s: s0, pawFront: h.y < chinY + botHalf * .2 });
    }
  }
  // A raised front paw of the sitting cat: up from the chest, bent at the wrist, to the chin (washing) or in front.
  let rpaw: Poly[] = [];
  if (raise > .02 && !holding && !standing) {
    const washing = pp!.pawMouth > .01;
    const ax = lx1 + W * .02, ay = top + bodyH * .55;
    const tx = washing ? hx - W * .5 + pp!.pawDX * W * .04 : lx1 - W * .28, ty = washing ? hy + H * .66 + pp!.pawDY * W * .03 : top + bodyH * .2;
    const px = ax + (tx - ax) * raise, py = -W * .1 + (ty + W * .1) * raise;
    const ex = Math.min(ax, px) - W * .14, ey = Math.max(ay, py) + W * .1;
    rpaw = [capsulePoly(ax, ay, LEG_R * .85, ex, ey, LEG_R * .8), capsulePoly(ex, ey, LEG_R * .8, px, py, PAW_R * .92)];
  }

  // the whole cat as one moulded silhouette (cat-mold.ts): head, body, tail, haunch foot, legs, feet, arms, a raised paw.
  // Cached: body, legs, arms, the haunch foot, a raised paw. The head (it breathes, glances, flicks its ears) and the tail are added each frame.
  // Keyed by what makes it (the physique in the prefix, the breath's height, the pose's limb numbers), not by the points it makes.
  const units: number[] = [bodyH];
  if (rpaw.length) units.push(rpaw[1][rpaw[1].length >> 1].x, rpaw[1][rpaw[1].length >> 1].y);
  const ratios = pp ? [upright, back ? 1 : 0, standing ? 1 : 0, raise, pp.stride, pp.gait, pp.strideUp, pp.legSpread ?? 0, pp.armsUp ?? 0, pp.muscle ?? 0, pp.armLA, pp.armRA, pp.armLB, pp.armRB] : [0];
  // The root of the tail is moulded with the body; the rest flicks and is inked with the silhouette each frame (see inkSilhouette).
  // The stub is the tail at rest (no flick, no sway), so the mould does not follow the tail's motion.
  const tg = back ? 'tailFloor' : 'tail', tl = back ? lie : tail, stub = back ? restLie.slice(0, 4) : restTail.slice(0, 5);
  for (const q of stub) units.push(q.x, q.y);
  const key = `front|${genesOf(look, phys)}|${moldKey(units, ratios)}`;
  const base = moldCache(key, holes => {
    const parts: MoldPart[] = [{ id: 'tail', group: tg, poly: strokePoly(stub, tailW) }], joins: MoldJoin[] = [{ a: 'body', b: 'tail', r: tailW * (back ? .5 : .9), owner: back ? 'tailFloor' : 'body' }];
    if (lobe) parts.push({ id: 'lobe', group: 'lobe', poly: lobe });
    legParts.forEach((q, i) => parts.push({ id: `leg${i}`, group: 'legs', poly: q.leg }, { id: `foot${i}`, group: 'legs', poly: q.foot }));
    if (web) parts.push({ id: 'web', group: 'legs', poly: web });
    parts.push({ id: 'body', group: 'body', poly: bodyPoly });
    arms.forEach((a, i) => parts.push({ id: `arm${i}`, group: `arm${i}`, poly: a.poly }, { id: `paw${i}`, group: `arm${i}`, poly: a.pawPoly }));
    rpaw.forEach((q, i) => parts.push({ id: `rpaw${i}`, group: 'rpaw', poly: q }));
    joins.push({ a: 'body', b: 'lobe', r: W * .08 });
    legParts.forEach((q, i) => joins.push({ a: 'body', b: `leg${i}`, r: botHalf * .3 }, { a: `leg${i}`, b: `foot${i}`, r: q.ar * .7, owner: 'legs' }));
    arms.forEach((a, i) => joins.push({ a: 'body', b: `arm${i}`, r: botHalf * .14, owner: `arm${i}` }, { a: `arm${i}`, b: `paw${i}`, r: 2, owner: `arm${i}` }));
    joins.push({ a: 'body', b: 'rpaw0', r: 3, owner: 'rpaw' }, { a: 'rpaw0', b: 'rpaw1', r: 3, owner: 'rpaw' });
    return buildMold(parts, joins, holes ? 16 : 0);
  });
  // The head goes on top of the cached body, cached in its turn (it breathes and glances).
  const tailFull = [strokePoly(tl, tailW), ...(look.tailLen < .5 ? [tailPuff(tl, tailW, look)] : [])];
  const mold = tapMold(extendCache(`${key}#${moldKey([hx, hy], [headRot, hs, headPose.headTurn, headPose.ears, headPose.earTwitch])}`, holes => {
    const headParts: MoldPart[] = headPolys(W, H, look, phys, headPose).map(h => ({ id: h.id, group: 'head', poly: transformPoly(h.poly, headM) }));
    return extendMold(base, headParts, [{ a: 'body', b: 'head', r: H * .32 }, { a: 'head', b: 'earL', r: 1.8, owner: 'head' }, { a: 'head', b: 'earR', r: 1.8, owner: 'head' }, ...tuftJoins(headParts, H * .2), ...arms.map((_a, i) => ({ a: 'head', b: `arm${i}`, r: 2.5, owner: `arm${i}` }))], holes ? 16 : 0);
  }), 'front', () => tailFull);

  inkSilhouette(ctx, mold, look.base, OUTLINE * 2, () => strokeTail(ctx, tl, look, { ...phys, body: 1 }, tailW, 'ink'));
  // Behind the body: the rising tail, the far haunch's foot, the legs (their tops are covered by the body).
  if (!back) strokeTail(ctx, tail, look, { ...phys, body: 1 }, tailW, 'fill');
  if (lobe) { ctx.fillStyle = look.socks ?? look.base; ctx.fill(mold.path(['lobe'])); }
  if (legParts.length) {
    const legs = mold.path(['legs']);
    ctx.fillStyle = legFill; ctx.fill(legs);
    // A sock of another colour comes up the ankle a little in a soft curve (a tuxedo cat's white feet), so leg and paw blend.
    if (footFill !== legFill) { ctx.save(); ctx.clip(legs); ctx.fillStyle = footFill; for (const q of legParts) { ctx.beginPath(); ctx.ellipse(...q.sock, 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
    ctx.fillStyle = footFill; for (const q of legParts) ctx.fill(pathOf([q.foot]));
    if (crease) { ctx.strokeStyle = ink; ctx.lineWidth = INNER_LINE; ctx.stroke(crease); }
    // no toe creases; the reference style's feet are plain round stubs.
  }
  // The body over them: a thin line where it lies over the tail (the reference style draws the body's edge across a tail behind it) and the haunch foot.
  if (!back) underline(ctx, body, pathOf(tailFull), ink);
  if (lobe) underline(ctx, body, mold.path(['lobe'], false), ink);
  ctx.fillStyle = look.base; ctx.fill(mold.path(['body']));
  ctx.save(); ctx.clip(body);
  if (back) {
    // The back: patches sit across it, tabby stripes run over it, Roki's smile shows.
    look.bodyPatches.forEach((patch, i) => { ctx.fillStyle = patch.color; ctx.beginPath(); ctx.ellipse(off + (i % 2 ? 1 : -1) * W * .18 * (i > 0 ? 1 : 0) + (patch.u - .5) * W * .5, top + bodyH * (.3 + (1 + patch.v) * .3), patch.ru * W * 1.6, patch.rv * bodyH * .8, 0, 0, Math.PI * 2); ctx.fill(); });
    if (look.stripes && !look.stripesHeadOnly) { ctx.strokeStyle = look.stripes; ctx.lineWidth = W * .09; ctx.lineCap = 'round'; for (const y of [.2, .38, .56, .74]) for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(off + sd * topHalf * 1.1, top + bodyH * (y + .06)); ctx.quadraticCurveTo(off + sd * W * .25, top + bodyH * (y - .02), off + sd * W * .04, top + bodyH * y); ctx.stroke(); } }
    if (look.backSmile) {
      ctx.fillStyle = look.backSmile; ctx.globalAlpha = .9; const cy = top + bodyH * .52;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(off + sd * W * .2, cy - W * .1, W * .07, W * .08, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.beginPath(); ctx.ellipse(off, cy + W * .1, W * .26, W * .1, 0, 0, Math.PI); ctx.ellipse(off, cy + W * .1, W * .2, W * .04, 0, Math.PI, 0, true); ctx.fill(); ctx.globalAlpha = 1;
    }
  } else look.bodyPatches.forEach((patch, i) => { ctx.fillStyle = patch.color; ctx.beginPath(); ctx.ellipse(i % 2 ? R - W * .08 : L + W * .1, top + bodyH * (.42 + patch.v * .2), patch.ru * W * 1.1, patch.rv * bodyH * .7, 0, 0, Math.PI * 2); ctx.fill(); });
  if (!back && look.stripes && !look.stripesHeadOnly) { ctx.strokeStyle = look.stripes; ctx.lineWidth = W * .1; for (const y of [.3, .5, .7]) { ctx.beginPath(); ctx.moveTo(R + W * .1, top + bodyH * y); ctx.quadraticCurveTo(R - W * .2, top + bodyH * y - W * .05, R - W * .4, top + bodyH * y + W * .04); ctx.stroke(); } }
  // Cream bib from the chin down over the front legs. With legs of their own colour the bib is a narrower strip down the middle.
  if (!back && (look.chest || look.belly)) { ctx.fillStyle = look.chest ?? look.belly!; ctx.beginPath(); ctx.ellipse(off - W * .2, top + bodyH * .58, W * (look.legs ? .36 : .52), bodyH * .66, 0, 0, Math.PI * 2); ctx.fill(); }
  if (look.socks && !standing) { ctx.fillStyle = look.socks; for (const [x, w] of [[(L + lx1) / 2, (lx1 - L) / 2 + 3], [(lx1 + lx2) / 2, (lx2 - lx1) / 2 + 3], [R - W * .22, W * .26]]) { ctx.beginPath(); ctx.ellipse(x, 0, w, W * .22, 0, Math.PI, 0); ctx.fill(); } }
  if (standing && !back) { ctx.fillStyle = shade(look.chest ?? look.belly ?? look.base, .9); ctx.globalAlpha = .55; ctx.beginPath(); ctx.ellipse(off * .5, top + W * .12, topHalf * 1.05, W * .2, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  if (thin > .35) { ctx.strokeStyle = shade(look.base, .75); ctx.lineWidth = 1.6; ctx.globalAlpha = Math.min(1, (thin - .35) * 2); for (const y of [.42, .55, .68]) { ctx.beginPath(); ctx.arc(R - W * .35, top + bodyH * y, W * .3, -.6, .35); ctx.stroke(); } ctx.globalAlpha = 1; }
  if (o.dirt) { ctx.globalAlpha = Math.min(.7, o.dirt); ctx.fillStyle = '#7a5b3c'; for (const [x, y, r] of [[-.2, .4, .14], [.5, .65, .16], [-.4, .8, .1]]) { ctx.beginPath(); ctx.ellipse(off + x * W, top + bodyH * y, r * W * 1.3, r * W * .8, 0, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
  ctx.restore();
  if (back) {
    // From behind: one round back with no lines on it, and the tail lying on the floor, its tip curling up.
    underline(ctx, pathOf(tailFull), body, ink);
    strokeTail(ctx, lie, look, { ...phys, body: 1 }, tailW, 'fill');
  }
  if (!back && !standing) {
    // the reference style's sitting cat, front view. No haunch line; the two front legs
    // stand CLOSED in the middle of the chest, drawn only by the line between them and a short outer line near the floor; each ends in a
    // paw hinted by a thin crease across its top (a mitten), never toe lines. The paws sit on the floor line: nothing pokes out below it.
    const sitLegFill = look.legs ?? look.chest ?? look.belly ?? look.base;
    const lw = botHalf * .42, c = off - botHalf * .16, sitLegH = bodyH * (.44 - kit * .06), pr = W * (.085 + kit * .015);
    [c - lw / 2, c + lw / 2].forEach((px, i) => {
      if ((i === 0 && (raise > .3 || sitArmL)) || (i === 1 && sitArmR) || holding) return;
      const out = i === 0 ? -1 : 1, leg = new Path2D();
      leg.moveTo(px - lw / 2, 0); leg.lineTo(px - lw / 2, -sitLegH + lw * .45);
      leg.quadraticCurveTo(px - lw / 2, -sitLegH, px, -sitLegH); leg.quadraticCurveTo(px + lw / 2, -sitLegH, px + lw / 2, -sitLegH + lw * .45);
      leg.lineTo(px + lw / 2, 0); leg.closePath();
      ctx.save(); ctx.clip(body);
      if (sitLegFill !== look.base) { ctx.fillStyle = sitLegFill; ctx.fill(leg); }
      // A sock: a rounded cuff a paw high.
      if (look.socks) { ctx.save(); ctx.clip(leg); ctx.fillStyle = look.socks; ctx.beginPath(); ctx.ellipse(px, -pr * .2, lw * .62, pr * 1.9, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      ctx.restore();
      ctx.strokeStyle = ink; ctx.lineCap = 'round';
      // The outer edge only near the floor, flaring a touch into the paw.
      ctx.lineWidth = INNER_LINE; ctx.beginPath(); ctx.moveTo(px + out * lw * .5, -sitLegH * .5); ctx.quadraticCurveTo(px + out * lw * .5, -pr * 1.6, px + out * lw * .56, -W * .02); ctx.stroke();
      // The paw: one thin crease over the top of the mitten.
      ctx.lineWidth = INNER_LINE * .8; ctx.beginPath(); ctx.ellipse(px, -pr * .15, lw * .42, pr, 0, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
    });
    // The line between the two closed legs, from the chest down to the floor.
    if (!holding) { ctx.strokeStyle = ink; ctx.lineWidth = INNER_LINE; ctx.beginPath(); ctx.moveTo(c + (raise > .3 || sitArmL ? -lw * .5 : 0), -sitLegH * .96); ctx.quadraticCurveTo(c + W * .01, -sitLegH * .4, c, -W * .02); ctx.stroke(); }
  }
  // The arms in two passes: those behind the head now, the raised ones after the head. A prop (a card, a phone, the bar, the strings)
  // goes into the hand just before the arm that holds it, so the paw closes over it.
  const propsInFront = !!arms[1] && (arms[1].front || arms[1].pawFront);
  const headRegion = mold.path(['head'], false);
  const paintArms = (front: boolean) => {
    if (front) {
      if (propsInFront && !arms[1].front) o.props?.(ctx, { near: hands[0], far: hands[1], legScale: 1 });
      // A paw raised in front of the face on an arm that hangs behind the head (waving, the phone): only the paw again, over the head.
      for (const a of arms) if (!a.front && a.pawFront) paintArm(ctx, a, armFill, pawFill, headRegion, ink, true);
    }
    const set = arms.filter(a => a.front === front);
    if (!set.length) return;
    if (set.includes(arms[1]) && (front || !propsInFront)) o.props?.(ctx, { near: hands[0], far: hands[1], legScale: 1 });
    // Soft shade where each arm lies on the body (cel shading): the body reads as round, the arm as in front of it.
    if (standing && !holding && !front) armShade(ctx, body, set.filter(a => !a.pawFront), look.base);
    const over = front ? mold.path(['body', 'head', 'tail', 'legs'], false) : mold.path(['body', 'tail', 'legs'], false);
    for (const a of set) {
      paintArm(ctx, a, armFill, pawFill, over, ink);
      if (strong > .3) {
        // A round bump of muscle on the upper arm.
        ctx.strokeStyle = ink; ctx.lineWidth = 1.8; ctx.beginPath();
        ctx.arc((a.s.x + a.e.x) / 2 + a.sd * armR * .5, (a.s.y + a.e.y) / 2, armR * (.55 + strong * .35), a.sd < 0 ? Math.PI * .6 : -Math.PI * .4, a.sd < 0 ? Math.PI * 1.4 : Math.PI * .4); ctx.stroke();
      }
    }
  };
  paintArms(false);
  // Collar round the neck, just under the chin.
  const cy = g.headY + H * .9;
  if (look.collar) {
    const cw = topHalf * .92, band = Math.max(3.2, W * .13);
    ctx.save(); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(off - cw, cy - W * .02); ctx.quadraticCurveTo(off * .5, cy + W * .2, off + cw, cy - W * .02);
    ctx.strokeStyle = INK; ctx.lineWidth = band + 3.2; ctx.stroke(); ctx.strokeStyle = look.collar; ctx.lineWidth = band; ctx.stroke();
    if (look.collarDots) { ctx.fillStyle = look.collarDots; for (let i = 1; i < 6; i++) { const u = i / 6, x = (1 - u) ** 2 * (off - cw) + 2 * u * (1 - u) * off * .5 + u * u * (off + cw), y = (1 - u) ** 2 * (cy - W * .02) + 2 * u * (1 - u) * (cy + W * .2) + u * u * (cy - W * .02); ctx.beginPath(); ctx.arc(x, y, band * .2, 0, Math.PI * 2); ctx.fill(); } }
    ctx.restore();
  }
  // The head over the body (and the shoulders of arms hanging behind it): a thin line where it lies over them, fading into the round
  // join at the neck, then its fill and face.
  underline(ctx, headRegion, mold.path(['body', 'tail', 'legs', 'arm0', 'arm1', 'lobe'], false), ink);
  ctx.save(); ctx.transform(...headM);
  drawHeadAt(ctx, headPose, look, phys, W, H, o.blink ?? 1, false);
  ctx.restore();
  // The gold tag hangs at the front of the collar, below the chin.
  if (look.collar) drawCollarTag(ctx, { x: off * .5, y: cy + W * .08 }, W * .62);
  // Both front legs holding a bar (the gym): elbows tucked at the sides, forearms curling the bar from the lap up to under the chin;
  // or hands overhead on the parachute strings. Raised hands of the standing cat (waving, the phone at the ear, cheering).
  paintArms(true);
  if (rpaw.length) {
    // A raised front paw: up from the chest, bent at the wrist, to the chin (washing) or in front; a thin line over the chest and face.
    underline(ctx, mold.path(['rpaw'], false), mold.path(['body', 'head'], false), ink);
    ctx.fillStyle = look.socks ?? look.chest ?? look.base; ctx.fill(mold.path(['rpaw']));
  }
  ctx.restore();
}

/** Front-facing portrait: head with a bit of chest, centred in a size×size box. */
export function drawPortrait(ctx: CanvasRenderingContext2D, look: CatLook, phys: Physique, size: number, p: Partial<Pose> = {}) {
  const base: Pose = { ...STAND, headTurn: 0, headRot: 0, ...p };
  const W = HEAD_W * phys.head, H = HEAD_H * phys.head * phys.headRound;
  const top = H + 20 * phys.ear + 6, bottom = H * 2.2;
  const k = Math.min(size / (W * 2.45), size / (top + bottom));
  ctx.save();
  ctx.translate(size / 2, top * k + (size - (top + bottom) * k) / 2); ctx.scale(k, k);
  // Shoulders.
  const chest = new Path2D(); chest.ellipse(0, H * 1.45, W * .78, H * 1.1, 0, 0, Math.PI * 2);
  ctx.strokeStyle = INK; ctx.lineWidth = OUTLINE * 2; ctx.stroke(chest); ctx.fillStyle = look.base; ctx.fill(chest);
  if (look.chest || look.belly) { ctx.save(); ctx.clip(chest); ctx.fillStyle = look.chest ?? look.belly!; ctx.beginPath(); ctx.ellipse(0, H * 1.5, W * .4, H * .9, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  if (look.collar) { ctx.save(); ctx.clip(chest); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-W * .8, H * .9); ctx.quadraticCurveTo(0, H * 1.25, W * .8, H * .9); ctx.strokeStyle = INK; ctx.lineWidth = W * .16 + 3; ctx.stroke(); ctx.strokeStyle = look.collar; ctx.lineWidth = W * .16; ctx.stroke(); ctx.restore(); }
  drawHeadAt(ctx, base, look, phys, W, H, 1);
  if (look.collar) drawCollarTag(ctx, { x: 0, y: H * 1.1 }, W * .6);
  ctx.restore();
}
