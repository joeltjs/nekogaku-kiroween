/**
 * the body mould ("cetakan") of every pose.
 *
 * the reference style draws each pose as one picture: head, body, legs and the root of the tail share ONE outer line, the joins round off as
 * if drawn in one stroke, and the few lines inside are thinner than the outline. Our rig builds a cat from parts (spine-swept body, head,
 * capsule legs, a stroked tail), so it showed where the parts met: a thick chin line, a line across the tail root, a notch where a leg
 * left the belly, a thick ring round each arm. This module turns those parts into one shape:
 *
 *   1. every part is a closed polygon in the cat's own drawing space (pure geometry, no canvas, so tests can measure it in node);
 *   2. where two parts that belong together cross (neck, shoulders, hips, tail root, ankles), the corner between them is filled with a
 *      fillet: a curve tangent to both outlines, so the join is round like a hand-drawn line and never a V notch;
 *   3. the union of parts + fillets is THE silhouette: inked once (stroke, then fill: only the outer half of the line stays), then the
 *      parts are painted in order, patterns clipped to them, and only thin inner lines (INNER_LINE) mark a part lying over another.
 *
 * The shape still comes from the pose and the physique, so age, weight and mood keep reshaping it (head, belly, legs, ears). Moulds are
 * cached by a key of everything that changes their shape (`moldCache`), so a held pose costs nothing after its first frame; A14's
 * frame-by-frame poses (an index into a list of poses) hit the same cache.
 */
import { INK } from './cat-look';

export type P = { x: number; y: number };
export type Poly = P[];
/** A canvas transform [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f. */
export type Mat = readonly [number, number, number, number, number, number];

/** Width of the lines inside the silhouette (the silhouette's own ink shows OUTLINE = 2 of its 4 stroke). */
export const INNER_LINE = 1.2;

// ———————————————————————————————————————— transforms

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];
/** `m` then `n` applied inside it, as ctx.transform(n) after ctx.setTransform(m). */
export const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
export const rotate = (a: number): Mat => { const c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
export const scale = (sx: number, sy = sx): Mat => [sx, 0, 0, sy, 0, 0];
export const chain = (...ms: Mat[]): Mat => ms.reduce(mul, IDENTITY);
export const apply = (m: Mat, p: P): P => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
export const transformPoly = (poly: Poly, m: Mat): Poly => poly.map(p => apply(m, p));

// ———————————————————————————————————————— a pen that records polygons (the subset of Path2D the rig uses)

/** Draws like a Path2D but keeps closed polygons: curves are sampled finely enough to look round at 4× zoom. */
export class PolyPen {
  polys: Poly[] = [];
  private cur: Poly | null = null;
  private last: P = { x: 0, y: 0 };
  moveTo(x: number, y: number) { this.flush(); this.cur = [{ x, y }]; this.last = { x, y }; }
  lineTo(x: number, y: number) { if (!this.cur) this.cur = [this.last]; this.cur.push({ x, y }); this.last = { x, y }; }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number, n = 5) {
    const a = this.last;
    for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; this.lineTo(u * u * a.x + 2 * u * t * cx + t * t * x, u * u * a.y + 2 * u * t * cy + t * t * y); }
  }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number, n = 9) {
    const a = this.last;
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      this.lineTo(u * u * u * a.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x, u * u * u * a.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y);
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw = false) {
    let span = a1 - a0;
    if (!ccw && span < 0) span += Math.PI * 2 * Math.ceil(-span / (Math.PI * 2));
    if (ccw && span > 0) span -= Math.PI * 2 * Math.ceil(span / (Math.PI * 2));
    if (Math.abs(span) > Math.PI * 2) span = Math.sign(span) * Math.PI * 2;
    const n = Math.max(3, Math.ceil(Math.abs(span) / (Math.PI / 14) * Math.min(1.6, Math.max(.6, Math.max(rx, ry) / 8)))), c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i <= n; i++) {
      const a = a0 + span * i / n, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      this.lineTo(cx + x * c - y * s, cy + x * s + y * c);
    }
  }
  arc(cx: number, cy: number, r: number, a0: number, a1: number, ccw = false) { this.ellipse(cx, cy, r, r, 0, a0, a1, ccw); }
  closePath() { this.flush(); }
  private flush() { if (this.cur && this.cur.length > 2) this.polys.push(this.cur); this.cur = null; }
  done(): Poly[] { this.flush(); return this.polys; }
}

