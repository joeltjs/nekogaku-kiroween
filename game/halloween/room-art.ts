/**
 * The haunted living room (R1, R9.2), painted in code: flat muted fills, one brown ink line,
 * light grain. `paintRoom` makes the still picture once; `drawRoomLive` adds what moves (the night
 * sky in the window, the fire, candle flames, the clock's hands); `drawLighting` darkens the room
 * by the arcade hour and lets the warm lights through.
 */
import { mulberry32 } from '../core/math';
import { FLOOR_TOP, ROOM_H, ROOM_W, SOFA } from '../sim/room';
import { darkness, type GameTime } from '../sim/clock';
import { pumpkin } from './items';

const LINE = '#3a2a24';
type Rect = { x: number; y: number; w: number; h: number };
const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
function ink(g: CanvasRenderingContext2D, w = 3) { g.strokeStyle = LINE; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
function fill(g: CanvasRenderingContext2D, c: string, w = 3) { g.fillStyle = c; g.fill(); ink(g, w); }

export const WINDOW: Rect = { x: 470, y: 110, w: 330, h: 220 };
export const FIREPLACE = { x: 1090, w: 330, top: FLOOR_TOP - 250 };
export const CLOCK = { x: 1760, y: 210 };
/** Warm lights for drawLighting (world coordinates, radius). */
export const ROOM_LIGHTS = [
  { x: FIREPLACE.x, y: FLOOR_TOP - 60, r: 520, flicker: 1 },
  { x: 1500, y: FLOOR_TOP - 300, r: 260, flicker: .5 },
  { x: 380, y: FLOOR_TOP - 250, r: 240, flicker: .5 },
];

function grain(g: CanvasRenderingContext2D, w: number, h: number) {
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const gg = c.getContext('2d')!, r = mulberry32(31), d = gg.createImageData(96, 96);
  for (let i = 0; i < d.data.length; i += 4) { const v = 110 + r() * 90; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 22; }
  gg.putImageData(d, 0, 0);
  g.save(); g.globalCompositeOperation = 'overlay'; g.fillStyle = g.createPattern(c, 'repeat')!; g.fillRect(0, 0, w, h); g.restore();
}

function wall(g: CanvasRenderingContext2D) {
  g.fillStyle = '#4a3558'; g.fillRect(0, 0, ROOM_W, FLOOR_TOP);
  g.fillStyle = '#433050'; for (let x = 18; x < ROOM_W; x += 72) g.fillRect(x, 0, 30, FLOOR_TOP);
  // Little bats and moons in the wallpaper.
  g.fillStyle = '#5d4570';
  for (let y = 70, row = 0; y < FLOOR_TOP - 170; y += 82, row++) for (let x = 54 + (row % 2) * 36; x < ROOM_W; x += 72) {
    if (row % 2) { g.beginPath(); g.arc(x, y, 7, .6, Math.PI * 2 - .6); g.arc(x + 4, y, 6, Math.PI * 2 - .9, .9, true); g.fill(); }
    else { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 6, y - 6, x - 13, y - 3); g.quadraticCurveTo(x - 9, y, x - 11, y + 4); g.quadraticCurveTo(x - 5, y + 1, x, y + 5); g.quadraticCurveTo(x + 5, y + 1, x + 11, y + 4); g.quadraticCurveTo(x + 9, y, x + 13, y - 3); g.quadraticCurveTo(x + 6, y - 6, x, y); g.fill(); }
  }
  g.fillStyle = '#2f2238'; g.fillRect(0, 0, ROOM_W, 26); g.fillStyle = '#3a2a45'; g.fillRect(0, 26, ROOM_W, 6);
  const top = FLOOR_TOP - 150;
  g.fillStyle = '#2f2238'; g.fillRect(0, top, ROOM_W, 150);
  g.strokeStyle = '#3c2b47'; g.lineWidth = 2; for (let x = 24; x < ROOM_W; x += 48) { g.beginPath(); g.moveTo(x, top + 20); g.lineTo(x, FLOOR_TOP - 18); g.stroke(); }
  g.fillStyle = '#5a3f62'; g.fillRect(0, top, ROOM_W, 16);
  g.fillStyle = '#1f1626'; g.fillRect(0, FLOOR_TOP - 18, ROOM_W, 20);
  g.strokeStyle = LINE; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, top + 16); g.lineTo(ROOM_W, top + 16); g.moveTo(0, FLOOR_TOP - 18); g.lineTo(ROOM_W, FLOOR_TOP - 18); g.moveTo(0, FLOOR_TOP + 2); g.lineTo(ROOM_W, FLOOR_TOP + 2); g.stroke();
}

