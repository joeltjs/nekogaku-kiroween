/**
 * The things a cat holds or leans on while it trains: the barbell and the little study desk with
 * its book, notebook and pencil. Drawn in the cat's own space (feet at y 0, unscaled cat units)
 * through `DrawOptions.props`, so they meet the paws exactly for kittens and grown cats alike.
 * One dark outline, flat fills, like the rest of the house.
 */
type P = { x: number; y: number };
const INK = '#211c1c', LINE = 2.6;

/** A barbell gripped by both front paws; `bend` (0..1) bows the bar under the weight at the top of a rep. */
export function drawBarbell(g: CanvasRenderingContext2D, near: P, far: P, bend = 0) {
  // The plates sit outside the paws, whatever the cat's width.
  const cx = (near.x + far.x) / 2, y = (near.y + far.y) / 2, hw = Math.max(38, Math.abs(far.x - near.x) / 2 + 22), sag = bend * 3.2;
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  // The bar: ink under, steel over; the ends dip a little when it bends.
  g.beginPath(); g.moveTo(cx - hw, y + sag); g.quadraticCurveTo(cx, y - sag, cx + hw, y + sag);
  g.strokeStyle = INK; g.lineWidth = 6.4; g.stroke();
  g.strokeStyle = '#a7b0ba'; g.lineWidth = 2.8; g.stroke();
  // Plates, the same on both sides: a big dark one inside, a red one outside, then the collar.
  for (const side of [-1, 1]) {
    const ex = cx + side * hw, ey = y + sag, tilt = side * bend * .08;
    g.save(); g.translate(ex, ey); g.rotate(tilt);
    for (const [off, r, c] of [[-9, 15, '#3d3a42'], [-2, 11, '#e8584a']] as const) {
      g.beginPath(); g.roundRect(side < 0 ? -off - 7 : off, -r, 7, r * 2, 2.5);
      g.fillStyle = c; g.fill(); g.strokeStyle = INK; g.lineWidth = LINE; g.stroke();
    }
    g.beginPath(); g.roundRect(side < 0 ? 4 : -7, -4, 3, 8, 1);
    g.fillStyle = '#d7dde3'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
    g.restore();
  }
  g.restore();
}

/** Where the mascot's desk stands, in the cat's space (the study pose rests its paws at y -31). */
export const DESK = { left: 2, right: 88, top: -28, book: 40, bookHalf: 20 } as const;