export function ellipsePoly(cx: number, cy: number, rx: number, ry: number, rot = 0): Poly {
  const pen = new PolyPen(); pen.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot)); pen.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); return pen.done()[0];
}

/** A tapered capsule (round ends r1, r2 joined by their common tangents), as the rig's capsule. */
export function capsulePoly(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): Poly {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), pen = new PolyPen();
  if (d <= Math.abs(r1 - r2) + .01) { const [x, y, r] = r1 >= r2 ? [x1, y1, r1] : [x2, y2, r2]; return ellipsePoly(x, y, r, r); }
  const a = Math.atan2(dy, dx), b = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / d)));
  pen.moveTo(x1 + r1 * Math.cos(a + b), y1 + r1 * Math.sin(a + b));
  pen.arc(x1, y1, r1, a + b, a - b + Math.PI * 2);
  pen.lineTo(x2 + r2 * Math.cos(a - b), y2 + r2 * Math.sin(a - b));
  pen.arc(x2, y2, r2, a - b, a + b);
  return pen.done()[0];
}

/** The outline of a thick round-capped line through `pts` (a tail): left side out, a round cap, right side back, a round cap. */
export function strokePoly(pts: P[], width: number): Poly {
  const r = width / 2, n = pts.length, left: P[] = [], right: P[] = [];
  if (n < 2) return ellipsePoly(pts[0].x, pts[0].y, r, r);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d;
    left.push({ x: pts[i].x + nx * r, y: pts[i].y + ny * r }); right.push({ x: pts[i].x - nx * r, y: pts[i].y - ny * r });
  }
  const out: Poly = [...left], end = pts[n - 1], start = pts[0];
  const ae = Math.atan2(left[n - 1].y - end.y, left[n - 1].x - end.x), as = Math.atan2(right[0].y - start.y, right[0].x - start.x);
  for (let k = 1; k < 8; k++) { const a = ae - Math.PI * k / 8; out.push({ x: end.x + Math.cos(a) * r, y: end.y + Math.sin(a) * r }); }
  for (let i = n - 1; i >= 0; i--) out.push(right[i]);
  for (let k = 1; k < 8; k++) { const a = as - Math.PI * k / 8; out.push({ x: start.x + Math.cos(a) * r, y: start.y + Math.sin(a) * r }); }
  return out;
}

// ———————————————————————————————————————— polygon helpers

export function area(poly: Poly) { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a.x * b.y - b.x * a.y; } return s / 2; }
/** Same winding for every piece of one silhouette, so overlapping pieces never cancel out under the non-zero rule. */
export const oriented = (poly: Poly) => (area(poly) < 0 ? [...poly].reverse() : poly);

export function inside(poly: Poly, p: P) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

export interface Box { x0: number; y0: number; x1: number; y1: number }
export function boxOf(polys: Poly[]): Box {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const poly of polys) for (const p of poly) { if (p.x < b.x0) b.x0 = p.x; if (p.y < b.y0) b.y0 = p.y; if (p.x > b.x1) b.x1 = p.x; if (p.y > b.y1) b.y1 = p.y; }
  return b;
}
/** A polygon's box, worked out once per polygon (moulds are cached and reused for many frames). */
const BOXES = new WeakMap<Poly, Box>();
export const polyBox = (poly: Poly) => { let b = BOXES.get(poly); if (!b) { b = boxOf([poly]); BOXES.set(poly, b); } return b; };
const overlaps = (a: Box, b: Box, pad = 0) => a.x0 - pad <= b.x1 && b.x0 - pad <= a.x1 && a.y0 - pad <= b.y1 && b.y0 - pad <= a.y1;

/** Builds one Path2D from polygons, all wound the same way. */
export function pathOf(polys: Poly[]): Path2D {
  const path = new Path2D();
  for (const raw of polys) {
    const poly = oriented(raw);
    path.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) path.lineTo(poly[i].x, poly[i].y);
    path.closePath();
  }
  return path;
}

// ———————————————————————————————————————— the mould