function floor(g: CanvasRenderingContext2D) {
  const r = mulberry32(197), rowH = 46, colors = ['#5a3d2e', '#523729', '#5f4232'];
  for (let y = FLOOR_TOP + 2, row = 0; y < ROOM_H; y += rowH, row++) {
    let x = -((row * 97) % 260);
    while (x < ROOM_W) {
      const len = 220 + r() * 160;
      g.fillStyle = colors[Math.floor(r() * 3)]; g.fillRect(x, y, len, rowH);
      g.strokeStyle = '#00000022'; g.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) { const gy = y + 8 + r() * (rowH - 16); g.beginPath(); g.moveTo(x + 10, gy); g.bezierCurveTo(x + len * .3, gy - 3, x + len * .6, gy + 3, x + len - 10, gy); g.stroke(); }
      g.strokeStyle = '#3a271d'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x, y + rowH - 2); g.stroke();
      x += len;
    }
    g.strokeStyle = '#3a271d'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, y); g.lineTo(ROOM_W, y); g.stroke();
  }
  const shade = g.createLinearGradient(0, FLOOR_TOP, 0, FLOOR_TOP + 110);
  shade.addColorStop(0, '#1a0f1a66'); shade.addColorStop(1, '#1a0f1a00');
  g.fillStyle = shade; g.fillRect(0, FLOOR_TOP, ROOM_W, 110);
}

