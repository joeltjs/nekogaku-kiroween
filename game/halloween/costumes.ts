/**
 * Halloween costumes (R7) as overlays on the rig. A cat only wears one after using a costume item
 * (game/halloween/items.ts); otherwise it looks like itself. Anchors come from catShapes() in world
 * space, so a costume follows every pose. `back` is drawn before the cat, `front` after it.
 *
 *   vampire:  black cape with red lining, high collar, two small fangs
 *   ghost:    a white sheet over head and body, the cat's own face in the opening, ears poking up
 *   werewolf: big shaggy wolf ears, shaggy cheek fur, a fur mane round the neck
 *   bat:      two flapping bat wings (the cat flies)
 *   witch:    a pointed witch hat with a buckle band, riding a broom (the cat flies)
 */
import type { CostumeId } from './items';
import { batWing, broomShape } from './items';

export interface Anchors {
  head: { x: number; y: number; r: number };
  neck: { x: number; y: number };
  body: { x: number; y: number; rx: number; ry: number };
  mouth: { x: number; y: number };
  tail: { x: number; y: number };
  /** Ground point of the cat (under it, at its height). */
  feet: { x: number; y: number };
  facing: 1 | -1;
  /** Head tilt, radians. */
  tilt: number;
  /** The three-quarter front model (sitting) instead of the side model. */
  front: boolean;
  time: number;
  asleep: boolean;
  flying: boolean;
}

