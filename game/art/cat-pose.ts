import { tailFlick } from './rhythm';
import { INK as INK_OUT, shade, type CatLook, type Physique } from './cat-look';
import { OUTLINE, SIT_HEAD, STAND, bushyTail, drawHeadAt, frontGeom, genesOf, headPolys, strokeTail, tailPuff, tuftJoins, type Pose } from './cat-rig';
import { INNER_LINE, buildMold, capsulePoly, chain, ellipsePoly, extendCache, extendMold, inkSilhouette, innerInk, moldCache, moldKey, pathOf, rotate,
  scale as scaleM, strokePoly, tapMold, transformPoly, translate, underline, type MoldJoin, type MoldPart, type P, type Poly } from './cat-mold';

export type V = readonly [number, number];
/** A soft bean: centre, half length, half thickness, tilt; `rump` swells the −x end, `flat` flattens the bottom where it rests. */
export interface Bean { c: V; a: number; b: number; rot?: number; rump?: number; flat?: number;
  /** Bent like a kidney: the two ends are pushed this far (head units) across the bean, so it follows a curved body. */
  bend?: number }
export interface Limb { from: V; to: V; r?: number; paw?: number }
export interface PoseSprite {
  id: string;
  body: Bean;
  /**
   * the body, legs and paws as ONE outline drawn in one stroke
   * through these points (a closed smooth curve), as the reference style draws a cat: legs are swells of that line, not pieces stuck on. Replaces `body`
   * for the silhouette (`body` then only lays out the coat's patches).
   */
  outline?: V[];
  /** Thin inner lines (open smooth curves): the thigh, a leg in front of another, a paw's edge. */
  lines?: V[][];
  /** Forearms folded on the chest or reaching for a toy, as the reference style's "∩": from the elbow (inside the body) to the round paw, a thin line round them. */
  arms?: { from: V; to: V; w?: number;
    /** In front of the head too (a paw curled up under the chin lies over the cheek); otherwise the head covers it. */
    front?: boolean }[];
  /**
   * A paw curled round: a round paw whose line runs round it and stops
   * short, leaving it open toward `open` (radians, canvas angles) where the arm comes from; `front`: over the head too (under the chin).
   */
  curls?: { at: V; r: number; open: number; front?: boolean;
    /** Two little toe lines on the paw's far side. */
    toes?: boolean }[];
  hooks?: { path: V[]; pad: Bean; front?: boolean }[];
  /** Paw ends on the body (a raised foot, a paw on the chest): for a cat with socks or coloured legs, that colour there, inside the outline. */
  socks?: Bean[];
  view?: 'side' | 'belly';
  /** The pale belly or chest, inside the body (only for coats that have one). */
  belly?: Bean;
  head: { at: V; rot?: number; scale?: number; turn?: number; face?: Partial<Pose>;
    /** 0..1: the head rests its weight on the floor: a
     *  little wider and lower, pressed about its chin, so the cheeks spread on the floor. */
    flat?: number };
  /** Legs that stick out of the body (part of the silhouette), each ending in a round paw. */
  legs?: Limb[];
  /** Round paws in front of the chest or the head (part of the silhouette, drawn last with a thin line over what they cover). */
  mitts?: { at: V; r: number; ry?: number; rot?: number }[];
  /** The tail's path from its root; `tailFront`: it lies in front of the body (round the front of a loaf). */
  tail: V[]; tailFront?: boolean;
  /** The tail's path for a cat with a bushy plume (Coki, Piw Piw, Mochi), when the plume needs more room than a thin tail's path gives. */
  tailBushy?: V[];
  /** Where a held toy goes (behind the mittens). */
  prop?: { at: V; r: number };
}
/**
 * How heavy the drawn poses' lines are. the reference style's line is about a
 * twentieth of the head's width; ours was a thirtieth. The outline is stroked at twice the width that shows (the fill covers the inner half).
 */
export const POSE_LINE = OUTLINE * 1.45, POSE_INNER = INNER_LINE * 1.5;
export interface PoseDraw { scale?: number; time?: number; blink?: number; squashY?: number; prop?: (x: number, y: number, r: number) => void }

function bean(s: Bean, W: number, n = 44): Poly {
  const out: Poly = [], rot = s.rot ?? 0, cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2, c = Math.cos(t), si = Math.sin(t);
    let y = s.b * si * (1 + (s.rump ?? 0) * Math.max(0, -c));
    if (si > 0) y *= 1 - (s.flat ?? 0) * si * si * .45;
    const x = s.a * c; y += (s.bend ?? 0) * c * c;
    out.push({ x: (s.c[0] + x * cr - y * sr) * W, y: (s.c[1] + x * sr + y * cr) * W });
  }
  return out;
}
const at = (v: V, W: number): P => ({ x: v[0] * W, y: v[1] * W });

/**
 * Weight shows in the body: everything but the head grows away from the head
 * (a fat cat's body is up to a sixth bigger, a thin one's a tenth smaller); the head keeps its size, as in the rig.
 */