function rug(g: CanvasRenderingContext2D) {
  const cx = 1040, cy = 880, rx = 540, ry = 170, n = 30;
  g.beginPath();
  for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, k = i % 2 ? 1.035 : 1; const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
  g.closePath(); fill(g, '#7a3b2a', 2.5);
  g.beginPath(); g.ellipse(cx, cy, rx * .86, ry * .82, 0, 0, Math.PI * 2); g.fillStyle = '#9a4e30'; g.fill();
  g.setLineDash([12, 10]); g.strokeStyle = '#e09a4a'; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
  // A ring of little pumpkins and stars woven in.
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, x = cx + Math.cos(a) * rx * .7, y = cy + Math.sin(a) * ry * .64;
    if (i % 2) { g.fillStyle = '#f4c45e'; g.beginPath(); for (let k = 0; k < 10; k++) { const b = k / 10 * Math.PI * 2 - Math.PI / 2, rr2 = k % 2 ? 4 : 10; g.lineTo(x + Math.cos(b) * rr2, y + Math.sin(b) * rr2 * .6); } g.fill(); }
    else { g.fillStyle = '#e8873a'; g.beginPath(); g.ellipse(x, y, 13, 8, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#6b8f3c'; g.fillRect(x - 1.5, y - 11, 3, 5); }
  }
}

function windowFrame(g: CanvasRenderingContext2D, r: Rect) {
  g.save();
  rr(g, r.x - 16, r.y - 16, r.w + 32, r.h + 32, [r.w / 2 + 16, r.w / 2 + 16, 8, 8]); fill(g, '#2a1f30');
  g.globalCompositeOperation = 'destination-out';
  rr(g, r.x, r.y, r.w, r.h, [r.w / 2, r.w / 2, 4, 4]); g.fill();
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = '#2a1f30'; g.lineWidth = 9; g.beginPath(); g.moveTo(r.x + r.w / 2, r.y); g.lineTo(r.x + r.w / 2, r.y + r.h); g.moveTo(r.x, r.y + r.h * .55); g.lineTo(r.x + r.w, r.y + r.h * .55); g.stroke();
  rr(g, r.x, r.y, r.w, r.h, [r.w / 2, r.w / 2, 4, 4]); ink(g, 2.5);
  rr(g, r.x - 34, r.y + r.h + 12, r.w + 68, 20, 6); fill(g, '#3d2c45');
  g.restore();
  // Heavy curtains, tied back.
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? r.x - 70 : r.x + r.w + 70, x1 = side < 0 ? r.x + 30 : r.x + r.w - 30, bottom = r.y + r.h + 70;
    g.beginPath(); g.moveTo(x0, r.y - 50); g.lineTo(x1, r.y - 50); g.bezierCurveTo(x1 - side * 6, r.y + r.h * .3, x0 + side * 30, r.y + r.h * .55, x0 + side * 22, bottom); g.lineTo(x0 - side * 12, bottom); g.closePath();
    fill(g, '#6e1f33');
    g.strokeStyle = '#00000030'; g.lineWidth = 2; for (let k = 1; k < 5; k++) { const fx = x0 + (x1 - x0) * k / 6; g.beginPath(); g.moveTo(fx, r.y - 46); g.quadraticCurveTo(fx + side * 6, r.y + r.h * .4, x0 + side * (12 + k * 4), bottom - 4); g.stroke(); }
    g.beginPath(); g.ellipse(x0 + side * 20, r.y + r.h * .55, 16, 8, 0, 0, Math.PI * 2); fill(g, '#d9a441', 2.5);
  }
  g.strokeStyle = '#2a1f30'; g.lineWidth = 7; g.beginPath(); g.moveTo(r.x - 90, r.y - 52); g.lineTo(r.x + r.w + 90, r.y - 52); g.stroke();
  for (const x of [r.x - 94, r.x + r.w + 94]) { g.beginPath(); g.arc(x, r.y - 52, 9, 0, Math.PI * 2); fill(g, '#d9a441', 2.5); }
}