export interface MoldPart {
  id: string;
  /** Parts of one group are painted together (the head and its ears, a leg and its paw). */
  group: string;
  poly: Poly;
}
/** A join to round off where parts `a` and `b` cross; `r` is about how far the curve reaches along each outline. */
export interface MoldJoin { a: string; b: string; r: number; owner?: string }
/** A round join (or a closed hole) of the silhouette: who paints it, its shape, where it is, and the two parts it joins (none for a hole). */
export interface Fillet { owner: string; poly: Poly; at: P; join?: readonly [string, string] }

interface Hit { p: P; ia: number; ta: number; ib: number; tb: number }
function crossings(A: Poly, B: Poly): Hit[] {
  const hits: Hit[] = [], bb = polyBox(B), ba = polyBox(A);
  for (let i = 0; i < A.length; i++) {
    const a = A[i], b = A[(i + 1) % A.length];
    if (Math.max(a.x, b.x) < bb.x0 || Math.min(a.x, b.x) > bb.x1 || Math.max(a.y, b.y) < bb.y0 || Math.min(a.y, b.y) > bb.y1) continue;
    for (let j = 0; j < B.length; j++) {
      const c = B[j], d = B[(j + 1) % B.length];
      if (Math.max(c.x, d.x) < ba.x0 || Math.min(c.x, d.x) > ba.x1 || Math.max(c.y, d.y) < ba.y0 || Math.min(c.y, d.y) > ba.y1) continue;
      const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y, den = rx * sy - ry * sx;
      if (Math.abs(den) < 1e-9) continue;
      const qx = c.x - a.x, qy = c.y - a.y, t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
      if (t >= 0 && t < 1 && u >= 0 && u < 1) hits.push({ p: { x: a.x + rx * t, y: a.y + ry * t }, ia: i, ta: t, ib: j, tb: u });
    }
  }
  return hits;
}

/** Cumulative arc length at each vertex, and the total. */
function perimeter(poly: Poly) {
  const cum = [0];
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; cum.push(cum[i] + Math.hypot(b.x - a.x, b.y - a.y)); }
  return cum;
}
/** Walks `dist` along the outline from edge i at t, forward (dir 1) or back (-1): the points passed, and the heading at the end. */
function walk(poly: Poly, i: number, t: number, dir: 1 | -1, dist: number) {
  const n = poly.length, a = poly[i], b = poly[(i + 1) % n];
  let cur: P = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, j = dir > 0 ? (i + 1) % n : i, left = dist;
  const pts: P[] = [cur];
  let head = { x: dir > 0 ? b.x - a.x : a.x - b.x, y: dir > 0 ? b.y - a.y : a.y - b.y };
  for (let k = 0; k < n && left > 1e-6; k++) {
    const v = poly[j], dx = v.x - cur.x, dy = v.y - cur.y, d = Math.hypot(dx, dy);
    if (d > 1e-9) head = { x: dx, y: dy };
    if (d >= left) { cur = { x: cur.x + dx * left / d, y: cur.y + dy * left / d }; pts.push(cur); left = 0; break; }
    left -= d; cur = v; pts.push(v); j = dir > 0 ? (j + 1) % n : (j - 1 + n) % n;
  }
  const hl = Math.hypot(head.x, head.y) || 1;
  return { pts, tan: { x: head.x / hl, y: head.y / hl } };
}

/**
 * The fillet in the outside corner at one crossing of A's and B's outlines: from the crossing along A (leaving B) and along B (leaving A)
 * for up to `r`, closed by a quadratic tangent to both outlines there. Filled, it turns the V where two parts meet into a soft curve.
 */