const LINE = '#211c1c';
function ink(g: CanvasRenderingContext2D, w: number) { g.strokeStyle = LINE; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
function fill(g: CanvasRenderingContext2D, c: string, w: number) { g.fillStyle = c; g.fill(); ink(g, w); }
const lineW = (a: Anchors) => Math.max(1.5, a.head.r * .065);

/** Puts the drawing at the head, scaled by its radius (unit = r), mirrored by facing, tilted. */
function atHead(g: CanvasRenderingContext2D, a: Anchors, draw: (u: number) => void) {
  g.save(); g.translate(a.head.x, a.head.y); g.rotate(a.tilt); g.scale(a.facing, 1); draw(a.head.r); g.restore();
}

// Witch

function witchHat(g: CanvasRenderingContext2D, a: Anchors) {
  const lw = lineW(a);
  atHead(g, a, u => {
    g.translate(u * .05, -u * .62); g.rotate(-.12);
    g.beginPath(); g.ellipse(0, 0, u * 1.05, u * .26, 0, 0, Math.PI * 2); fill(g, '#2d2140', lw);
    g.beginPath(); g.moveTo(-u * .55, -u * .05); g.quadraticCurveTo(-u * .35, -u * .9, u * .1, -u * 1.25); g.quadraticCurveTo(u * .55, -u * 1.45, u * .8, -u * 1.1);
    g.quadraticCurveTo(u * .45, -u * 1.05, u * .32, -u * .7); g.quadraticCurveTo(u * .45, -u * .3, u * .55, -u * .05); g.closePath(); fill(g, '#3b2a55', lw);
    g.beginPath(); g.moveTo(-u * .55, -u * .1); g.quadraticCurveTo(0, -u * .02, u * .55, -u * .1); g.lineTo(u * .5, -u * .3); g.quadraticCurveTo(0, -u * .22, -u * .5, -u * .3); g.closePath(); fill(g, '#ff8a3d', lw * .8);
    g.fillStyle = '#ffd25e'; g.beginPath(); g.rect(-u * .1, -u * .3, u * .2, u * .2); g.fill(); g.strokeStyle = LINE; g.lineWidth = lw * .6; g.stroke();
  });
}
/** The broom under a flying witch-cat: along the body, bristles behind (toward the tail). */
function witchBroom(g: CanvasRenderingContext2D, a: Anchors) {
  if (!a.flying) return;
  const len = a.body.rx * 4.2, y = a.body.y + a.body.ry * .75;
  g.save(); g.translate(a.body.x, y); g.scale(-a.facing, 1); g.rotate(-.08); broomShape(g, len, lineW(a)); g.restore();
  // Sparkles trailing from the bristles.
  g.fillStyle = '#ffd25e';
  for (let i = 0; i < 4; i++) { const u = (a.time * 1.6 + i / 4) % 1, x = a.body.x - a.facing * (len * .6 + u * 70), yy = y + Math.sin(u * 9 + i) * 10; g.globalAlpha = 1 - u; g.beginPath(); g.arc(x, yy, 3.5 * (1 - u) + 1, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
}

// Bat

function batWings(g: CanvasRenderingContext2D, a: Anchors) {
  const u = a.head.r * (a.flying ? 1.9 : 1.3), lw = lineW(a);
  const flap = a.flying ? Math.sin(a.time * 14) * .55 : a.asleep ? .05 : Math.sin(a.time * 3) * .12;
  const bx = a.front ? a.body.x : a.neck.x * .55 + a.body.x * .45, by = a.front ? a.body.y - a.body.ry * .55 : a.body.y - a.body.ry * .65;
  g.save(); g.translate(bx, by);
  // From the side the far wing shows a little behind the near one.
  const sides = a.front ? [-1, 1] : [1, 1];
  sides.forEach((side, k) => {
    g.save();
    if (a.front) g.scale(side, 1); else { g.scale(-a.facing, 1); g.translate(k ? -u * .12 : 0, k ? -u * .08 : 0); }
    g.rotate(-.35 - flap - (k && !a.front ? .25 : 0));
    batWing(g, u, k && !a.front ? '#3d2752' : '#5a3a78', '#8a68a8', lw);
    g.restore();
  });
  g.restore();
}

// Vampire

function vampireCape(g: CanvasRenderingContext2D, a: Anchors) {
  const u = a.head.r, lw = lineW(a), sway = Math.sin(a.time * 2.2) * u * .06;
  g.save();
  if (a.front) {
    g.translate(a.neck.x, a.neck.y);
    const hem = Math.max(u * 1.3, a.feet.y - a.neck.y - u * .05), wide = Math.max(u * 1.55, a.body.rx * 1.7);
    g.beginPath(); g.moveTo(-u * .5, -u * .05); g.quadraticCurveTo(-wide * 1.15, hem * .45, -wide + sway, hem); g.lineTo(wide + sway, hem); g.quadraticCurveTo(wide * 1.15, hem * .45, u * .5, -u * .05); g.closePath();
    fill(g, '#1f1726', lw);
    g.beginPath(); g.moveTo(-u * .4, u * .1); g.quadraticCurveTo(-wide, hem * .5, -wide * .82 + sway, hem - u * .07); g.lineTo(wide * .82 + sway, hem - u * .07); g.quadraticCurveTo(wide, hem * .5, u * .4, u * .1); g.closePath();
    g.fillStyle = '#9e1b32'; g.fill();
  } else {
    // Draped over the back from the shoulders to the rump, hanging down the flank, red lining at the hem.
    const tailSide = a.body.x - a.neck.x, dir = Math.sign(tailSide) || -a.facing;
    const x0 = a.neck.x, y0 = a.neck.y - u * .15, x1 = a.body.x + dir * a.body.rx * 1.05, top = a.body.y - a.body.ry * 1.05, hem = a.body.y + a.body.ry * .35;
    g.beginPath(); g.moveTo(x0 - dir * u * .1, y0);
    g.quadraticCurveTo((x0 + x1) / 2, top - u * .25, x1 + dir * u * .1 + sway, top + u * .1);
    g.quadraticCurveTo(x1 + dir * u * .25 + sway, hem * .5 + top * .5, x1 + sway, hem);
    for (let i = 1; i <= 4; i++) { const xa = x1 + (x0 - x1) * (i / 4) * .85; g.quadraticCurveTo(xa + dir * u * .12, hem + u * .14, xa, hem - (i % 2) * u * .06); }
    g.quadraticCurveTo(x0 - dir * u * .05, hem * .4 + y0 * .6, x0 - dir * u * .1, y0); g.closePath();
    fill(g, '#1f1726', lw);
    g.strokeStyle = '#9e1b32'; g.lineWidth = lw * 1.6; g.beginPath(); g.moveTo(x1 + sway, hem); for (let i = 1; i <= 4; i++) { const xa = x1 + (x0 - x1) * (i / 4) * .85; g.quadraticCurveTo(xa + dir * u * .12, hem + u * .14, xa, hem - (i % 2) * u * .06); } g.stroke();
  }
  g.restore();
}
function vampireCollar(g: CanvasRenderingContext2D, a: Anchors) {
  const u = a.head.r, lw = lineW(a);
  g.save(); g.translate(a.neck.x, a.neck.y); g.scale(a.facing, 1);
  // The high, stiff collar rising behind the head on both sides.
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * u * .12, u * .08); g.lineTo(s * u * .7, -u * .45); g.quadraticCurveTo(s * u * .78, -u * .1, s * u * .62, u * .12); g.closePath(); fill(g, '#1f1726', lw); g.beginPath(); g.moveTo(s * u * .2, u * .04); g.lineTo(s * u * .6, -u * .33); g.lineTo(s * u * .55, u * .06); g.closePath(); g.fillStyle = '#9e1b32'; g.fill(); }
  g.beginPath(); g.arc(0, u * .12, u * .11, 0, Math.PI * 2); fill(g, '#ffcf4a', lw * .7);
  g.restore();
}
function fangs(g: CanvasRenderingContext2D, a: Anchors) {
  if (a.asleep) return;
  const u = a.head.r, lw = Math.max(1, lineW(a) * .6), m = a.mouth;
  g.save(); g.translate(m.x, m.y + u * .02); g.rotate(a.tilt);
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * u * .09 - u * .055, 0); g.lineTo(s * u * .09 + u * .055, 0); g.lineTo(s * u * .09, u * .22); g.closePath(); g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = LINE; g.lineWidth = lw; g.stroke(); }
  g.restore();
}