function fireplace(g: CanvasRenderingContext2D) {
  const { x, w, top } = FIREPLACE, l = x - w / 2, floorY = FLOOR_TOP + 4;
  rr(g, l - 30, top, w + 60, floorY - top, [10, 10, 0, 0]); fill(g, '#5b5266');
  // Stones.
  const r = mulberry32(5); g.strokeStyle = '#463e50'; g.lineWidth = 2;
  for (let y = top + 14; y < floorY - 10; y += 30) for (let xx = l - 24 + (y % 60 ? 18 : 0); xx < l + w + 20; xx += 46 + r() * 10) { rr(g, xx, y, 38, 22, 6); g.stroke(); }
  rr(g, l + 40, top + 70, w - 80, floorY - top - 70, [80, 80, 0, 0]); fill(g, '#160d14');
  rr(g, l - 54, top - 26, w + 108, 30, 6); fill(g, '#4a3036');
  rr(g, l - 40, top - 4, w + 80, 12, 3); fill(g, '#3a2428', 2);
  // Logs.
  for (const [dx, a] of [[-40, .12], [36, -.12]] as const) { g.save(); g.translate(x + dx, floorY - 22); g.rotate(a); rr(g, -60, -14, 120, 28, 12); fill(g, '#6b4426', 2.5); g.beginPath(); g.ellipse(58, 0, 9, 13, 0, 0, Math.PI * 2); fill(g, '#c9935b', 2); g.restore(); }
  // Mantel: jack-o'-lanterns, a skull and candles (flames are live).
  for (const [dx, s] of [[-130, 1], [120, .8]] as const) { g.save(); g.translate(x + dx, top - 26); g.scale(s, s); pumpkin(g, 70, 50); jackFace(g, 50); g.restore(); }
  g.save(); g.translate(x + 20, top - 26); skull(g); g.restore();
  for (const dx of [-60, 60]) { rr(g, x + dx - 7, top - 74, 14, 48, 3); fill(g, '#efe6d2', 2.5); }
  // A painting of a ghost cat above.
  rr(g, x - 92, top - 230, 184, 150, 8); fill(g, '#8a6a3a');
  g.fillStyle = '#20172b'; g.fillRect(x - 76, top - 214, 152, 118);
  g.fillStyle = '#e9e4f7'; g.beginPath(); g.moveTo(x - 30, top - 110); g.quadraticCurveTo(x - 36, top - 180, x, top - 184); g.quadraticCurveTo(x + 36, top - 180, x + 30, top - 110);
  g.quadraticCurveTo(x + 15, top - 120, x, top - 108); g.quadraticCurveTo(x - 15, top - 120, x - 30, top - 110); g.fill();
  g.beginPath(); g.moveTo(x - 26, top - 166); g.lineTo(x - 30, top - 196); g.lineTo(x - 10, top - 178); g.moveTo(x + 26, top - 166); g.lineTo(x + 30, top - 196); g.lineTo(x + 10, top - 178); g.fill();
  g.fillStyle = '#20172b'; for (const dx of [-12, 12]) { g.beginPath(); g.ellipse(x + dx, top - 156, 4, 6, 0, 0, Math.PI * 2); g.fill(); }
}
function jackFace(g: CanvasRenderingContext2D, h: number) {
  g.fillStyle = '#ffcf5a';
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * h * .32, -h * .62); g.lineTo(s * h * .12, -h * .62); g.lineTo(s * h * .22, -h * .8); g.closePath(); g.fill(); }
  g.beginPath(); g.moveTo(-h * .38, -h * .38); g.quadraticCurveTo(0, -h * .1, h * .38, -h * .38); g.lineTo(h * .2, -h * .3); g.lineTo(h * .1, -h * .4); g.lineTo(0, -h * .28); g.lineTo(-h * .1, -h * .4); g.lineTo(-h * .2, -h * .3); g.closePath(); g.fill();
}
function skull(g: CanvasRenderingContext2D) {
  g.beginPath(); g.moveTo(-18, 0); g.lineTo(-18, -14); g.quadraticCurveTo(-24, -44, 0, -46); g.quadraticCurveTo(24, -44, 18, -14); g.lineTo(18, 0); g.closePath(); fill(g, '#efe9da', 2.5);
  g.fillStyle = '#2a1f30'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 8, -24, 6, 7, 0, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.moveTo(0, -16); g.lineTo(-3, -10); g.lineTo(3, -10); g.closePath(); g.fill();
  g.strokeStyle = '#2a1f30'; g.lineWidth = 2; for (const xx of [-8, 0, 8]) { g.beginPath(); g.moveTo(xx, -6); g.lineTo(xx, 0); g.stroke(); }
}