function filletAt(A: Poly, B: Poly, h: Hit, r: number, capA: number, capB: number): Poly | null {
  const eps = .4;
  const probe = (poly: Poly, i: number, t: number, dir: 1 | -1) => walk(poly, i, t, dir, eps).pts.at(-1)!;
  const aOut = !inside(B, probe(A, h.ia, h.ta, 1)), aBack = !inside(B, probe(A, h.ia, h.ta, -1));
  const bOut = !inside(A, probe(B, h.ib, h.tb, 1)), bBack = !inside(A, probe(B, h.ib, h.tb, -1));
  if (aOut === aBack || bOut === bBack) return null; // a graze, not a corner
  const wa = walk(A, h.ia, h.ta, aOut ? 1 : -1, Math.min(r, capA)), wb = walk(B, h.ib, h.tb, bOut ? 1 : -1, Math.min(r, capB));
  const pa = wa.pts.at(-1)!, pb = wb.pts.at(-1)!;
  if (Math.hypot(pa.x - h.p.x, pa.y - h.p.y) < .3 || Math.hypot(pb.x - h.p.x, pb.y - h.p.y) < .3) return null;
  // The control point: where the outlines' tangents at the two ends meet (the corner itself when they are straight).
  let ctrl = h.p;
  const den = wa.tan.x * wb.tan.y - wa.tan.y * wb.tan.x;
  if (Math.abs(den) > .05) {
    const qx = pb.x - pa.x, qy = pb.y - pa.y, s = (qx * wb.tan.y - qy * wb.tan.x) / den, q = { x: pa.x + wa.tan.x * s, y: pa.y + wa.tan.y * s };
    if (s < 0 && Math.hypot(q.x - h.p.x, q.y - h.p.y) < r * 1.2) ctrl = q;
  }
  const shape = (c: P) => {
    const out: Poly = [...wa.pts];
    for (let k = 1; k < 7; k++) { const t = k / 7, u = 1 - t; out.push({ x: u * u * pa.x + 2 * u * t * c.x + t * t * pb.x, y: u * u * pa.y + 2 * u * t * c.y + t * t * pb.y }); }
    for (let k = wb.pts.length - 1; k > 0; k--) out.push(wb.pts[k]);
    return out;
  };
  // A fillet must be a simple loop: one that crosses itself is wound both ways, and its backward lobe would cancel the part under it
  // (a speck of a hole in the fill). Then the curve takes the corner itself as its control, and failing that it is left out.
  for (const c of ctrl === h.p ? [ctrl] : [ctrl, h.p]) { const out = shape(c); if (simple(out)) return out; }
  return null;
}
/** Whether a small polygon has no two edges crossing (adjacent edges excepted). */
function simple(poly: Poly) {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = poly[j], d = poly[(j + 1) % n], rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y, den = rx * sy - ry * sx;
      if (Math.abs(den) < 1e-12) continue;
      const qx = c.x - a.x, qy = c.y - a.y, t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
      if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6) return false;
    }
  }
  return true;
}

export class Mold {
  private paths = new Map<string, Path2D>();
  private ctor: unknown = null;
  /**
   * `base`: a cached mould this one adds a few parts to: its parts and fillets are listed here too,
   * and its Path2Ds are reused, so a frame only builds the new pieces.
   */
  constructor(readonly parts: MoldPart[], readonly fillets: Fillet[], private readonly base: Mold | null = null, private readonly own = 0, private readonly ownFillets = 0) {}
  has(group: string) { return this.parts.some(p => p.group === group); }
  /** The polygons of these groups (all when omitted), with the fillets they own unless `fillets` is false. */
  polys(groups?: readonly string[], fillets = true): Poly[] {
    const want = (g: string) => !groups || groups.includes(g);
    return [...this.parts.filter(p => want(p.group)).map(p => p.poly), ...(fillets ? this.fillets.filter(f => want(f.owner)).map(f => f.poly) : [])];
  }
  /** The same as a Path2D (cached on the mould; rebuilt if the Path2D class changed, as it does between node tests). */
  path(groups?: readonly string[], fillets = true): Path2D {
    if (this.ctor !== globalThis.Path2D) { this.paths.clear(); this.ctor = globalThis.Path2D; }
    const key = `${groups ? groups.join(',') : '*'}|${fillets ? 1 : 0}`;
    let p = this.paths.get(key);
    if (!p) {
      if (this.base) {
        // The base's path as it is, plus this frame's own pieces.
        const want = (g: string) => !groups || groups.includes(g);
        const extra = [...this.parts.slice(this.parts.length - this.own).filter(q => want(q.group)).map(q => q.poly), ...(fillets ? this.fillets.slice(this.fillets.length - this.ownFillets).filter(f => want(f.owner)).map(f => f.poly) : [])];
        const b = this.base.path(groups, fillets);
        if (!extra.length) p = b; else { p = pathOf(extra); p.addPath(b); }
      } else p = pathOf(this.polys(groups, fillets));
      this.paths.set(key, p);
    }
    return p;
  }
  /** The whole silhouette: every part and every fillet. */
  get silhouette() { return this.path(); }
  part(id: string) { return this.parts.find(p => p.id === id); }
}