export const poseGirth = (fat: number, thin: number) => 1 + fat * .5 - thin * .16;
function fatten(ps: PoseSprite, k: number): PoseSprite {
  if (Math.abs(k - 1) < .005) return ps;
  const [hx, hy] = ps.head.at, f = (v: V): V => [hx + (v[0] - hx) * k, hy + (v[1] - hy) * k];
  const beanK = (b: Bean): Bean => ({ ...b, c: f(b.c), a: b.a * k, b: b.b * k, bend: b.bend === undefined ? undefined : b.bend * k });
  return { ...ps, body: beanK(ps.body), outline: ps.outline?.map(f), lines: ps.lines?.map(l => l.map(f)), belly: ps.belly && beanK(ps.belly),
    arms: ps.arms?.map(a => ({ ...a, from: f(a.from), to: f(a.to), w: (a.w ?? .2) * k })), curls: ps.curls?.map(c => ({ ...c, at: f(c.at), r: c.r * k })), socks: ps.socks?.map(beanK),
    hooks: ps.hooks?.map(h => ({ ...h, path: h.path.map(f), pad: beanK(h.pad) })),
    legs: ps.legs?.map(l => ({ ...l, from: f(l.from), to: f(l.to), r: (l.r ?? .24) * k, paw: (l.paw ?? .26) * k })),
    mitts: ps.mitts?.map(m => ({ ...m, at: f(m.at), r: m.r * k, ry: m.ry === undefined ? undefined : m.ry * k })),
    tail: ps.tail.map(f), tailBushy: ps.tailBushy?.map(f), prop: ps.prop && { at: f(ps.prop.at), r: ps.prop.r } };
}