function sofa(g: CanvasRenderingContext2D) {
  const x0 = SOFA.x0 - 40, x1 = SOFA.x1 + 40, w = x1 - x0, seatY = FLOOR_TOP + 40;
  const main = '#5b2a4a', light = '#7a3d63', shade = '#43203a';
  rr(g, x0 + 20, seatY - 150, w - 40, 120, [40, 40, 10, 10]); fill(g, main);
  g.fillStyle = light; for (const k of [0, 1]) { rr(g, x0 + 44 + k * (w - 88) / 2, seatY - 130, (w - 100) / 2, 80, 22); g.fill(); ink(g, 2); }
  rr(g, x0 + 28, seatY - 52, w - 56, 34, 12); fill(g, light, 2.5);
  rr(g, x0 + 24, seatY - 22, w - 48, 46, 10); fill(g, main);
  for (const x of [x0, x1 - 60]) { rr(g, x, seatY - 96, 60, 120, 24); fill(g, shade); rr(g, x + 4, seatY - 96, 52, 28, 14); fill(g, main, 2); }
  g.fillStyle = '#2a1a22'; for (const x of [x0 + 20, x1 - 36]) { rr(g, x, seatY + 22, 16, 14, 3); g.fill(); ink(g, 2); }
  // A cushion with a bat on it.
  g.save(); g.translate(x0 + w * .7, seatY - 60); g.rotate(.1); rr(g, -36, -26, 72, 52, 16); fill(g, '#e98a3a', 2.5); g.fillStyle = '#2b1f2e';
  g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(-8, -12, -20, -8); g.quadraticCurveTo(-14, -2, -16, 6); g.quadraticCurveTo(-8, 2, 0, 8); g.quadraticCurveTo(8, 2, 16, 6); g.quadraticCurveTo(14, -2, 20, -8); g.quadraticCurveTo(8, -12, 0, -4); g.fill(); g.restore();
}

function bookcase(g: CanvasRenderingContext2D) {
  const x = 1400, w = 220, h = 330, floorY = FLOOR_TOP + 4, r = mulberry32(17);
  rr(g, x, floorY - h, w, h, 6); fill(g, '#4b3226');
  g.fillStyle = '#2e1e17'; g.fillRect(x + 12, floorY - h + 12, w - 24, h - 24);
  for (let i = 1; i <= 3; i++) {
    const y = floorY - h + 12 + i * ((h - 24) / 3);
    g.fillStyle = '#5a3d2e'; g.fillRect(x + 8, y - 8, w - 16, 10); g.strokeStyle = LINE; g.lineWidth = 2; g.strokeRect(x + 8, y - 8, w - 16, 10);
    let cx = x + 20;
    while (cx < x + w - 40) {
      if (r() < .3) {
        // A potion bottle.
        const c = ['#7fe08a', '#b77fe0', '#e05f7f'][Math.floor(r() * 3)];
        g.beginPath(); g.arc(cx + 12, y - 22, 13, 0, Math.PI * 2); fill(g, c, 2); rr(g, cx + 7, y - 46, 10, 14, 2); fill(g, '#cfc4b0', 2); cx += 34;
      } else {
        const bw = 14 + r() * 8, bh = 50 + r() * 26; rr(g, cx, y - 8 - bh, bw, bh, 2); fill(g, ['#6b2b3a', '#2f4a4a', '#5a4a2a', '#3d2f5a'][Math.floor(r() * 4)], 2); cx += bw + 3;
      }
    }
  }
}

function grandfatherClock(g: CanvasRenderingContext2D) {
  const { x, y } = CLOCK, floorY = FLOOR_TOP + 4;
  rr(g, x - 60, y - 80, 120, floorY - y + 80, [50, 50, 6, 6]); fill(g, '#4b2f22');
  rr(g, x - 40, y + 70, 80, floorY - y - 110, 6); fill(g, '#2a1a14', 2.5);
  g.beginPath(); g.arc(x, y, 46, 0, Math.PI * 2); fill(g, '#efe6cf', 2.5);
  g.fillStyle = LINE; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 38, y + Math.sin(a) * 38, i % 3 ? 2 : 3.5, 0, Math.PI * 2); g.fill(); }
}