/** The fillets of the listed joins among `parts` (crossings hidden inside a third part of `all` are left alone: they never show). */
function joinFillets(parts: readonly MoldPart[], all: readonly MoldPart[], joins: readonly MoldJoin[]): Fillet[] {
  const fillets: Fillet[] = [], byId = new Map(parts.map(p => [p.id, p]));
  for (const j of joins) {
    const A = byId.get(j.a), B = byId.get(j.b);
    if (!A || !B || j.r <= 0 || !overlaps(polyBox(A.poly), polyBox(B.poly))) continue;
    const hits = crossings(A.poly, B.poly);
    if (!hits.length) continue;
    // How far a fillet may run along an outline: less than half way to the next crossing on it.
    const cumA = perimeter(A.poly), cumB = perimeter(B.poly), LA = cumA[A.poly.length], LB = cumB[B.poly.length];
    const posA = hits.map(h => cumA[h.ia] + (cumA[h.ia + 1] - cumA[h.ia]) * h.ta), posB = hits.map(h => cumB[h.ib] + (cumB[h.ib + 1] - cumB[h.ib]) * h.tb);
    const gap = (pos: number[], k: number, L: number) => { let g = L; for (let m = 0; m < pos.length; m++) if (m !== k) { const d = Math.abs(pos[m] - pos[k]); g = Math.min(g, d, L - d); } return g; };
    hits.forEach((h, k) => {
      for (const other of all) if (other !== A && other !== B) { const b = polyBox(other.poly); if (h.p.x >= b.x0 && h.p.x <= b.x1 && h.p.y >= b.y0 && h.p.y <= b.y1 && inside(other.poly, h.p)) return; }
      // A tight corner (a fat tail on a round rump) may not take the full curve without crossing itself: then a smaller one.
      const poly = filletAt(A.poly, B.poly, h, j.r, gap(posA, k, LA) * .45, gap(posB, k, LB) * .45) ?? filletAt(A.poly, B.poly, h, j.r * .5, gap(posA, k, LA) * .3, gap(posB, k, LB) * .3) ?? filletAt(A.poly, B.poly, h, j.r * .25, gap(posA, k, LA) * .2, gap(posB, k, LB) * .2);
      if (poly) fillets.push({ owner: j.owner ?? A.group, poly, at: h.p, join: [A.id, B.id] });
    });
  }
  return fillets;
}

/**
 * Puts the parts together and rounds off the listed joins. `closeHoles`: enclosed holes up to this area (units²) are filled (see
 * smallHoles), in the colour of the part most of their rim belongs to (the body first).
 */
