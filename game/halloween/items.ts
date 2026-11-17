/**
 * The ten Halloween items (R4), all drawn in code in the room's style: flat fills, one brown ink line.
 * Origin of every drawing is the item's ground point (x, y); up is negative y.
 * Each item teaches one Japanese word and says how a cat uses it. Five of them dress the cat up
 * (R7): the coffin makes a vampire, the ghost sheet a ghost, the full-moon lamp a werewolf, the bat
 * wings a flying bat, the broom a flying witch. Cats look like themselves otherwise.
 */
import type { ClipName } from '../art/cat-clips';

export type ItemId = 'bed' | 'coffin' | 'sheet' | 'moon' | 'wings' | 'broom' | 'cauldron' | 'tree' | 'candles' | 'spider'
  | 'lantern' | 'hammock' | 'bone' | 'potion' | 'mummy';
export type CostumeId = 'vampire' | 'ghost' | 'werewolf' | 'bat' | 'witch' | 'mummy';

export interface ItemUse {
  /** What the cat plays while using it. */
  clips: ClipName[];
  /** Where the cat stands relative to the item (dx is mirrored by the side it comes from). */
  dx: number; dy: number;
  /** Height the cat sits at. */
  z: number;
  /** Rim height above the item's ground: the cat is drawn cut at this line (inside a bed or coffin). */
  rim?: number;
  /** Seconds it stays. */
  stay: [number, number];
  /** The cat faces the item rather than away. */
  faceIt?: boolean;
  sleep?: boolean;
  /** Using it ends in this costume. */
  costume?: CostumeId;
  /** The cat takes the item with it while dressed (the sheet, the wings, the broom). */
  worn?: boolean;
}

export interface ItemDef {
  id: ItemId; name: string; jp: string; romaji: string; meaning: string;
  /** What it does, for the Items menu. */
  blurb: string;
  /** Hit box: half width and height above the ground point. */
  hw: number; h: number;
  use: ItemUse;
  draw: (g: CanvasRenderingContext2D, t: number) => void;
  /** Items a cat lies inside: what is drawn in front of the cat. */
  front?: (g: CanvasRenderingContext2D, t: number) => void;
  /** Gives off light at this height. */
  light?: { dy: number; r: number };
}

export interface CostumeDef { id: CostumeId; name: string; jp: string; romaji: string; item: ItemId; flies?: boolean }
export const COSTUMES: Record<CostumeId, CostumeDef> = {
  vampire: { id: 'vampire', name: 'Vampire', jp: 'きゅうけつき', romaji: 'kyūketsuki', item: 'coffin' },
  ghost: { id: 'ghost', name: 'Ghost', jp: 'おばけ', romaji: 'obake', item: 'sheet' },
  werewolf: { id: 'werewolf', name: 'Werewolf', jp: 'おおかみおとこ', romaji: 'ōkami otoko', item: 'moon' },
  bat: { id: 'bat', name: 'Bat', jp: 'こうもり', romaji: 'kōmori', item: 'wings', flies: true },
  witch: { id: 'witch', name: 'Witch', jp: 'まじょ', romaji: 'majo', item: 'broom', flies: true },
  mummy: { id: 'mummy', name: 'Mummy', jp: 'ミイラ', romaji: 'miira', item: 'mummy' },
};
export const COSTUME_IDS = Object.keys(COSTUMES) as CostumeId[];
export const isCostumeId = (v: unknown): v is CostumeId => typeof v === 'string' && v in COSTUMES;