// Werewolf

function wolfEars(g: CanvasRenderingContext2D, a: Anchors) {
  const lw = lineW(a);
  atHead(g, a, u => {
    for (const s of [-1, 1]) {
      g.save(); g.translate(s * u * .52, -u * .72); g.rotate(s * .3); g.scale(1.35, 1.35);
      g.beginPath(); g.moveTo(-u * .3, u * .15); g.lineTo(-u * .05, -u * .75); g.lineTo(u * .3, u * .12); g.quadraticCurveTo(0, u * .28, -u * .3, u * .15); g.closePath(); fill(g, '#6f6158', lw);
      g.beginPath(); g.moveTo(-u * .16, u * .08); g.lineTo(-u * .04, -u * .45); g.lineTo(u * .14, u * .06); g.closePath(); g.fillStyle = '#c99a8a'; g.fill();
      // Tufts of fur at the tip.
      g.strokeStyle = '#4b3f38'; g.lineWidth = lw * .8; g.beginPath(); g.moveTo(-u * .05, -u * .72); g.lineTo(-u * .12, -u * .9); g.moveTo(-u * .02, -u * .7); g.lineTo(u * .06, -u * .86); g.stroke();
      g.restore();
    }
    // Shaggy cheek fur.
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * u * .78, -u * .1);
      for (let k = 0; k < 3; k++) g.lineTo(s * u * (1.02 + (k % 2) * .1), u * (.0 + k * .16)), g.lineTo(s * u * .86, u * (.08 + k * .16));
      g.lineTo(s * u * .7, u * .5); g.closePath(); fill(g, '#6f6158', lw * .8);
    }
  });
}
function wolfMane(g: CanvasRenderingContext2D, a: Anchors) {
  const u = a.head.r, lw = lineW(a);
  g.save(); g.translate(a.neck.x, a.neck.y + u * .05);
  const n = 11, R = u * .72;
  g.beginPath();
  for (let i = 0; i <= n * 2; i++) { const ang = Math.PI * .05 + (i / (n * 2)) * Math.PI * .9, r = i % 2 ? R * 1.28 : R; g.lineTo(Math.cos(ang) * r * (i % 2 ? 1 : .96), Math.sin(ang) * r * .55 - u * .05); }
  g.closePath(); fill(g, '#5e5149', lw);
  g.restore();
}
// Ghost