function cobwebs(g: CanvasRenderingContext2D) {
  g.strokeStyle = '#d8d0e8aa'; g.lineWidth = 1.6;
  for (const [cx, dir] of [[0, 1], [ROOM_W, -1]] as const) {
    const R = 190;
    for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI / 2; g.beginPath(); g.moveTo(cx, 26); g.lineTo(cx + dir * Math.cos(a) * R, 26 + Math.sin(a) * R); g.stroke(); }
    for (let ring = 1; ring <= 4; ring++) {
      g.beginPath();
      for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI / 2, rr2 = R * ring / 4.4; const px = cx + dir * Math.cos(a) * rr2, py = 26 + Math.sin(a) * rr2; if (!k) g.moveTo(px, py); else g.quadraticCurveTo(cx + dir * Math.cos(a - .13) * rr2 * .9, 26 + Math.sin(a - .13) * rr2 * .9, px, py); }
      g.stroke();
    }
  }
  // A spider on a thread.
  g.beginPath(); g.moveTo(150, 26); g.lineTo(150, 170); g.stroke();
  g.fillStyle = '#1c1420'; g.beginPath(); g.arc(150, 178, 9, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1c1420'; g.lineWidth = 2; for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(150, 178); g.quadraticCurveTo(150 + s * 14, 168 + k * 6, 150 + s * 18, 182 + k * 6); g.stroke(); }
}

function garland(g: CanvasRenderingContext2D) {
  const x0 = 80, x1 = ROOM_W - 80, y = 44;
  g.strokeStyle = LINE; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + x1) / 2, y + 70, x1, y); g.stroke();
  const n = 30;
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, x = x0 + (x1 - x0) * t, yy = y + 140 * t * (1 - t);
    g.beginPath(); g.moveTo(x - 17, yy); g.lineTo(x + 17, yy); g.lineTo(x, yy + 34); g.closePath(); fill(g, ['#f08a2c', '#2b1f2e', '#7d4b9c'][i % 3], 2);
    if (i % 3 === 1) { g.fillStyle = '#f08a2c'; g.beginPath(); g.arc(x - 4, yy + 10, 2, 0, Math.PI * 2); g.arc(x + 4, yy + 10, 2, 0, Math.PI * 2); g.fill(); }
  }
}

function floorDecor(g: CanvasRenderingContext2D) {
  // Pumpkins by the walls, whole and not cut by the room's edge.
  for (const [x, y, s] of [[90, FLOOR_TOP + 70, 1.1], [1890, FLOOR_TOP + 80, 1], [1950, FLOOR_TOP + 120, .7], [700, FLOOR_TOP + 40, .8]] as const) {
    g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = '#0000003a'; g.beginPath(); g.ellipse(0, 0, 50, 10, 0, 0, Math.PI * 2); g.fill(); pumpkin(g, 84, 60); jackFace(g, 60); g.restore();
  }
}

export interface RoomArt { canvas: HTMLCanvasElement; res: number }
export function paintRoom(res = 1): RoomArt {
  const c = document.createElement('canvas'); c.width = Math.round(ROOM_W * res); c.height = Math.round(ROOM_H * res);
  const g = c.getContext('2d')!; g.scale(res, res);
  wall(g); floor(g); rug(g);
  // The window's glass is cut out after everything on the wall, so the live sky shows through it.
  windowFrame(g, WINDOW);
  fireplace(g); bookcase(g); grandfatherClock(g); sofa(g); cobwebs(g); garland(g); floorDecor(g);
  grain(g, ROOM_W, ROOM_H);
  g.save(); g.globalCompositeOperation = 'destination-out'; rr(g, WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, [WINDOW.w / 2, WINDOW.w / 2, 4, 4]); g.fill(); g.restore();
  // Re-ink the panes over the hole.
  g.strokeStyle = '#2a1f30'; g.lineWidth = 9; g.beginPath(); g.moveTo(WINDOW.x + WINDOW.w / 2, WINDOW.y); g.lineTo(WINDOW.x + WINDOW.w / 2, WINDOW.y + WINDOW.h); g.moveTo(WINDOW.x, WINDOW.y + WINDOW.h * .55); g.lineTo(WINDOW.x + WINDOW.w, WINDOW.y + WINDOW.h * .55); g.stroke();
  return { canvas: c, res };
}