/** The little low desk in front of a studying cat, its legs down to the floor. */
export function drawDesk(g: CanvasRenderingContext2D, d = DESK) {
  g.save(); g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = LINE;
  g.fillStyle = '#8a6141';
  for (const lx of [d.left + 6, d.right - 12]) { g.beginPath(); g.roundRect(lx, d.top + 4, 6, -d.top - 4, 2); g.fill(); g.stroke(); }
  g.fillStyle = '#b48760'; g.beginPath(); g.roundRect(d.left, d.top, d.right - d.left, 6, 3); g.fill(); g.stroke();
  // A small cup of green tea at the far end, a thread of steam rising.
  const mx = d.right - 10;
  g.fillStyle = '#f4efe2'; g.beginPath(); g.roundRect(mx - 5, d.top - 9, 10, 9, 2.5); g.fill(); g.stroke();
  g.fillStyle = '#86b36a'; g.beginPath(); g.ellipse(mx, d.top - 8, 3.4, 1.2, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** Steam over the tea; `t` in seconds. */
export function drawSteam(g: CanvasRenderingContext2D, t: number, d = DESK) {
  const mx = d.right - 10;
  g.save(); g.strokeStyle = '#ffffffcc'; g.lineWidth = 1.6; g.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const p = (t * .45 + i * .5) % 1; g.globalAlpha = Math.sin(p * Math.PI) * .8;
    g.beginPath(); g.moveTo(mx - 1 + i * 2, d.top - 11 - p * 10);
    g.quadraticCurveTo(mx + 3 * Math.sin(t * 2 + i), d.top - 15 - p * 12, mx - 1 + i * 2, d.top - 19 - p * 14); g.stroke();
  }
  g.restore();
}

/** An open book lying on the desk; `turn` (0..1) lifts the right page as a paw turns it. */
export function drawOpenBook(g: CanvasRenderingContext2D, x: number, top: number, hw: number, turn = 0) {
  g.save(); g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = LINE;
  g.fillStyle = '#5f8f45'; g.beginPath(); g.roundRect(x - hw - 2.5, top - 3, hw * 2 + 5, 4.5, 2); g.fill(); g.stroke();
  g.fillStyle = '#fffdf3';
  g.beginPath(); g.moveTo(x - hw, top - 3.5); g.quadraticCurveTo(x - hw / 2, top - 10, x, top - 5); g.lineTo(x, top - 1); g.lineTo(x - hw, top - 1); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(x, top - 5); g.quadraticCurveTo(x + hw / 2, top - 10 - turn * 16, x + hw, top - 3.5 - turn * 20); g.lineTo(x + hw, top - 1); g.lineTo(x, top - 1); g.closePath(); g.fill(); g.stroke();
  // A few lines of text on the pages.
  g.strokeStyle = '#c9b9a0'; g.lineWidth = 1;
  for (let i = 0; i < 2; i++) {
    g.beginPath(); g.moveTo(x - hw + 4, top - 5 + i * 2.2); g.lineTo(x - 4, top - 5.5 + i * 2.2);
    if (turn < .2) { g.moveTo(x + 4, top - 5.5 + i * 2.2); g.lineTo(x + hw - 4, top - 5 + i * 2.2); }
    g.stroke();
  }
  g.restore();
}

/**
 * An open book held up in both paws, seen from the front: the two halves of the cover in a shallow
 * V with the pages showing above, あ on the cover. `turn` 0..1 flips a page over the top.
 * (x, y): centre of the bottom edge; `hw`: half the width.
 */
export function drawHeldBook(g: CanvasRenderingContext2D, x: number, y: number, hw: number, turn = 0) {
  const h = hw * 1.15, dip = hw * .1;
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = LINE;
  // Pages behind the cover, a little higher than it.
  g.fillStyle = '#fffdf3';
  g.beginPath(); g.moveTo(x - hw * .94, y - h * .2); g.lineTo(x - hw * .9, y - h - 3); g.quadraticCurveTo(x - hw * .45, y - h - 8, x, y - h + dip - 2);
  g.quadraticCurveTo(x + hw * .45, y - h - 8, x + hw * .9, y - h - 3); g.lineTo(x + hw * .94, y - h * .2); g.closePath(); g.fill(); g.stroke();
  // The cover: two panels meeting at the spine.
  g.fillStyle = '#5f8f45';
  for (const sd of [-1, 1]) {
    g.beginPath(); g.moveTo(x, y + dip); g.lineTo(x + sd * hw, y); g.lineTo(x + sd * hw, y - h); g.lineTo(x, y - h + dip); g.closePath(); g.fill(); g.stroke();
  }
  g.strokeStyle = '#3e5c2b'; g.lineWidth = LINE * .8; g.beginPath(); g.moveTo(x, y + dip); g.lineTo(x, y - h + dip); g.stroke();
  g.fillStyle = '#fffdf3'; g.font = `900 ${Math.round(hw * .62)}px "Zen Maru Gothic", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('あ', x + hw * .5, y - h * .5 + dip * .5);
  if (turn > .02) {
    // A page lifting from the right half and falling over to the left.
    const a = turn * Math.PI, tipX = x + Math.cos(a) * hw * .88, tipY = y - h - 2 - Math.sin(a) * hw * .55;
    g.fillStyle = '#fffaf0'; g.strokeStyle = INK; g.lineWidth = LINE * .8;
    g.beginPath(); g.moveTo(x, y - h + dip - 2); g.quadraticCurveTo((x + tipX) / 2, tipY - 6, tipX, tipY); g.lineTo(tipX, tipY + h * .35); g.quadraticCurveTo((x + tipX) / 2, tipY + h * .3, x, y - h * .62); g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
}

/** A pencil held in a paw, its tip on the page; `wiggle` moves the tip as it writes. */
export function drawPencil(g: CanvasRenderingContext2D, paw: P, wiggle = 0) {
  g.save(); g.translate(paw.x + 4 + wiggle, paw.y - 2); g.rotate(-.9);
  g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = 2;
  g.fillStyle = '#f2c94c'; g.beginPath(); g.roundRect(-2.5, -18, 5, 16, 1.5); g.fill(); g.stroke();
  g.fillStyle = '#f0b8a8'; g.beginPath(); g.roundRect(-2.5, -22, 5, 4, 1.5); g.fill(); g.stroke();
  g.fillStyle = '#f4dcc0'; g.beginPath(); g.moveTo(-2.5, -2); g.lineTo(2.5, -2); g.lineTo(0, 4); g.closePath(); g.fill(); g.stroke();
  g.restore();
}

/** A small sweat drop by the head while straining. */
export function drawSweat(g: CanvasRenderingContext2D, x: number, y: number, a = 1) {
  g.save(); g.globalAlpha = a; g.fillStyle = '#8fd0f0'; g.strokeStyle = INK; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(x, y - 6); g.quadraticCurveTo(x + 4.5, y + 1, x, y + 3); g.quadraticCurveTo(x - 4.5, y + 1, x, y - 6); g.fill(); g.stroke();
  g.restore();
}