export function buildMold(parts: MoldPart[], joins: readonly MoldJoin[], closeHoles = 0): Mold {
  const fillets = joinFillets(parts, parts, joins);
  if (closeHoles > 0) fillets.push(...holePatches(parts, fillets, closeHoles));
  return new Mold(parts, fillets);
}
function holePatches(parts: readonly MoldPart[], fillets: readonly Fillet[], maxArea: number): Fillet[] {
  return smallHoles([...parts.map(p => p.poly), ...fillets.map(f => f.poly)], maxArea).map(h => {
    const votes = new Map<string, number>();
    for (const q of h.poly) for (const part of parts) if (inside(part.poly, q)) { votes.set(part.group, (votes.get(part.group) ?? 0) + (part.group === 'body' ? 1.5 : 1)); break; }
    return { owner: [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? parts[0].group, poly: h.poly, at: h.at };
  });
}

/** A cached mould plus this frame's moving pieces (the tail) and their joins to it: only the new crossings are worked out. */
export function extendMold(base: Mold, parts: MoldPart[], joins: readonly MoldJoin[], closeHoles = 0): Mold {
  if (!parts.length) return base;
  const all = [...base.parts, ...parts], fillets = joinFillets(all, all, joins.filter(j => parts.some(p => p.id === j.a || p.id === j.b)));
  // The holes the new pieces close with the rest (between a cheek and a raised paw, under the chin): the new pieces only change now and then.
  if (closeHoles > 0) fillets.push(...holePatches(all, [...base.fillets, ...fillets], closeHoles).filter(h => !base.fillets.some(f => Math.hypot(f.at.x - h.at.x, f.at.y - h.at.y) < .5)));
  return new Mold(all, [...base.fillets, ...fillets], base, parts.length, fillets.length);
}

// ———————————————————————————————————————— cache

const CACHE = new Map<string, { m: Mold; holes: boolean; seen: number }>();
const CACHE_MAX = 480;
/** `extra`: shapes drawn with the silhouette but not moulded (the swaying tail beyond its root), for measuring. */
export const moldTap: { on: ((m: Mold, kind: string, extra: Poly[]) => void) | null } = { on: null };
export const tapMold = (m: Mold, kind: string, extra?: () => Poly[]) => { const on = moldTap.on; if (on) on(m, kind, extra ? extra() : []); return m; };
/** How many moulds were built and how long it took (QA: scripts/qa/mold-strip.mjs BENCH). */
export const moldStats = { builds: 0, hits: 0, ms: 0, key: '' };
/**
 * `holes`: close small holes on the first build (tests). Otherwise a pose gets them closed when it is drawn a third time: a held pose
 * (sitting, asleep, breathing) is checked; a walking frame that passes by skips that half of the work, and a sliver showing for a frame
 * or two in motion is never seen.
 */
export const moldOptions = { holesFirst: false };
/** A mould per key (pose + physique + shape genes): built once, kept for the next frames while the pose holds. */
export function moldCache(key: string, build: (closeHoles: boolean) => Mold): Mold {
  moldStats.key = key;
  const hit = CACHE.get(key);
  if (hit) {
    moldStats.hits++; CACHE.delete(key); hit.seen++;
    if (!hit.holes && hit.seen >= 3) { const t0 = performance.now(); hit.m = build(true); hit.holes = true; moldStats.builds++; moldStats.ms += performance.now() - t0; }
    CACHE.set(key, hit); return hit.m;
  }
  const t0 = performance.now(), holes = moldOptions.holesFirst, m = build(holes);
  moldStats.builds++; moldStats.ms += performance.now() - t0;
  CACHE.set(key, { m, holes, seen: 1 });
  if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value as string);
  return m;
}
export const moldCacheSize = () => CACHE.size;
/**
 * The moving pieces on top of a cached base (head, tail), cached too: between a glance or a flick they hold still, and then a frame costs
 * only its key. `build` runs on a miss only.
 */
const EXT = new Map<string, { m: Mold; holes: boolean; seen: number }>();
export function extendCache(key: string, build: (closeHoles: boolean) => Mold): Mold {
  const hit = EXT.get(key);
  if (hit) {
    EXT.delete(key); EXT.set(key, hit); moldStats.hits++; hit.seen++;
    // Holes it closes with the cached part are worked out once the head holds still (the third frame), as for the base.
    if (!hit.holes && hit.seen >= 3) { const t0 = performance.now(); hit.m = build(true); hit.holes = true; moldStats.builds++; moldStats.ms += performance.now() - t0; }
    return hit.m;
  }
  const t0 = performance.now(), holes = moldOptions.holesFirst, m = build(holes);
  moldStats.builds++; moldStats.ms += performance.now() - t0;
  EXT.set(key, { m, holes, seen: 1 });
  if (EXT.size > CACHE_MAX) EXT.delete(EXT.keys().next().value as string);
  return m;
}
/**
 * A cache key from lengths (rounded to 0.5 units, about half a pixel in the house) and angles or ratios (to 1/30). Breathing and the walk
 * cycle repeat, so their moulds come back from the cache (the outline steps through a few drawn shapes, as the reference style's frames do); it is at most
 * 0.25 units off the live pose, far below the width of the ink.
 */
export const moldKey = (units: readonly number[], ratios: readonly number[]) => `${units.map(v => Math.round(v * 2)).join(',')}/${ratios.map(v => Math.round(v * 30)).join(',')}`;

// ———————————————————————————————————————— painting

export const innerInk = (_coat: string) => INK;

/** Inks the silhouette once: the stroke goes down first, the fill covers its inner half and every line between parts. */
/**
 * `under`: more ink laid down with the silhouette's, before its fill (the moving tail: its own outline joins the silhouette's without a
 * line across the root, the same trick, without rebuilding the mould every frame it sways).
 */