/** The sky behind the window (drawn before the room picture). */
export function drawSky(g: CanvasRenderingContext2D, clock: GameTime, time: number) {
  const r = WINDOW, d = darkness(clock.hours);
  const top = d > .6 ? '#120b26' : d > .35 ? '#3b2a5c' : '#6d6a8f', bottom = d > .6 ? '#3b1f4a' : d > .35 ? '#c0603a' : '#a39bb3';
  const sky = g.createLinearGradient(0, r.y, 0, r.y + r.h); sky.addColorStop(0, top); sky.addColorStop(1, bottom);
  g.fillStyle = sky; g.fillRect(r.x - 10, r.y - 10, r.w + 20, r.h + 20);
  if (d > .45) {
    g.fillStyle = '#fff8e0'; const rnd = mulberry32(9);
    for (let i = 0; i < 30; i++) { const x = r.x + rnd() * r.w, y = r.y + rnd() * r.h * .7, tw = .5 + .5 * Math.sin(time * 2 + i); g.globalAlpha = tw * (d - .4); g.fillRect(x, y, 2, 2); }
    g.globalAlpha = 1;
  }
  // The big moon, rising through the night.
  const mx = r.x + r.w * .66, my = r.y + 70 + Math.sin(clock.hours / 24 * Math.PI * 2) * 12;
  g.fillStyle = '#fff1c4'; g.globalAlpha = .25; g.beginPath(); g.arc(mx, my, 70, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  g.fillStyle = d > .4 ? '#fff1c4' : '#f4ecd6'; g.beginPath(); g.arc(mx, my, 46, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8d9a8'; for (const [dx, dy, rr2] of [[-14, -8, 9], [10, 12, 6], [16, -16, 5]]) { g.beginPath(); g.arc(mx + dx, my + dy, rr2, 0, Math.PI * 2); g.fill(); }
  // Hills and a dead tree.
  g.fillStyle = '#140c1a'; g.beginPath(); g.moveTo(r.x - 10, r.y + r.h + 10); g.lineTo(r.x - 10, r.y + r.h - 50); g.quadraticCurveTo(r.x + r.w * .3, r.y + r.h - 90, r.x + r.w * .6, r.y + r.h - 46); g.quadraticCurveTo(r.x + r.w * .85, r.y + r.h - 20, r.x + r.w + 10, r.y + r.h - 60); g.lineTo(r.x + r.w + 10, r.y + r.h + 10); g.fill();
  g.strokeStyle = '#140c1a'; g.lineWidth = 6; g.beginPath(); g.moveTo(r.x + 70, r.y + r.h - 70); g.lineTo(r.x + 76, r.y + r.h - 150); g.lineTo(r.x + 50, r.y + r.h - 190); g.moveTo(r.x + 76, r.y + r.h - 130); g.lineTo(r.x + 110, r.y + r.h - 165); g.stroke();
  // Bats crossing the moon.
  g.fillStyle = '#140c1a';
  for (let i = 0; i < 4; i++) {
    const u = ((time * .05 + i * .27) % 1), bx = r.x - 20 + u * (r.w + 40), by = r.y + 50 + i * 26 + Math.sin(time * 3 + i) * 10, f = Math.sin(time * 14 + i * 2) * 6;
    g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx - 7, by - 6 - f, bx - 15, by - 2 - f); g.quadraticCurveTo(bx - 8, by + 1, bx, by + 4); g.quadraticCurveTo(bx + 8, by + 1, bx + 15, by - 2 - f); g.quadraticCurveTo(bx + 7, by - 6 - f, bx, by); g.fill();
  }
}

/** Fire, mantel candle flames, the clock's hands. */
export function drawRoomLive(g: CanvasRenderingContext2D, clock: GameTime, time: number) {
  const { x, top } = FIREPLACE, floorY = FLOOR_TOP + 4;
  for (let i = 0; i < 5; i++) {
    const fx = x - 60 + i * 30, h = 70 + Math.sin(time * 7 + i * 1.7) * 14 + Math.sin(time * 13 + i) * 8;
    g.fillStyle = i % 2 ? '#ff7a1a' : '#ffa53a'; g.beginPath(); g.moveTo(fx - 22, floorY - 28); g.quadraticCurveTo(fx - 16, floorY - 28 - h * .6, fx + Math.sin(time * 5 + i) * 6, floorY - 28 - h); g.quadraticCurveTo(fx + 16, floorY - 28 - h * .6, fx + 22, floorY - 28); g.fill();
  }
  g.fillStyle = '#ffe08a'; g.beginPath(); g.ellipse(x, floorY - 40, 50, 20, 0, 0, Math.PI * 2); g.fill();
  for (const dx of [-60, 60]) {
    const fy = top - 76, f = 1 + Math.sin(time * 11 + dx) * .1;
    g.fillStyle = '#ffb347'; g.beginPath(); g.ellipse(x + dx, fy - 6 * f, 5, 9 * f, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff1b8'; g.beginPath(); g.ellipse(x + dx, fy - 4 * f, 2.5, 5 * f, 0, 0, Math.PI * 2); g.fill();
  }
  // The jack-o'-lanterns glow.
  for (const [dx, s] of [[-130, 1], [120, .8]] as const) { g.save(); g.globalAlpha = .35 + .15 * Math.sin(time * 6 + dx); g.fillStyle = '#ffcf5a'; g.beginPath(); g.arc(x + dx, top - 26 - 25 * s, 30 * s, 0, Math.PI * 2); g.fill(); g.restore(); }
  // Clock hands follow the arcade clock.
  const { x: cx, y: cy } = CLOCK, hA = ((clock.hours % 12) / 12) * Math.PI * 2 - Math.PI / 2, mA = (clock.minute / 60) * Math.PI * 2 - Math.PI / 2;
  g.strokeStyle = LINE; g.lineCap = 'round';
  g.lineWidth = 5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(hA) * 22, cy + Math.sin(hA) * 22); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(mA) * 34, cy + Math.sin(mA) * 34); g.stroke();
  // The pendulum.
  const sw = Math.sin(time * 2.4) * .25;
  g.save(); g.translate(cx, cy + 80); g.rotate(sw); g.strokeStyle = '#d9a441'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 100); g.stroke();
  g.beginPath(); g.arc(0, 110, 14, 0, Math.PI * 2); g.fillStyle = '#d9a441'; g.fill(); g.strokeStyle = LINE; g.lineWidth = 2.5; g.stroke(); g.restore();
}

