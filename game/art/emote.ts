import { clamp } from '../core/math';
import { INK } from './cat-look';

/**
 * The little painted marks that pop up beside a cat's head when it feels something: never letters, in the style of
 * the rest of the game (one dark outline, flat fills). They are drawn in world space, not mirrored with the cat.
 */
export type EmoteKind = 'exclaim' | 'question' | 'sweat' | 'anger' | 'heart' | 'spark' | 'zzz' | 'music' | 'dots';

const YELLOW = '#f6c66b', RED = '#e8584a', PINK = '#f08f99', BLUE = '#bfe3f2', CREAM = '#fffdf7';

/** How big the mark is `age` seconds into its `dur`: it pops in with an overshoot, holds, and shrinks away at the end. */
export function emoteScale(age: number, dur: number): number {
  if (age < 0 || age >= dur) return 0;
  if (age < .22) { const u = age / .22; return u < .7 ? 1.25 * (u / .7) : 1.25 - .25 * ((u - .7) / .3); }
  const out = dur - age;
  return out < .25 ? clamp(out / .25, 0, 1) : 1;
}

/** Draws one mark centred at (x, y); `size` is about the cat's head radius. */
export function drawEmote(ctx: CanvasRenderingContext2D, kind: EmoteKind, x: number, y: number, size: number, age: number, dur: number) {
  const pop = emoteScale(age, dur);
  if (pop <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(size * pop, size * pop);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = .11;
  const wiggle = age < .6 ? Math.sin(age * 26) * .1 * (1 - age / .6) : 0;
  ctx.rotate(wiggle);
  if (kind === 'exclaim') {
    ctx.fillStyle = YELLOW;
    ctx.beginPath(); ctx.roundRect(-.2, -1, .4, .95, .18); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, .27, .21, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (kind === 'question') {
    // An outlined hook: the dark stroke first, the colour on top, then the dot.
    const hook = () => { ctx.beginPath(); ctx.arc(0, -.62, .38, Math.PI * 1.05, Math.PI * 2.25); ctx.quadraticCurveTo(.1, -.12, 0, .02); };
    ctx.lineWidth = .5; hook(); ctx.stroke(); ctx.strokeStyle = YELLOW; ctx.lineWidth = .27; hook(); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = .11; ctx.fillStyle = YELLOW; ctx.beginPath(); ctx.arc(0, .33, .2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (kind === 'sweat') {
    const drip = Math.min(.35, age * .35);
    ctx.fillStyle = BLUE; ctx.translate(0, drip);
    ctx.beginPath(); ctx.moveTo(0, -.75); ctx.quadraticCurveTo(.62, .1, 0, .55); ctx.quadraticCurveTo(-.62, .1, 0, -.75); ctx.fill(); ctx.stroke();
    ctx.fillStyle = CREAM; ctx.beginPath(); ctx.ellipse(-.14, .08, .08, .15, .3, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'anger') {
    // The popping vein: four short thick crescents round a clear gap (a long arc made it look like a life ring).
    ctx.fillStyle = RED;
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 2 + Math.PI / 4);
      ctx.beginPath(); ctx.arc(0, 0, .86, -.4, .4); ctx.arc(0, 0, .4, .4, -.4, true); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  } else if (kind === 'heart') {
    const rise = Math.min(.5, age * .4);
    ctx.fillStyle = PINK; ctx.translate(0, -rise);
    ctx.beginPath(); ctx.moveTo(0, .62); ctx.bezierCurveTo(-1.05, -.05, -.6, -.82, 0, -.34); ctx.bezierCurveTo(.6, -.82, 1.05, -.05, 0, .62); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (kind === 'spark') {
    // Two twinkling four-point stars.
    ctx.fillStyle = YELLOW;
    for (const [dx, dy, r, ph] of [[-.1, .05, .85, 0], [.62, -.55, .5, 1.7]] as const) {
      const s = r * (.85 + .15 * Math.sin(age * 12 + ph));
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? s * .3 : s; ctx.lineTo(dx + Math.cos(a) * rr, dy + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  } else if (kind === 'zzz') {
    // Three Z's, each bigger and higher than the last, drifting up.
    ctx.lineWidth = .17;
    for (let i = 0; i < 3; i++) {
      const rise = ((age * .6 + i * .33) % 1), s = .22 + i * .14, a = Math.sin(Math.PI * rise);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(-.4 + i * .5, .4 - i * .45 - rise * .3);
      ctx.beginPath(); ctx.moveTo(-s, -s); ctx.lineTo(s, -s); ctx.lineTo(-s, s); ctx.lineTo(s, s); ctx.stroke();
      ctx.restore();
    }
  } else if (kind === 'music') {
    ctx.fillStyle = INK; ctx.lineWidth = .14;
    const note = (dx: number, dy: number) => {
      ctx.beginPath(); ctx.ellipse(dx, dy + .45, .27, .2, -.35, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(dx + .22, dy + .38); ctx.lineTo(dx + .22, dy - .5); ctx.quadraticCurveTo(dx + .55, dy - .3, dx + .5, dy + .05); ctx.stroke();
    };
    note(-.25, Math.sin(age * 9) * .05); note(.35, -.3 + Math.sin(age * 9 + 1) * .05);
  } else {
    // dots: three beats that fill in one after the other.
    ctx.fillStyle = CREAM;
    for (let i = 0; i < 3; i++) {
      const on = (age * 2.2) % 3 > i ? 1 : .35;
      ctx.beginPath(); ctx.arc(-.55 + i * .55, 0, .17 * (.6 + .4 * on), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
}