export function inkSilhouette(ctx: CanvasRenderingContext2D, mold: Mold, fill: string, width: number, under?: () => void) {
  const s = mold.silhouette;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = width; ctx.stroke(s);
  under?.();
  ctx.fillStyle = fill; ctx.fill(s);
}

/**
 * The inner line of a part lying over another, drawn the silhouette's way: stroked at twice its width where it lies over `over`, BEFORE
 * the part is filled. The fill then covers the inner half and every edge between the part's own pieces, so only a thin line along the
 * part's outside shows, and only over what is behind it.
 */
export function underline(ctx: CanvasRenderingContext2D, edge: Path2D, over: Path2D | null, color: string, width = INNER_LINE) {
  ctx.save(); if (over) ctx.clip(over); ctx.strokeStyle = color; ctx.lineWidth = width * 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(edge); ctx.restore();
}

// ———————————————————————————————————————— measuring (tests, QA)

export interface Mask { w: number; h: number; x0: number; y0: number; cell: number; data: Uint8Array }
/** The silhouette as a grid of filled cells (scanline, the non-zero rule like canvas fill, union across polygons). */
export function rasterize(polys: Poly[], cell = .75, box?: Box): Mask {
  const b = box ?? boxOf(polys), x0 = b.x0 - cell * 2, y0 = b.y0 - cell * 2, w = Math.ceil((b.x1 - x0) / cell) + 3, h = Math.ceil((b.y1 - y0) / cell) + 3, data = new Uint8Array(w * h);
  // Edge by edge into row buckets (x, direction), every polygon wound the same way, then each row's spans by the non-zero rule: the
  // union of all the pieces in one pass, and the cost grows with the outline, not the area.
  const xs: number[][] = Array.from({ length: h }, () => []), ds: number[][] = Array.from({ length: h }, () => []);
  for (const poly of polys) {
    const flip = area(poly) < 0 ? -1 : 1;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], c = poly[j];
      if (a.y === c.y) continue;
      const lo = a.y < c.y ? a : c, hi = a.y < c.y ? c : a, d = (a.y > c.y ? 1 : -1) * flip;
      const r0 = Math.max(0, Math.ceil((lo.y - y0) / cell - .5)), r1 = Math.min(h - 1, Math.ceil((hi.y - y0) / cell - .5) - 1), k = (hi.x - lo.x) / (hi.y - lo.y);
      for (let r = r0; r <= r1; r++) {
        const x = lo.x + (y0 + (r + .5) * cell - lo.y) * k, X = xs[r], D = ds[r];
        // Insertion keeps the row sorted (a row crosses only a few edges).
        let n = X.length; X.push(x); D.push(d);
        while (n > 0 && X[n - 1] > x) { X[n] = X[n - 1]; D[n] = D[n - 1]; n--; }
        X[n] = x; D[n] = d;
      }
    }
  }
  for (let r = 0; r < h; r++) {
    const X = xs[r], D = ds[r];
    let wind = 0;
    for (let k = 0; k + 1 < X.length; k++) {
      wind += D[k];
      if (!wind) continue;
      const c0 = Math.max(0, Math.ceil((X[k] - x0) / cell - .5)), c1 = Math.min(w - 1, Math.floor((X[k + 1] - x0) / cell - .5));
      for (let c = c0; c <= c1; c++) data[r * w + c] = 1;
    }
  }
  return { w, h, x0, y0, cell, data };
}

/**
 * The small enclosed holes of a silhouette (a sliver between two legs, the eye between a tail and a head, between thighs): each one is
 * ringed by the silhouette's ink and would show as a black speck or slot. Returns a patch polygon for each hole
 * under `maxArea` (drawing units²), a little larger than the hole so it overlaps the parts around it. Big holes (a tail looped round,
 * arms held in a ring) stay open, as the reference style draws them.
 */