function ghostSheet(g: CanvasRenderingContext2D, a: Anchors) {
  const u = a.head.r, lw = lineW(a), t = a.time;
  // The sheet hangs from above the head down past the body, wider at the bottom, its hem waving.
  const top = a.head.y - u * 1.25, bottomY = Math.max(a.body.y + a.body.ry * 1.4, a.head.y + u * 1.6);
  const cx = (a.head.x + a.body.x) / 2, half = Math.max(u * 1.15, a.body.rx * 1.35 + Math.abs(a.head.x - a.body.x) * .55);
  g.save(); g.globalAlpha = .94;
  g.beginPath();
  g.moveTo(cx - half, bottomY);
  g.bezierCurveTo(cx - half * 1.02, a.head.y - u * .2, a.head.x - u * 1.25, top, a.head.x, top);
  g.bezierCurveTo(a.head.x + u * 1.25, top, cx + half * 1.02, a.head.y - u * .2, cx + half, bottomY);
  const waves = 6;
  for (let i = 0; i < waves; i++) { const x0 = cx + half - (i / waves) * half * 2, x1 = cx + half - ((i + 1) / waves) * half * 2, w = Math.sin(t * 3 + i * 1.3) * u * .12; g.quadraticCurveTo((x0 + x1) / 2, bottomY + u * .28 + w, x1, bottomY); }
  g.closePath();
  // An opening for the cat's own face (its own sub-path, so no line joins it to the outline).
  const hx = a.head.x + Math.cos(a.tilt) * u * .72, hy = a.head.y + u * .1 + Math.sin(a.tilt) * u * .72;
  g.moveTo(hx, hy);
  g.ellipse(a.head.x, a.head.y + u * .1, u * .72, u * .6, a.tilt, 0, Math.PI * 2, true);
  g.fillStyle = '#f6f3ff'; g.fill('evenodd'); ink(g, lw);
  g.globalAlpha = 1;
  // Ear bumps poking the sheet up, and a soft fold.
  g.restore();
  atHead(g, a, uu => {
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * uu * .2, -uu * 1.12); g.quadraticCurveTo(s * uu * .55, -uu * 1.62, s * uu * .78, -uu * .95); fill(g, '#f6f3ff', lw); }
  });
  g.strokeStyle = '#d6d0ea'; g.lineWidth = lw; g.beginPath(); g.moveTo(cx + half * .5, a.head.y + u * .7); g.quadraticCurveTo(cx + half * .62, bottomY - u * .5, cx + half * .5, bottomY - u * .1); g.stroke();
}

/** Bandages round the body and over the top of the head, leaving the face clear. */
function mummyWrap(g: CanvasRenderingContext2D, a: Anchors) {
  const lw = lineW(a), wrap = '#efe6d2', edge = '#b9ab92';
  const band = (cx: number, cy: number, rx: number, ry: number, w: number) => {
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.lineWidth = w; g.strokeStyle = edge; g.stroke();
    g.lineWidth = w * .8; g.strokeStyle = wrap; g.stroke();
  };
  g.save();
  for (const k of [-1, 0, 1]) band(a.body.x, a.body.y + k * a.body.ry * .5, a.body.rx * 1.02, a.body.ry * .2, Math.max(lw * 2, a.body.ry * .28));
  atHead(g, a, u => { for (const k of [-.7, -.35]) { g.beginPath(); g.ellipse(0, -u * (.5 + k * -.6), u * 1.02, u * .22, 0, Math.PI, 0); g.lineWidth = Math.max(2, u * .22); g.strokeStyle = wrap; g.stroke(); } });
  g.restore();
}

export function drawCostume(g: CanvasRenderingContext2D, id: CostumeId, layer: 'back' | 'front', a: Anchors) {
  if (layer === 'back') {
    if (id === 'bat') batWings(g, a);
    else if (id === 'vampire' && a.front) vampireCape(g, a);
    else if (id === 'witch') witchBroom(g, a);
    return;
  }
  if (id === 'witch') witchHat(g, a);
  else if (id === 'vampire') { if (!a.front) vampireCape(g, a); vampireCollar(g, a); fangs(g, a); }
  else if (id === 'werewolf') { wolfMane(g, a); wolfEars(g, a); }
  else if (id === 'ghost') ghostSheet(g, a);
  else if (id === 'mummy') mummyWrap(g, a);
}