export function drawPoseSprite(ctx: CanvasRenderingContext2D, look: CatLook, phys: Physique, ps: PoseSprite, o: PoseDraw = {}) {
  const t = o.time ?? 0, g = frontGeom(phys, 0, 0), { W, H, kit, thin } = g;
  ps = fatten(ps, poseGirth(g.fat, thin));
  const body = ps.outline ? closedSpline(ps.outline.map(v => at(v, W))) : bean(ps.body, W);
  const legs = (ps.legs ?? []).map(l => {
    const a = at(l.from, W), b = at(l.to, W), r = (l.r ?? .24) * W;
    return { leg: capsulePoly(a.x, a.y, r, b.x, b.y, r * .82), paw: ellipsePoly(b.x, b.y, (l.paw ?? .26) * W, (l.paw ?? .26) * W * .86, Math.atan2(b.y - a.y, b.x - a.x)) };
  });
  const mitts = (ps.mitts ?? []).map(m => ellipsePoly(m.at[0] * W, m.at[1] * W, m.r * W, (m.ry ?? m.r * .82) * W, m.rot ?? 0));
  // The floor: the lowest point of body, legs and paws.
  let floor = -Infinity;
  for (const p of [body, ...legs.flatMap(l => [l.leg, l.paw]), ...mitts]) for (const q of p) floor = Math.max(floor, q.y);
  const tailW = W * (.27 - kit * .07) * (1 + look.tailFluff * .4);
  // A tail that lies lower than the body (out from under a cat on its back) is on the floor too, not under it.
  for (const v of ps.tail) floor = Math.max(floor, v[1] * W + tailW * .5);
  const tailPath = ps.tailBushy && bushyTail(look) ? ps.tailBushy : ps.tail;
  const tailAt = (flick: boolean) => tailPath.map((v, i) => { const u = i / (tailPath.length - 1), f = flick ? tailFlick(t, 9, u) : 0; return { x: v[0] * W, y: v[1] * W - f * u * u * W * .35 }; });
  const tail = smoothPath(tailAt(true)), rest = smoothPath(tailAt(false)).slice(0, 4);
  const hs = SIT_HEAD * (1 + kit * .04) * (ps.head.scale ?? 1), chin = H * .72, hx = ps.head.at[0] * W, hy = ps.head.at[1] * W, rot = ps.head.rot ?? 0;
  const flatK = ps.head.flat ?? 0;
  const headM = chain(translate(hx, hy), rotate(rot), translate(0, chin), scaleM(hs * (1 + .09 * flatK), hs * (1 - .13 * flatK)), translate(0, -chin));
  const headPose: Pose = { ...STAND, headTurn: (ps.head.turn ?? 0) * .5, headRot: 0, ...(ps.head.face ?? {}) } as Pose;
  const front = !!ps.tailFront;
  const key = `pose|${ps.id}|${genesOf(look, phys)}`;
  const base = moldCache(key, holes => {
    const parts: MoldPart[] = [{ id: 'tail', group: front ? 'tailFloor' : 'tail', poly: strokePoly(rest, tailW) }, { id: 'body', group: 'body', poly: body }];
    const joins: MoldJoin[] = [{ a: 'body', b: 'tail', r: tailW * .7, owner: front ? 'tailFloor' : 'body' }];
    legs.forEach((l, i) => { parts.push({ id: `leg${i}`, group: 'legs', poly: l.leg }, { id: `lpaw${i}`, group: 'legs', poly: l.paw }); joins.push({ a: 'body', b: `leg${i}`, r: W * .16, owner: 'legs' }, { a: `leg${i}`, b: `lpaw${i}`, r: W * .05, owner: 'legs' }); });
    mitts.forEach((m, i) => { parts.push({ id: `mitt${i}`, group: 'mitts', poly: m }); joins.push({ a: 'body', b: `mitt${i}`, r: W * .06, owner: 'mitts' }); });
    return buildMold(parts, joins, holes ? 16 : 0);
  });
  const tailFull = [strokePoly(tail, tailW), ...(look.tailLen < .5 ? [tailPuff(tail, tailW, look)] : [])];
  const mold = tapMold(extendCache(`${key}#${moldKey([hx, hy], [rot, hs, headPose.headTurn, headPose.ears, headPose.earTwitch])}`, holes => {
    const headParts: MoldPart[] = headPolys(W, H, look, phys, headPose).map(h => ({ id: h.id, group: 'head', poly: transformPoly(h.poly, headM) }));
    return extendMold(base, headParts, [{ a: 'body', b: 'head', r: H * .38 }, { a: 'head', b: 'earL', r: 1.8, owner: 'head' }, { a: 'head', b: 'earR', r: 1.8, owner: 'head' },
      ...mitts.map((_m, i) => ({ a: 'head', b: `mitt${i}`, r: 2, owner: 'mitts' })), ...tuftJoins(headParts, H * .2)], holes ? 16 : 0);
  }), 'pose', () => tailFull);

  ctx.save();
  const k = (o.scale ?? 1) * phys.scale;
  ctx.scale(k, k * (o.squashY ?? 1)); ctx.translate(0, -floor);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const ink = innerInk(look.base), bodyPath = pathOf([body]);
  inkSilhouette(ctx, mold, look.base, POSE_LINE * 2, () => strokeTail(ctx, tail, look, { ...phys, body: 1 }, tailW, 'ink'));
  if (!front) { strokeTail(ctx, tail, look, { ...phys, body: 1 }, tailW, 'fill'); underline(ctx, bodyPath, pathOf(tailFull), ink); }
  // Legs behind the body's edge (their roots are under it), their paws in the sock colour.
  if (legs.length) {
    ctx.fillStyle = look.legs ?? look.base; ctx.fill(mold.path(['legs']));
    ctx.fillStyle = look.socks ?? look.legs ?? look.base; for (const l of legs) ctx.fill(pathOf([l.paw]));
    underline(ctx, bodyPath, mold.path(['legs'], false), ink);
  }
  ctx.fillStyle = look.base; ctx.fill(mold.path(['body']));
  // The coat on the body: patches laid along the bean (u from the rump to the shoulders, v −1 the top), tabby stripes across it, the belly.
  ctx.save(); ctx.clip(bodyPath);
  const s = ps.body, br = s.rot ?? 0, cr = Math.cos(br), sr = Math.sin(br), on = (lx: number, ly: number): P => ({ x: (s.c[0] + lx * cr - ly * sr) * W, y: (s.c[1] + lx * sr + ly * cr) * W });
  const bellyView = ps.view === 'belly';
  for (const p of look.bodyPatches) {
    // Belly view: a patch on the back (v < 0) sits just past the floor-side rim, so only its edge shows as a crescent there.
    const q = bellyView ? on((p.u - .5) * 1.7 * s.a, s.b * (1 - Math.min(0, p.v) * .25)) : on((p.u - .5) * 1.7 * s.a, p.v * s.b * .95), kr = bellyView ? .8 : 1;
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(q.x, q.y, p.ru * s.a * W * 1.5 * kr, p.rv * s.b * W * 1.2 * kr, br, 0, Math.PI * 2); ctx.fill();
  }
  if (look.stripes && !look.stripesHeadOnly) {
    ctx.strokeStyle = look.stripes; ctx.lineWidth = W * .11;
    for (const u of [-.6, -.25, .1, .45]) { const a = on(u * s.a, bellyView ? s.b * 1.05 : -s.b * 1.05), m = on(u * s.a - s.a * .08, bellyView ? s.b * .82 : -s.b * .55), b = on(u * s.a + s.a * .02, bellyView ? s.b * .62 : -s.b * .2); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(m.x, m.y, b.x, b.y); ctx.stroke(); }
  }
  const pale = look.belly ?? look.chest;
  if (ps.belly && pale) { ctx.fillStyle = pale; ctx.fill(pathOf([bean(ps.belly, W)])); }
  const pawColour = look.socks ?? look.legs;
  if (ps.socks && pawColour) { ctx.fillStyle = pawColour; for (const b of ps.socks) ctx.fill(pathOf([bean(b, W)])); }
  if (thin > .35) { ctx.strokeStyle = shade(look.base, .75); ctx.lineWidth = 1.6; ctx.globalAlpha = Math.min(1, (thin - .35) * 2); for (const u of [-.2, .05, .3]) { const q = on(u * s.a, -s.b * .3); ctx.beginPath(); ctx.arc(q.x, q.y, W * .35, -.6 + br, .35 + br); ctx.stroke(); } ctx.globalAlpha = 1; }
  ctx.restore();
  if (front) { underline(ctx, pathOf(tailFull), mold.path(['body', 'legs'], false), ink); strokeTail(ctx, tail, look, { ...phys, body: 1 }, tailW, 'fill'); }
  // Inner lines: thin, smooth, inside the silhouette only.
  if (ps.lines) { ctx.save(); ctx.clip(mold.path(['body', 'legs'], false)); ctx.strokeStyle = ink; ctx.lineWidth = ps.hooks ? POSE_INNER : INNER_LINE; for (const l of ps.lines) strokeOpen(ctx, smoothPath(l.map(v => at(v, W)), 6)); ctx.restore(); }
  const propLate = !!ps.arms?.length;
  if (ps.prop && o.prop && propLate) o.prop(ps.prop.at[0] * W, ps.prop.at[1] * W, ps.prop.r * W);
  const drawArm = (a: NonNullable<PoseSprite['arms']>[number]) => {
    // A forearm: a long rounded mitten from the elbow to the paw; filled (the paw end in the sock colour), the thin line along its sides and
    // round its paw, none across the elbow end (it grows out of the chest).
    const p0 = at(a.from, W), p1 = at(a.to, W), w = (a.w ?? .2) * W, d = Math.atan2(p1.y - p0.y, p1.x - p0.x), nx = -Math.sin(d), ny = Math.cos(d);
    const side: P[] = [], other: P[] = [];
    for (let i = 0; i <= 8; i++) { const u = i / 8, x = p0.x + (p1.x - p0.x) * u, y = p0.y + (p1.y - p0.y) * u, ww = w * (.86 + .14 * u); side.push({ x: x + nx * ww, y: y + ny * ww }); other.push({ x: x - nx * ww, y: y - ny * ww }); }
    const tip: P[] = []; for (let i = 1; i < 12; i++) { const th = d + Math.PI / 2 - i / 12 * Math.PI; tip.push({ x: p1.x + Math.cos(th) * w, y: p1.y + Math.sin(th) * w }); }
    const shape = [...side, ...tip, ...other.reverse()], path = pathOf([shape]);
    ctx.fillStyle = look.legs ?? look.base; ctx.fill(path);
    // The sock colour on the paw end only, so the forearm's root is the body's own colour and grows out of it (a wholly white forearm
    // on a dark chest read as a piece laid on the cat).
    if (look.socks) { ctx.save(); ctx.clip(path); ctx.fillStyle = look.socks; ctx.beginPath(); ctx.arc(p1.x, p1.y, w * 1.25, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    ctx.strokeStyle = ink; ctx.lineWidth = INNER_LINE; strokeOpen(ctx, shape);
  };
  const drawCurl = (c: NonNullable<PoseSprite['curls']>[number]) => {
    // The paw's disc in the paw's colour, then the line round it from one side of the opening to the other (a quarter of the round left open).
    const q = at(c.at, W), r = c.r * W, gap = Math.PI * .2;
    ctx.fillStyle = look.socks ?? look.legs ?? look.base; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = INNER_LINE; ctx.beginPath(); ctx.arc(q.x, q.y, r, c.open + gap, c.open - gap + Math.PI * 2); ctx.stroke();
    if (c.toes) for (const d of [-.42, .42]) { const a = c.open + Math.PI + d; ctx.beginPath(); ctx.moveTo(q.x + Math.cos(a) * r * .98, q.y + Math.sin(a) * r * .98); ctx.lineTo(q.x + Math.cos(a) * r * .5, q.y + Math.sin(a) * r * .5); ctx.stroke(); }
  };
  const drawHook = (h: NonNullable<PoseSprite['hooks']>[number]) => {
    // The paw's area in its colour, kept inside the cat's own outline; then the hooked line, a little heavier than the other inner lines
    // (it is the paw's whole drawing), with round ends.
    ctx.save(); ctx.clip(mold.path(['body', 'head', 'legs'], false)); ctx.fillStyle = look.socks ?? look.legs ?? look.base; ctx.fill(pathOf([bean(h.pad, W)])); ctx.restore();
    // As heavy as the outline shows.
    ctx.strokeStyle = INK_OUT; ctx.lineWidth = POSE_LINE; strokeOpen(ctx, smoothPath(h.path.map(v => at(v, W)), 6));
  };
  for (const a of ps.arms ?? []) if (!a.front) drawArm(a);
  for (const c of ps.curls ?? []) if (!c.front) drawCurl(c);
  for (const h of ps.hooks ?? []) if (!h.front) drawHook(h);
  // The head over the body: a thin line where it lies on it (fading into the round join), then its fill and our face.
  underline(ctx, mold.path(['head'], false), mold.path(['body', 'legs', 'tail', 'tailFloor'], false), ink);
  ctx.save(); ctx.transform(...headM); drawHeadAt(ctx, headPose, look, phys, W, H, o.blink ?? 1, false); ctx.restore();
  if (ps.prop && o.prop && !propLate && ps.hooks) o.prop(ps.prop.at[0] * W, ps.prop.at[1] * W, ps.prop.r * W);
  for (const a of ps.arms ?? []) if (a.front) drawArm(a);
  for (const c of ps.curls ?? []) if (c.front) drawCurl(c);
  for (const h of ps.hooks ?? []) if (h.front) drawHook(h);
  if (ps.prop && o.prop && !propLate && !ps.hooks) o.prop(ps.prop.at[0] * W, ps.prop.at[1] * W, ps.prop.r * W);
  if (mitts.length) {
    // Round paws over the chest or under the chin: a thin line where they lie on the cat, filled in the sock (or chest) colour.
    underline(ctx, pathOf(mitts), mold.path(['body', 'head', 'legs'], false), ink);
    // The paw's own colour (a white-socked cat's paws are white), else the coat: white mittens on a dark chest read as buttons.
    ctx.fillStyle = look.socks ?? look.legs ?? look.base; ctx.fill(mold.path(['mitts']));
    ctx.strokeStyle = ink; ctx.lineWidth = INNER_LINE;
    for (const m of mitts) { ctx.save(); ctx.clip(pathOf(mitts.filter(x => x !== m))); ctx.stroke(pathOf([m])); ctx.restore(); }
  }
  ctx.restore();
}

function strokeOpen(ctx: CanvasRenderingContext2D, pts: P[]) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (const q of pts.slice(1)) ctx.lineTo(q.x, q.y); ctx.stroke(); }
/** A closed smooth curve through the points (Catmull-Rom, wrapping round): the one-stroke outline of a pose. */
function closedSpline(pts: P[], per = 7): Poly {
  const n = pts.length, out: Poly = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let j = 0; j < per; j++) {
      const u = j / per, u2 = u * u, u3 = u2 * u;
      out.push({ x: .5 * (2 * p1.x + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
        y: .5 * (2 * p1.y + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3) });
    }
  }
  return out;
}
/** A few points made into a smooth path (Catmull-Rom), so a tail curls instead of bending at corners. */
function smoothPath(pts: P[], per = 4): P[] {
  if (pts.length < 3) return pts;
  const out: P[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let j = 0; j < per; j++) {
      const u = j / per, u2 = u * u, u3 = u2 * u;
      out.push({ x: .5 * (2 * p1.x + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
        y: .5 * (2 * p1.y + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3) });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// ———————————————————————————————————————— the poses (head units; the reference style's number they are drawn after, look only)

const ASLEEP: Partial<Pose> = { eyeStyle: 'closed', ears: .15 };
// the reference style's resting cats are mostly head (measured on the reference style's pictures, width ÷ head width: on its back 1.47, curled 1.25, loaf 1.24, with yarn
// 1.34, on its side 2.33): compact bodies, tails curled in close, front paws as real forearms.
/** Points measured from the head's middle in head half-widths (x to the right, y down), put where the head is: `k` = our head's size. */
const fromHead = (at: V, k: number, pts: V[]): V[] => pts.map(([x, y]) => [at[0] + x * k, at[1] + y * k] as V);
// The head's size here: our head's half width is .949 × its scale of the unit; the body's points are measured in head half-widths.
const BU_AT: V = [1.0, -2.5], BU_SCALE = 1.2, BU_K = .949 * BU_SCALE, bu = (pts: V[]) => fromHead(BU_AT, BU_K, pts);
const BU_NECK: V[] = [[-.7, .1], [-1.0, .06], [-1.15, .11], [-1.25, .21], [-1.28, .34], [-1.25, .42], [-1.4, .5], [-1.55, .62]];
const BU_LOBE: V[] = [[-1.66, .45], [-1.79, .37], [-1.96, .45], [-2.09, .72], [-2.14, .94], [-2.08, 1.25]];
// Round the bottom and up the right side, where the right forepaw's back is the body's own edge.
const BU_ROUND: V[] = [[-1.89, 1.51], [-1.55, 1.72], [-1.02, 1.86], [-.6, 1.77], [-.26, 1.55], [0, 1.21], [.13, 1.02], [.14, .83], [.11, .64], [0, .48], [-.3, .3]];
const BU_FOOT: V[] = [[-1.19, 1.09], [-1.05, .82], [-.87, .74], [-.72, .86], [-.66, 1.06], [-.72, 1.21]];
const BU_HOOK_L: V[] = [[-1.01, .06], [-.87, .06], [-.72, .13], [-.64, .26], [-.65, .4], [-.74, .48], [-.85, .51], [-.94, .46], [-.98, .41]];
const BU_HOOK_R: V[] = [[-.11, .81], [-.21, .83], [-.32, .79], [-.38, .7], [-.37, .58], [-.28, .49], [-.13, .45], [.02, .5], [.11, .64], [.14, .83], [.13, 1.02], [.07, 1.13], [0, 1.21], [-.08, 1.32]];
const shift = (pts: V[], dx: number, dy: number): V[] => pts.map(([x, y]) => [x + dx, y + dy] as V);
const buHooks = (lx = 0, ly = 0, rx = 0, ry = 0): NonNullable<PoseSprite['hooks']> => [
  { path: bu(shift(BU_HOOK_L, lx, ly)), pad: { c: bu([[-.96 + lx, .28 + ly]])[0], a: .33 * BU_K, b: .24 * BU_K }, front: true },
  { path: bu(shift(BU_HOOK_R, rx, ry)), pad: { c: bu([[-.13 + rx, .66 + ry]])[0], a: .27 * BU_K, b: .25 * BU_K }, front: true }];
export const BELLY_UP: PoseSprite = {
  id: 'bellyUp', view: 'belly', body: { c: bu([[-.95, 1.12]])[0], a: 1.15, b: 1.0, rot: -.87 },
  outline: bu([...BU_NECK, ...BU_LOBE, ...BU_ROUND]),
  // The pale belly lies along the body, from the chest between the forepaws down to between the hind legs, wider at the belly end
  //.
  // Round, and bent with the body:
  // its ends curl up toward the chest and toward the raised leg, its middle sits in the round of the belly.
  // (and again: "bulatnya beneran di perut, bukan di samping perut"). The torso runs from the neck down-left to the rump (−.9 rad);
  // the patch sits in its middle, under the two forepaws, the foot on the belly inside it, bent a little toward the hollow side.
  belly: { c: bu([[-.74, 1.1]])[0], a: .74, b: .62, rot: -.9, bend: -.2 },
  lines: [bu([[-1.55, .62], [-1.53, .8], [-1.57, .94]]), bu(BU_FOOT)],
  hooks: buHooks(),
  // Paw ends only: the tip of
  // the raised hind leg and the tip of the foot on the belly; the legs themselves keep the coat's colour.
  socks: [{ c: bu([[-1.83, .5]])[0], a: .22 * BU_K, b: .17 * BU_K, rot: -.2 }, { c: bu([[-.88, .86]])[0], a: .17 * BU_K, b: .12 * BU_K }],
  // On its back the head is tipped over and a little back: the face sits a touch high, not staring at us.
  head: { at: BU_AT, rot: .48, scale: BU_SCALE, turn: 0, face: { eyeStyle: 'open', mouth: 'w', blush: .35, headPitch: .3, lookY: -1, lookX: -.35 } },
  tail: bu([[-.55, 1.42], [-.12, 1.6], [.3, 1.6], [.62, 1.47], [.8, 1.25], [.82, 1.06]]),
  // A plume: out along the floor and up in a long curve, room for the fur.
  tailBushy: bu([[-.55, 1.42], [-.1, 1.62], [.4, 1.64], [.8, 1.5], [1.04, 1.24], [1.1, 1]]),
};
/** The same cat kicking the air a little: the raised leg lifts, the foot on the belly pats, the paws rub. */
export const BELLY_KICK: PoseSprite = { ...BELLY_UP, id: 'bellyKick',
  outline: bu([...BU_NECK, ...shift(BU_LOBE, -.03, -.1), ...BU_ROUND]), lines: [BELLY_UP.lines![0], bu(shift(BU_FOOT, .06, -.08))],
  socks: [{ ...BELLY_UP.socks![0], c: bu([[-1.86, .4]])[0] }, { ...BELLY_UP.socks![1], c: bu([[-.82, .78]])[0] }],
  head: { ...BELLY_UP.head, face: { ...BELLY_UP.head.face, eyeStyle: 'happy', mouth: 'smile', blush: .5 } } };
export const TICKLE: PoseSprite = { ...BELLY_UP, id: 'tickle',
  head: { at: [BU_AT[0] + .04, BU_AT[1] + .08], rot: .8, scale: BU_SCALE, turn: 0, face: { eyeStyle: 'happy', mouth: 'open', mouthOpen: .45, blush: .8, headPitch: .18, ears: .15 } } };
/** The wriggle: the head rocks back, the raised leg and the foot on the belly kick. */
export const TICKLE_B: PoseSprite = { ...TICKLE, id: 'tickleB', outline: BELLY_KICK.outline, socks: BELLY_KICK.socks, lines: BELLY_KICK.lines,
  head: { ...TICKLE.head, rot: .64, face: { ...TICKLE.head.face, mouthOpen: .65 } } };
export const BELLY_SLEEP: PoseSprite = { ...BELLY_UP, id: 'bellySleep', head: { ...BELLY_UP.head, rot: .54, face: { ...ASLEEP, mouth: 'w', blush: .35, headPitch: .18 } } };
/**
 * Hugging a toy on its back. The
 * very cat of BELLY_UP (same body, head, tail), the toy on its belly: both forepaws on top of it, the hind foot against it from below, the
 * raised leg beside it. The toy is whatever the caller draws at `prop` (the item the cat hugs in the game).
 */
const HB: V = [-.84, .9], HB_R = .56;
const footHook = (dx = 0, dy = 0): NonNullable<PoseSprite['hooks']>[number] =>
  ({ path: bu(shift([[-1.2, 1.56], [-1.12, 1.3], [-.94, 1.2], [-.78, 1.3], [-.72, 1.52]], dx, dy)), pad: { c: bu([[-.96 + dx, 1.36 + dy]])[0], a: .2 * BU_K, b: .17 * BU_K }, front: true });
export const HUG_BALL: PoseSprite = { ...BELLY_UP, id: 'hugBall', lines: [BELLY_UP.lines![0]], socks: [BELLY_UP.socks![0]],
  hooks: [...buHooks(-.06, .12, -.14, .04), footHook()], prop: { at: bu([HB])[0], r: HB_R * BU_K },
  head: { ...BELLY_UP.head, face: { ...BELLY_UP.head.face, eyeStyle: 'wide', mouth: 'open', mouthOpen: .2, lookY: .4, lookX: -.5 } } };
export const HUG_KICK: PoseSprite = { ...HUG_BALL, id: 'hugKick', outline: BELLY_KICK.outline, socks: [BELLY_KICK.socks![0]],
  hooks: [...buHooks(-.06, .12, -.14, .04), footHook(.05, -.12)], prop: { at: bu([[HB[0] + .02, HB[1] - .05]])[0], r: HB_R * BU_K },
  head: { ...HUG_BALL.head, face: { ...HUG_BALL.head.face, eyeStyle: 'happy', mouthOpen: .3 } } };
/** Points traced on a reference in head half-widths from the head's middle, for a head of this size placed here. */
const traced = (at: V, scale: number) => { const k = .949 * scale; return { k, pt: (x: number, y: number): V => [at[0] + x * k, at[1] + y * k], pts: (list: V[]) => fromHead(at, k, list) }; };
const CU = traced([.43, -1.1], 1.14);
export const CURL: PoseSprite = {
  id: 'curl', body: { c: CU.pt(-.6, -.1), a: 1.25 * CU.k, b: 1 * CU.k },
  outline: CU.pts([[.46, -.94], [-.07, -1.17], [-.72, -1.2], [-1.38, -1], [-1.71, -.51], [-1.81, .01], [-1.64, .54], [-1.25, .87], [-.72, .97], [-.07, .95], [.59, .77], [.3, 0]]),
  lines: [CU.pts([[-.82, .92], [-.74, .7], [-.54, .66], [-.44, .86]])],
  socks: [{ c: CU.pt(-.62, .84), a: .2 * CU.k, b: .12 * CU.k }],
  head: { at: CU.pt(0, 0), rot: .15, scale: 1.14, turn: .15, flat: .3, face: { ...ASLEEP, mouth: 'w', blush: .3 } },
  tail: CU.pts([[-1.5, -.35], [-1.55, .22], [-1.27, .62], [-.88, .72], [-.64, .66]]), tailFront: true,
};
/**
 * A loaf, traced on the reference style 033: seen three-quarters on. The head at the front, turned a
 * little; the bun of the body under it and bulging out behind to one side, a soft haunch line there; no paws; only the tail's tip peeping
 * out at the back.
 */
const LO = traced([.24, -1.5], 1.12);
export const LOAF: PoseSprite = {
  id: 'loaf', body: { c: LO.pt(-.35, .6), a: 1.15 * LO.k, b: .8 * LO.k },
  outline: LO.pts([[-1, -.15], [-1.3, .09], [-1.45, .52], [-1.36, .94], [-1.06, 1.24], [-.52, 1.38], [.09, 1.35], [.55, 1.12], [.7, .7], [.5, .2], [0, -.3], [-.6, -.3]]),
  lines: [LO.pts([[-1.02, .25], [-1.18, .62], [-1.04, 1]])],
  head: { at: LO.pt(0, 0), rot: -.03, scale: 1.12, turn: .4, face: { eyeStyle: 'sleepy', eyes: .6 } },
  tail: LO.pts([[-.9, .9], [-1.15, 1.02], [-1.38, 1.1], [-1.58, 1.02]]),
};
export const LOAF_SLEEP: PoseSprite = { ...LOAF, id: 'loafSleep', head: { ...LOAF.head, rot: .05, flat: .15, face: ASLEEP } };
/**
 * Lying with a ball of yarn, traced on the reference style 005. Facing us, the
 * head up; the body low and wide under it; one foreleg stretched out along the floor to the side, the other paw on the yarn that lies
 * under the chin; the thick tail curled round the far side to the front.
 */
const YN = traced([0, -1.3], 1.12);
const YN_OUT: V[] = [[1, .21], [1.1, .59], [1.26, .77], [1.42, .86], [1.41, 1.11], [1.1, 1.24], [.52, 1.25], [0, 1.25], [-.39, 1.21], [-.77, 1.08], [-.97, .72], [-.94, .34],
  [-.5, 0], [0, -.3], [.5, 0]];
export const YARN: PoseSprite = {
  id: 'yarn', body: { c: YN.pt(.1, .75), a: 1.15 * YN.k, b: .5 * YN.k },
  outline: YN.pts(YN_OUT),
  lines: [YN.pts([[.45, .62], [.8, .72], [1.2, .8]]), YN.pts([[-.32, 1.2], [-.3, .98], [-.14, .9]])],
  socks: [{ c: YN.pt(1.3, .98), a: .2 * YN.k, b: .16 * YN.k }],
  head: { at: YN.pt(0, 0), rot: .05, scale: 1.12, turn: 0, face: { eyeStyle: 'wide', lookY: .6 } },
  prop: { at: YN.pt(.03, .94), r: .27 * YN.k },
  tail: YN.pts([[-.8, .62], [-1.18, .36], [-1.4, .52], [-1.32, .9], [-1.02, 1.1], [-.6, 1.12]]),
};
/** The stretched paw lifts to bat the yarn. */
export const YARN_BAT: PoseSprite = { ...YARN, id: 'yarnBat', outline: YN.pts(YN_OUT.map(([x, y], i) => (i >= 2 && i <= 4 ? [x - .12, y - .2] : [x, y]) as V)),
  lines: [YN.pts([[.45, .6], [.75, .62], [1.08, .6]]), YARN.lines![1]], socks: [{ c: YN.pt(1.18, .78), a: .2 * YN.k, b: .16 * YN.k }],
  prop: { at: YN.pt(.1, .94), r: .27 * YN.k }, head: { ...YARN.head, face: { eyeStyle: 'wide', lookY: .6, mouth: 'open', mouthOpen: .2 } } };
/**
 * Lying down with the head up and a foreleg out in front, traced on the reference style 034. The head
 * upright at the front, awake; the body long behind it, round at the rump; one foreleg stretched forward along the floor past the chin,
 * the other paw tucked by the cheek; the tail up from the rump. (the reference style's picture is cut off behind the shoulders; the hind end is ours.)
 */
const LG = traced([.92, -1.4], 1.12);
export const LOUNGE: PoseSprite = {
  id: 'lounge', body: { c: LG.pt(-1.2, .65), a: 1.45 * LG.k, b: .62 * LG.k, rot: -.08 },
  outline: LG.pts([[-1, -.11], [-1.29, -.08], [-1.6, .08], [-2.1, .3], [-2.5, .62], [-2.62, .98], [-2.38, 1.24], [-1.6, 1.3], [-.39, 1.29], [.43, 1.21], [.88, 1.02], [1, .87],
    [1.29, .8], [1.37, .66], [1.2, .53], [.88, .5], [.6, .3], [0, -.2]]),
  lines: [LG.pts([[1, .86], [.43, .85], [-.08, .75]]), LG.pts([[-1.1, .38], [-1.12, .58], [-.95, .66]]), LG.pts([[-1.9, .45], [-2.2, .85], [-2.1, 1.25]])],
  belly: { c: LG.pt(-1.1, 1.08), a: 1.2 * LG.k, b: .2 * LG.k },
  socks: [{ c: LG.pt(1.25, .67), a: .16 * LG.k, b: .14 * LG.k }],
  head: { at: LG.pt(0, 0), scale: 1.12, turn: .1, face: { eyeStyle: 'open', mouth: 'w' } },
  tail: LG.pts([[-2.3, .75], [-2.8, .6], [-3.08, .3], [-3, -.02]]),
};
/**
 * Asleep with its chin on its crossed forepaws, traced on the reference style 018. The head tipped, resting on the two forearms
 * that lie crossed under the chin (their lower edge a "U"); the body low behind and beside it; the tail curled up at the back.
 */
const CH = traced([-.17, -1.45], 1.12);
export const CHIN_SLEEP: PoseSprite = {
  id: 'chinSleep', body: { c: CH.pt(-.05, 1), a: 1.25 * CH.k, b: .45 * CH.k },
  outline: CH.pts([[-.84, .5], [-1.19, .81], [-1.28, 1.09], [-1.09, 1.28], [-.72, 1.33], [-.41, 1.41], [.22, 1.44], [.8, 1.4], [1.15, 1.2], [1.2, .9], [.72, .72], [.3, .2], [-.3, .2]]),
  lines: [CH.pts([[-.62, .78], [-.47, .97], [-.16, 1.05], [.16, .97], [.24, .76]])],
  socks: [{ c: CH.pt(-.14, .9), a: .36 * CH.k, b: .14 * CH.k }],
  head: { at: CH.pt(0, 0), rot: .2, scale: 1.12, turn: 0, flat: .2, face: { ...ASLEEP, mouth: 'smile', blush: .35 } },
  tail: CH.pts([[.85, 1.15], [1.3, 1.02], [1.56, .8], [1.6, .5]]),
};
const SD = traced([1.16, -1.2], 1.12);
export const SIDE: PoseSprite = {
  id: 'side', body: { c: SD.pt(-1.75, .1), a: 1.5 * SD.k, b: .62 * SD.k, rot: .08 },
  outline: SD.pts([[-.74, -.63], [-1.5, -.59], [-2.23, -.36], [-2.68, -.12], [-3.04, 0], [-3.2, .15], [-3.04, .3], [-2.59, .39], [-1.95, .6], [-1.23, .81], [-.74, .87],
    [-.4, .84], [-.2, .62], [.4, .6], [.7, .72], [.95, .7], [1.02, .55], [.8, .42], [.3, 0], [-.3, -.4]]),
  lines: [SD.pts([[-1.91, -.23], [-2.09, 0], [-2.59, .12]]), SD.pts([[-1.05, .15], [-.8, .45], [-.45, .6]])],
  belly: { c: SD.pt(-1.6, .52), a: 1.15 * SD.k, b: .2 * SD.k, rot: .24 },
  socks: [{ c: SD.pt(-3.05, .15), a: .22 * SD.k, b: .17 * SD.k }, { c: SD.pt(.8, .6), a: .24 * SD.k, b: .16 * SD.k }, { c: SD.pt(-.3, .76), a: .22 * SD.k, b: .13 * SD.k }],
  head: { at: SD.pt(0, 0), rot: -.04, scale: 1.12, turn: .1, flat: .25, face: { ...ASLEEP, mouth: 'w', blush: .3 } },
  tail: SD.pts([[-2.2, 0], [-2.6, -.4], [-2.95, -.72], [-2.98, -1.05]]),
};
/**
 * Asleep on its belly facing us, traced on the reference style 057. The
 * head at the front with its chin down on the two forepaws that peep out under it; the body behind it, low and round; the tail lying
 * round the near side along the floor, inside the body's outline.
 */
const PR = traced([.5, -1.2], 1.14);
export const PRONE_SLEEP: PoseSprite = {
  id: 'proneSleep', body: { c: PR.pt(-.9, .15), a: 1.1 * PR.k, b: .8 * PR.k },
  outline: PR.pts([[-.74, -.67], [-1.2, -.7], [-1.59, -.51], [-1.89, -.14], [-1.99, .32], [-1.72, .68], [-1.2, .84], [-.6, .97], [-.34, 1.02], [-.1, .98], [0, .9], [.1, .98],
    [.34, 1.02], [.75, .88], [.95, .5], [.5, 0], [0, -.4]]),
  lines: [PR.pts([[-1.3, -.55], [-1.6, -.1], [-1.55, .45]])],
  socks: [{ c: PR.pt(-.34, .97), a: .24 * PR.k, b: .1 * PR.k }, { c: PR.pt(.34, .97), a: .24 * PR.k, b: .1 * PR.k }],
  head: { at: PR.pt(0, 0), rot: .05, scale: 1.14, turn: 0, flat: .45, face: { eyeStyle: 'closed', mouth: 'w', blush: .35, ears: .2 } },
  tail: PR.pts([[-1.7, -.15], [-1.9, .35], [-1.62, .66], [-1.2, .7], [-.98, .58]]), tailFront: true,
};
/** Lying on its side, awake (the roll passes through it). */
export const SIDE_AWAKE: PoseSprite = { ...SIDE, id: 'sideAwake', head: { ...SIDE.head, flat: 0, face: { eyeStyle: 'open', mouth: 'w', blush: .3 } } };
export const POSE_SPRITES = { PRONE_SLEEP, LOUNGE, CHIN_SLEEP, BELLY_UP, BELLY_KICK, BELLY_SLEEP, TICKLE, TICKLE_B, HUG_BALL, HUG_KICK, CURL, LOAF, LOAF_SLEEP, YARN, YARN_BAT, SIDE };