const LINE = '#3a2a24';
function ink(g: CanvasRenderingContext2D, w = 3) { g.strokeStyle = LINE; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
function fill(g: CanvasRenderingContext2D, c: string, w = 3) { g.fillStyle = c; g.fill(); ink(g, w); }
function shadow(g: CanvasRenderingContext2D, rx: number, ry = rx * .22) { g.fillStyle = '#0000003a'; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

function flame(g: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, seed: number) {
  const f = 1 + Math.sin(t * 11 + seed) * .08 + Math.sin(t * 17 + seed * 2) * .05;
  g.save(); g.translate(x, y); g.scale(s, s * f);
  g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(0, -16); g.quadraticCurveTo(7, -6, 5, 0); g.quadraticCurveTo(0, 4, -5, 0); g.quadraticCurveTo(-7, -6, 0, -16); g.fill();
  g.fillStyle = '#fff1b8'; g.beginPath(); g.moveTo(0, -9); g.quadraticCurveTo(3, -3, 2, 0); g.quadraticCurveTo(0, 2, -2, 0); g.quadraticCurveTo(-3, -3, 0, -9); g.fill();
  g.restore();
}
/** A pumpkin body made of overlapping lobes. */
export function pumpkin(g: CanvasRenderingContext2D, w: number, h: number, color = '#f08a2c', dark = '#c96a1c') {
  const lobes = [-.34, .34, -.14, .14, 0];
  for (const k of lobes) { g.beginPath(); g.ellipse(k * w, -h / 2, w * (k === 0 ? .3 : .28), h / 2, 0, 0, Math.PI * 2); fill(g, Math.abs(k) > .2 ? dark : color, 2.5); }
  g.beginPath(); g.moveTo(-3, -h + 2); g.quadraticCurveTo(-2, -h - 12, 6, -h - 16); g.lineTo(9, -h - 12); g.quadraticCurveTo(3, -h - 8, 4, -h + 2); g.closePath(); fill(g, '#6b8f3c', 2);
}
/** One bat wing, pointing +x from its root (used by the item and the costume). */
export function batWing(g: CanvasRenderingContext2D, u: number, color = '#3a2847', vein = '#5c4470', lw = 3) {
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(u * .5, -u * .9, u * 1.35, -u * .75);
  g.quadraticCurveTo(u * 1.15, -u * .35, u * 1.3, -u * .1); g.quadraticCurveTo(u * .95, -u * .2, u * .9, u * .12);
  g.quadraticCurveTo(u * .6, -u * .05, u * .45, u * .22); g.quadraticCurveTo(u * .25, u * .05, 0, u * .1); g.closePath();
  fill(g, color, lw);
  g.strokeStyle = vein; g.lineWidth = lw * .7; for (const [x, y] of [[1.3, -.1], [.9, .12], [1.35, -.75]]) { g.beginPath(); g.moveTo(u * .1, 0); g.lineTo(x * u, y * u); g.stroke(); }
}
/** The witch's broom, lying along +x (its bristles at +x). */
export function broomShape(g: CanvasRenderingContext2D, len: number, lw = 3) {
  rr(g, -len * .55, -5, len * .75, 10, 4); fill(g, '#8a5a36', lw * .8);
  g.beginPath(); g.moveTo(len * .18, -8); g.lineTo(len * .18, 8); g.lineTo(len * .55, 22); g.quadraticCurveTo(len * .62, 0, len * .55, -22); g.closePath(); fill(g, '#d9a441', lw);
  g.strokeStyle = '#a97a2a'; g.lineWidth = lw * .6; for (const y of [-12, -4, 4, 12]) { g.beginPath(); g.moveTo(len * .2, y * .4); g.lineTo(len * .55, y * 1.5); g.stroke(); }
  rr(g, len * .12, -10, 12, 20, 3); fill(g, '#7a3f8f', lw * .7);
}

export const ITEMS: Record<ItemId, ItemDef> = {
  bed: {
    id: 'bed', name: 'Pumpkin bed', jp: 'かぼちゃ', romaji: 'kabocha', meaning: 'pumpkin', blurb: 'A hollowed pumpkin, warm and soft. Cats nap in it.', hw: 92, h: 70,
    use: { clips: ['sleep', 'sleepLoaf', 'loaf'], dx: 0, dy: -6, z: 4, rim: 26, stay: [14, 26], sleep: true },
    draw(g) {
      shadow(g, 96);
      g.beginPath(); g.ellipse(0, -30, 90, 40, 0, Math.PI, 0); g.lineTo(90, -30); fill(g, '#c96a1c');
      g.beginPath(); g.ellipse(0, -30, 76, 22, 0, 0, Math.PI * 2); fill(g, '#ffd08a', 2.5);
      g.beginPath(); g.ellipse(0, -28, 60, 13, 0, 0, Math.PI * 2); g.fillStyle = '#b86b8f'; g.fill();
    },
    front(g) {
      g.beginPath(); g.moveTo(-90, -30); g.quadraticCurveTo(-92, 4, -40, 6); g.lineTo(40, 6); g.quadraticCurveTo(92, 4, 90, -30); g.ellipse(0, -30, 90, 14, 0, 0, Math.PI, false); g.closePath(); fill(g, '#f08a2c');
      g.strokeStyle = '#c96a1c'; g.lineWidth = 3; for (const x of [-46, 0, 46]) { g.beginPath(); g.moveTo(x, -16); g.quadraticCurveTo(x * 1.1, -4, x, 4); g.stroke(); }
      // A jack-o'-lantern face on the front.
      g.fillStyle = '#ffcf5a'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 34, -12); g.lineTo(s * 16, -12); g.lineTo(s * 25, -24); g.closePath(); g.fill(); }
      g.beginPath(); g.ellipse(0, -30, 90, 14, 0, 0, Math.PI); ink(g, 2.5);
    },
  },
  coffin: {
    id: 'coffin', name: 'Coffin', jp: 'かんおけ', romaji: 'kan’oke', meaning: 'coffin', blurb: 'A cat lies down inside… and climbs out a vampire.', hw: 96, h: 60,
    use: { clips: ['sleepSide', 'sleep'], dx: 0, dy: -10, z: 4, rim: 34, stay: [4, 5], sleep: true, costume: 'vampire' },
    draw(g) {
      shadow(g, 100);
      // The lid leans against the coffin's far side.
      g.save(); g.translate(30, -46); g.rotate(-.12);
      g.beginPath(); g.moveTo(-70, -26); g.lineTo(46, -34); g.lineTo(76, -10); g.lineTo(46, 14); g.lineTo(-70, 10); g.lineTo(-86, -8); g.closePath(); fill(g, '#5a3328');
      g.strokeStyle = '#d9a441'; g.lineWidth = 5; g.beginPath(); g.moveTo(-34, -10); g.lineTo(6, -12); g.moveTo(-14, -26); g.lineTo(-14, 6); g.stroke();
      g.restore();
      g.beginPath(); g.moveTo(-92, -34); g.lineTo(-66, -50); g.lineTo(62, -54); g.lineTo(96, -36); g.lineTo(62, -22); g.lineTo(-66, -20); g.closePath(); fill(g, '#9e1b32', 2.5);
    },
    front(g) {
      g.beginPath(); g.moveTo(-92, -34); g.lineTo(-66, -20); g.lineTo(62, -22); g.lineTo(96, -36); g.lineTo(96, -10); g.lineTo(62, 4); g.lineTo(-66, 6); g.lineTo(-92, -8); g.closePath(); fill(g, '#4a2a20');
      g.strokeStyle = '#2e1912'; g.lineWidth = 2; g.beginPath(); g.moveTo(-66, -20); g.lineTo(-66, 6); g.moveTo(62, -22); g.lineTo(62, 4); g.stroke();
      g.fillStyle = '#d9a441'; for (const x of [-80, 80]) { g.beginPath(); g.arc(x, -12, 4, 0, Math.PI * 2); g.fill(); }
    },
  },
  sheet: {
    id: 'sheet', name: 'Ghost sheet', jp: 'おばけ', romaji: 'obake', meaning: 'ghost', blurb: 'A cat crawls under it and floats away as a little ghost.', hw: 60, h: 48,
    use: { clips: ['loaf'], dx: 0, dy: -4, z: 0, rim: 30, stay: [3, 4], costume: 'ghost', worn: true },
    draw(g, t) {
      shadow(g, 64);
      const w = Math.sin(t * 2) * 2;
      g.beginPath(); g.moveTo(-62, 0); g.quadraticCurveTo(-58, -40, -10, -46 - w); g.quadraticCurveTo(40, -44, 62, 0);
      for (let i = 0; i < 6; i++) { const x0 = 62 - i * 20.6; g.quadraticCurveTo(x0 - 10, 8, x0 - 20.6, 0); }
      g.closePath(); fill(g, '#f4f1ff');
      g.fillStyle = '#2b2236'; for (const x of [-22, -2]) { g.beginPath(); g.ellipse(x, -24, 5, 7, -.2, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = '#d6d0ea'; g.lineWidth = 2; g.beginPath(); g.moveTo(20, -30); g.quadraticCurveTo(30, -18, 26, -4); g.stroke();
    },
  },
  moon: {
    id: 'moon', name: 'Full-moon lamp', jp: 'まんげつ', romaji: 'mangetsu', meaning: 'full moon', blurb: 'One look at the full moon and… a werewolf!', hw: 44, h: 150, light: { dy: -110, r: 260 },
    use: { clips: ['lookUp'], dx: -78, dy: 10, z: 0, stay: [3, 4], faceIt: true, costume: 'werewolf' },
    draw(g, t) {
      shadow(g, 46);
      rr(g, -40, -14, 80, 16, 6); fill(g, '#2a1f30');
      rr(g, -5, -76, 10, 64, 3); fill(g, '#3d2c45', 2.5);
      g.fillStyle = '#fff1c4'; g.globalAlpha = .25 + .05 * Math.sin(t * 2); g.beginPath(); g.arc(0, -112, 58, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      g.beginPath(); g.arc(0, -112, 40, 0, Math.PI * 2); fill(g, '#fff1c4');
      g.fillStyle = '#e8d9a8'; for (const [dx, dy, r] of [[-12, -8, 8], [10, 10, 6], [14, -16, 4]]) { g.beginPath(); g.arc(dx, -112 + dy, r, 0, Math.PI * 2); g.fill(); }
    },
  },
  wings: {
    id: 'wings', name: 'Bat wings', jp: 'こうもり', romaji: 'kōmori', meaning: 'bat', blurb: 'Put them on and fly around the room like a bat.', hw: 64, h: 70,
    use: { clips: ['sit', 'stretch'], dx: -40, dy: 6, z: 0, stay: [2.5, 3], faceIt: true, costume: 'bat', worn: true },
    draw(g, t) {
      shadow(g, 60);
      rr(g, -40, -14, 80, 16, 6); fill(g, '#5b2a4a');
      const f = Math.sin(t * 2.4) * .06;
      for (const s of [-1, 1]) { g.save(); g.translate(0, -30); g.scale(s, 1); g.rotate(-.3 - f); batWing(g, 46); g.restore(); }
      g.beginPath(); g.ellipse(0, -30, 9, 12, 0, 0, Math.PI * 2); fill(g, '#2b1f2e', 2.5);
    },
  },
  broom: {
    id: 'broom', name: 'Witch broom', jp: 'ほうき', romaji: 'hōki', meaning: 'broom', blurb: 'Hop on: a witch’s hat appears and the broom takes off.', hw: 40, h: 196,
    use: { clips: ['sniff', 'rub'], dx: -44, dy: 6, z: 0, stay: [2.5, 3], faceIt: true, costume: 'witch', worn: true },
    draw(g) {
      shadow(g, 40);
      g.save(); g.rotate(.18);
      rr(g, -5, -196, 10, 150, 4); fill(g, '#8a5a36', 2.5);
      g.beginPath(); g.moveTo(-10, -54); g.lineTo(10, -54); g.lineTo(30, 0); g.quadraticCurveTo(0, 8, -30, 0); g.closePath(); fill(g, '#d9a441');
      g.strokeStyle = '#a97a2a'; g.lineWidth = 2; for (const x of [-16, -6, 4, 14]) { g.beginPath(); g.moveTo(x * .4, -50); g.lineTo(x * 1.4, -2); g.stroke(); }
      rr(g, -12, -60, 24, 10, 3); fill(g, '#7a3f8f', 2);
      g.restore();
    },
  },
  cauldron: {
    id: 'cauldron', name: 'Witch cauldron', jp: 'なべ', romaji: 'nabe', meaning: 'pot', blurb: 'Bubbling green brew. Cats love to peek out of it.', hw: 74, h: 96,
    use: { clips: ['sit', 'sitFront'], dx: 0, dy: -10, z: 6, rim: 70, stay: [8, 16] },
    draw(g, t) {
      shadow(g, 76);
      g.beginPath(); g.ellipse(0, -78, 66, 16, 0, 0, Math.PI * 2); fill(g, '#2c2733');
      g.beginPath(); g.ellipse(0, -78, 56, 11, 0, 0, Math.PI * 2); g.fillStyle = '#7fe08a'; g.fill();
      for (let i = 0; i < 3; i++) { const u = (t * .5 + i / 3) % 1; g.globalAlpha = 1 - u; g.beginPath(); g.arc(-24 + i * 24, -86 - u * 46, 5 + u * 6, 0, Math.PI * 2); g.fillStyle = '#b9f5bd'; g.fill(); }
      g.globalAlpha = 1;
    },
    front(g) {
      g.beginPath(); g.moveTo(-66, -78); g.bezierCurveTo(-82, -20, -46, 2, 0, 2); g.bezierCurveTo(46, 2, 82, -20, 66, -78); g.ellipse(0, -78, 66, 16, 0, 0, Math.PI, false); g.closePath(); fill(g, '#3a3442');
      g.fillStyle = '#ffffff22'; g.beginPath(); g.ellipse(-34, -46, 10, 20, -.3, 0, Math.PI * 2); g.fill();
      for (const x of [-40, 40]) { rr(g, x - 9, -6, 18, 12, 4); fill(g, '#2c2733', 2); }
      g.beginPath(); g.ellipse(0, -78, 66, 16, 0, 0, Math.PI); ink(g, 3);
    },
  },
  tree: {
    id: 'tree', name: 'Spooky tree tower', jp: 'かれき', romaji: 'kareki', meaning: 'dead tree', blurb: 'A crooked dead-tree cat tower. The top is the best seat.', hw: 74, h: 236,
    use: { clips: ['loaf', 'sit', 'sleepLoaf'], dx: 0, dy: -2, z: 196, stay: [12, 24] },
    draw(g) {
      shadow(g, 82);
      rr(g, -74, -22, 148, 24, 8); fill(g, '#4a3352');
      g.beginPath(); g.moveTo(-18, -20); g.bezierCurveTo(-26, -90, 6, -120, -8, -190); g.lineTo(14, -190); g.bezierCurveTo(28, -120, -2, -90, 16, -20); g.closePath(); fill(g, '#6e5038');
      g.beginPath(); g.moveTo(8, -120); g.quadraticCurveTo(40, -136, 52, -160); g.lineTo(58, -154); g.quadraticCurveTo(44, -126, 12, -108); g.closePath(); fill(g, '#6e5038', 2.5);
      rr(g, -68, -206, 136, 18, 9); fill(g, '#7d5a8c');
      rr(g, -60, -214, 120, 12, 6); fill(g, '#a07ab0', 2);
      g.fillStyle = '#2b1f2e'; g.beginPath(); g.ellipse(54, -146, 6, 8, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(48, -148); g.lineTo(40, -140); g.lineTo(48, -142); g.moveTo(60, -148); g.lineTo(68, -140); g.lineTo(60, -142); g.fill();
    },
  },
  candles: {
    id: 'candles', name: 'Candles', jp: 'ろうそく', romaji: 'rōsoku', meaning: 'candle', blurb: 'Warm light for the dark room. Cats sit and watch the flames.', hw: 44, h: 80, light: { dy: -70, r: 230 },
    use: { clips: ['watch', 'sit', 'lookUp'], dx: -90, dy: 10, z: 0, stay: [6, 12] },
    draw(g, t) {
      shadow(g, 46);
      rr(g, -44, -12, 88, 12, 5); fill(g, '#5c4a3c', 2.5);
      const sticks: [number, number][] = [[-24, 46], [2, 62], [26, 38]];
      sticks.forEach(([x, h], i) => {
        rr(g, x - 8, -12 - h, 16, h, 3); fill(g, '#efe6d2', 2.5);
        g.fillStyle = '#e4d6b8'; g.beginPath(); g.ellipse(x - 3, -12 - h + 10, 3, 7, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = LINE; g.lineWidth = 2; g.beginPath(); g.moveTo(x, -12 - h); g.lineTo(x, -16 - h); g.stroke();
        flame(g, x, -16 - h, 1, t, i * 3.1);
      });
    },
  },
  spider: {
    id: 'spider', name: 'Spider toy', jp: 'くも', romaji: 'kumo', meaning: 'spider', blurb: 'A fuzzy toy spider bobbing on a string. Irresistible.', hw: 40, h: 150,
    use: { clips: ['bat', 'crouch', 'bat', 'sitPlay'], dx: -56, dy: 2, z: 0, stay: [5, 9], faceIt: true },
    draw(g, t) {
      shadow(g, 40, 8);
      // A little stand with an arm, the spider bobbing on its thread.
      rr(g, -36, -10, 72, 12, 5); fill(g, '#2a1f30', 2.5);
      rr(g, -40, -150, 8, 142, 3); fill(g, '#5a3d2e', 2.5);
      rr(g, -40, -152, 70, 8, 3); fill(g, '#5a3d2e', 2.5);
      const bob = Math.sin(t * 2.3) * 10, sx = 24 + Math.sin(t * 1.4) * 4, sy = -70 + bob;
      g.strokeStyle = '#d8d0e8'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(26, -146); g.lineTo(sx, sy - 12); g.stroke();
      g.strokeStyle = '#1c1420'; g.lineWidth = 3;
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const a = Math.sin(t * 8 + k) * .15; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + s * 16, sy - 10 + k * 6 + a * 10, sx + s * 22, sy + k * 7 - 2); g.stroke(); }
      g.beginPath(); g.arc(sx, sy, 12, 0, Math.PI * 2); fill(g, '#2b1f2e', 2);
      g.fillStyle = '#ff8a3d'; for (const s of [-1, 1]) { g.beginPath(); g.arc(sx + s * 4, sy - 3, 2.5, 0, Math.PI * 2); g.fill(); }
    },
  },
  lantern: {
    id: 'lantern', name: 'Jack-o’-lantern lamp', jp: 'かぼちゃランタン', romaji: 'kabocha rantan', meaning: 'pumpkin lantern',
    blurb: 'A carved pumpkin that glows. Cats love to watch its flame.', hw: 40, h: 96, light: { dy: -60, r: 200 },
    use: { clips: ['watch', 'sit', 'lookUp'], dx: -70, dy: 8, z: 0, stay: [5, 9], faceIt: true },
    draw(g) {
      shadow(g, 36);
      rr(g, -4, -22, 8, 14, 2); fill(g, '#5c4a3c', 2);
      g.save(); g.translate(0, -18); pumpkin(g, 34, 40); g.restore();
      g.fillStyle = '#ffcf5a';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 8, -40); g.lineTo(s * 3, -40); g.lineTo(s * 5.5, -48); g.closePath(); g.fill(); }
      g.beginPath(); g.moveTo(-12, -35); g.quadraticCurveTo(0, -27, 12, -35); g.lineTo(7, -35); g.lineTo(0, -31); g.lineTo(-7, -35); g.closePath(); g.fill();
    },
  },
  hammock: {
    id: 'hammock', name: 'Cobweb hammock', jp: 'くものす', romaji: 'kumo no su', meaning: 'spider web',
    blurb: 'A net of web between two posts. Cats rest in it.', hw: 92, h: 112,
    use: { clips: ['loaf', 'sleepLoaf', 'sleep'], dx: 0, dy: -10, z: 40, stay: [12, 20], sleep: true },
    draw(g) {
      shadow(g, 88);
      for (const s of [-1, 1]) { rr(g, s * 80 - 5, -112, 10, 112, 4); fill(g, '#5a3d2e', 2.5); }
      g.beginPath(); g.moveTo(-74, -100); g.quadraticCurveTo(0, -36, 74, -100); g.quadraticCurveTo(0, -48, -74, -100); g.closePath(); fill(g, '#d8d0e8', 2);
      g.strokeStyle = '#8f88a6'; g.lineWidth = 1.5;
      for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 22, -68 + Math.abs(k) * 2); g.lineTo(k * 22, -36); g.stroke(); }
    },
  },
  bone: {
    id: 'bone', name: 'Bone chew toy', jp: 'ほね', romaji: 'hone', meaning: 'bone',
    blurb: 'A bone to chew. Cats gnaw it with great seriousness.', hw: 34, h: 24,
    use: { clips: ['bite', 'chew', 'eat'], dx: -48, dy: 4, z: 0, stay: [4, 7], faceIt: true },
    draw(g) {
      shadow(g, 32, 6);
      rr(g, -22, -14, 44, 9, 4); fill(g, '#f2ead9', 2);
      for (const s of [-1, 1]) for (const dy of [-6, 6]) { g.beginPath(); g.arc(s * 22, -10 + dy, 7, 0, Math.PI * 2); fill(g, '#f2ead9', 2); }
    },
  },
  potion: {
    id: 'potion', name: 'Potion flask', jp: 'ポーション', romaji: 'pōshon', meaning: 'potion',
    blurb: 'A glowing green potion on a stand. Cats sniff it suspiciously.', hw: 26, h: 72,
    use: { clips: ['sniff', 'watch'], dx: -52, dy: 6, z: 0, stay: [4, 7], faceIt: true },
    draw(g, t) {
      shadow(g, 28, 7);
      rr(g, -20, -10, 40, 10, 4); fill(g, '#5c4a3c', 2.5);
      rr(g, -6, -58, 12, 16, 3); fill(g, '#cfe6ea', 2);
      rr(g, -8, -64, 16, 8, 3); fill(g, '#b48760', 2);
      g.beginPath(); g.arc(0, -28, 17, 0, Math.PI * 2); fill(g, '#dcf5e0', 2.5);
      g.beginPath(); g.arc(0, -24, 13, 0, Math.PI * 2); g.fillStyle = '#7fe08a'; g.fill();
      for (let i = 0; i < 3; i++) { const u = (t * .6 + i / 3) % 1; g.globalAlpha = 1 - u; g.beginPath(); g.arc((i - 1) * 6, -26 - u * 22, 2.5, 0, Math.PI * 2); g.fillStyle = '#e8ffe0'; g.fill(); }
      g.globalAlpha = 1;
    },
  },
  mummy: {
    id: 'mummy', name: 'Mummy wrap', jp: 'ミイラ', romaji: 'miira', meaning: 'mummy',
    blurb: 'A roll of old bandages. Wrapped up, a cat becomes a mummy for a while.', hw: 40, h: 50,
    use: { clips: ['loaf', 'stand'], dx: -48, dy: 6, z: 0, stay: [3, 4], costume: 'mummy', worn: true },
    draw(g) {
      shadow(g, 40);
      g.save(); g.translate(0, -22);
      rr(g, -32, -20, 64, 30, 14); fill(g, '#efe6d2', 2.5);
      g.strokeStyle = '#b9ab92'; g.lineWidth = 2.5;
      for (const x of [-20, -4, 12, 28]) { g.beginPath(); g.moveTo(x, -16); g.lineTo(x + 6, 6); g.stroke(); }
      g.restore();
    },
  },
};
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const isItemId = (v: unknown): v is ItemId => typeof v === 'string' && v in ITEMS;