export function smallHoles(polys: Poly[], maxArea: number, cell = 1, reach = 1.6): { poly: Poly; at: P }[] {
  const m = rasterize(polys, cell), W = m.w, H = m.h, N = W * H, r = Math.max(0, Math.round(reach / cell));
  // A gap narrower than the ink on both sides reads as a closed black slot: the solid is grown by `reach` first (a running max along
  // the rows, then the columns), so a pocket with a hair-thin mouth counts as the hole it looks like.
  const grown = new Uint8Array(N), data = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    let run = 0;
    for (let x = -r; x < W; x++) {
      if (x + r < W && m.data[y * W + x + r]) run++;
      if (x - r - 1 >= 0 && m.data[y * W + x - r - 1]) run--;
      if (x >= 0) grown[y * W + x] = run > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < W; x++) {
    let run = 0;
    for (let y = -r; y < H; y++) {
      if (y + r < H && grown[(y + r) * W + x]) run++;
      if (y - r - 1 >= 0 && grown[(y - r - 1) * W + x]) run--;
      if (y >= 0) data[y * W + x] = run > 0 ? 1 : 0;
    }
  }
  // The outside: background reachable from the border through the grown solid's gaps.
  const outside = new Uint8Array(N), stack = new Int32Array(N);
  let top = 0;
  const spread = (mask: Uint8Array, seen: Uint8Array, keep: number[] | null) => {
    while (top) {
      const i = stack[--top], x = i % W; if (keep) keep.push(i);
      let j = i - 1; if (x > 0 && !seen[j] && !mask[j]) { seen[j] = 1; stack[top++] = j; }
      j = i + 1; if (x < W - 1 && !seen[j] && !mask[j]) { seen[j] = 1; stack[top++] = j; }
      j = i - W; if (j >= 0 && !seen[j] && !mask[j]) { seen[j] = 1; stack[top++] = j; }
      j = i + W; if (j < N && !seen[j] && !mask[j]) { seen[j] = 1; stack[top++] = j; }
    }
  };
  const seed = (i: number) => { if (!outside[i] && !data[i]) { outside[i] = 1; stack[top++] = i; } };
  for (let x = 0; x < W; x++) { seed(x); seed(N - W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  spread(data, outside, null);
  // Every empty cell of the true silhouette the outside does not reach is in a hole or a pocket with a mouth narrower than the ink.
  const inner = new Uint8Array(N); for (let i = 0; i < N; i++) inner[i] = m.data[i] || outside[i] ? 1 : 0;
  const out: { poly: Poly; at: P }[] = [];
  for (let i = 0; i < N; i++) {
    if (inner[i]) continue;
    const cells: number[] = []; inner[i] = 1; stack[top++] = i; spread(inner, inner, cells);
    if (cells.length * cell * cell > maxArea) continue;
    // The hole's cells, hulled and grown by a cell and a half (and out through a narrow mouth), so the patch reaches under the ink round it.
    const ring: P[] = [], g = (Math.min(r, 1) + 1.5) * cell; let cx = 0, cy = 0;
    for (const j of cells) {
      const x = m.x0 + (j % W + .5) * cell, y = m.y0 + (Math.floor(j / W) + .5) * cell; cx += x / cells.length; cy += y / cells.length;
      for (const [dx, dy] of CORNERS) ring.push({ x: x + dx * g, y: y + dy * g });
    }
    out.push({ poly: hull(ring), at: { x: cx, y: cy } });
  }
  return out;
}
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
function hull(pts: P[]): Poly {
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y), cross = (o: P, a: P, b: P) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: P[] = [], hi: P[] = [];
  for (const p of s) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of s.reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}

/** Connected pieces of the filled cells (4-neighbours), their sizes; and the holes (background not reaching the border). */
export function pieces(m: Mask) {
  const seen = new Uint8Array(m.w * m.h), solid: number[] = [], holes: number[] = [];
  const flood = (start: number, value: number) => {
    const stack = [start]; seen[start] = 1; let size = 0, border = false;
    while (stack.length) {
      const i = stack.pop()!, x = i % m.w, y = (i - x) / m.w; size++;
      if (x === 0 || y === 0 || x === m.w - 1 || y === m.h - 1) border = true;
      for (const j of [x > 0 ? i - 1 : -1, x < m.w - 1 ? i + 1 : -1, y > 0 ? i - m.w : -1, y < m.h - 1 ? i + m.w : -1]) if (j >= 0 && !seen[j] && m.data[j] === value) { seen[j] = 1; stack.push(j); }
    }
    return { size, border };
  };
  for (let i = 0; i < m.data.length; i++) if (!seen[i]) { const f = flood(i, m.data[i]); if (m.data[i]) solid.push(f.size); else if (!f.border) holes.push(f.size); }
  return { solid, holes };
}