/**
 * Darkness over the whole view by the hour, with warm holes around the lights. Drawn in screen
 * space by the renderer through a scratch canvas.
 */
export function drawLighting(g: CanvasRenderingContext2D, w: number, h: number, toScreen: (x: number, y: number) => { x: number; y: number }, zoom: number, hours: number, time: number, extra: { x: number; y: number; r: number }[]) {
  const d = darkness(hours);
  g.save();
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = `rgba(16, 8, 34, ${(.12 + d * .5).toFixed(3)})`; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out';
  for (const L of [...ROOM_LIGHTS, ...extra.map(e => ({ ...e, flicker: .6 }))]) {
    const p = toScreen(L.x, L.y), r = L.r * zoom * (1 + Math.sin(time * 9 + L.x) * .03 * ('flicker' in L ? L.flicker : 1));
    const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grd.addColorStop(0, `rgba(0,0,0,${(.25 + d * .55).toFixed(3)})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  // Warm glow on top.
  g.globalCompositeOperation = 'lighter';
  for (const L of [...ROOM_LIGHTS, ...extra]) {
    const p = toScreen(L.x, L.y), r = L.r * zoom * .8;
    const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grd.addColorStop(0, `rgba(255,140,50,${(.05 + d * .12).toFixed(3)})`); grd.addColorStop(1, 'rgba(255,140,50,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
