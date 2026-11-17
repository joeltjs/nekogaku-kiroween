/**
 * Draws the house: camera over the one room, the room picture, items and cats sorted by depth,
 * costumes, particles, the ball and the feather, then the hour's darkness with warm lights.
 */
import { drawCat } from './art/cat-rig';
import { liftPhase } from './art/cat-clips';
import { drawBarbell } from './art/gym-props';
import { drawEmote } from './art/emote';
import { clamp } from './core/math';
import { drawCostume, type Anchors } from './halloween/costumes';
import { ITEMS, type ItemId } from './halloween/items';
import { WINDOW, drawLighting, drawRoomLive, drawSky, paintRoom, type RoomArt } from './halloween/room-art';
import { ROOM_H, ROOM_W, type Pt } from './sim/room';
import { CAT_SCALE, type Cat, type Placed, type World } from './sim/world';

/** Confetti colours: pumpkin, candle, ghost-lilac, bat-green, blood-red. */
const CONFETTI = ['#ff8a3d', '#ffd25e', '#c9b8ff', '#9dffb0', '#e0455c'];

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  vw = 0; vh = 0; dpr = 1; zoom = 1;
  camX = 0; camY = 0;
  private art?: RoomArt;
  private light = document.createElement('canvas');
  /** Shown while choosing where to put an item. */
  ghost: { id: ItemId; x: number; y: number } | null = null;
  selected: string | null = null;

  constructor(readonly canvas: HTMLCanvasElement, readonly world: World) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    this.camX = (ROOM_W - this.vw / this.zoom) / 2;
    this.camY = Math.max(0, ROOM_H - this.vh / this.zoom) * .55;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.vw = Math.max(1, r.width); this.vh = Math.max(1, r.height); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.vw * this.dpr); this.canvas.height = Math.round(this.vh * this.dpr);
    this.light.width = this.canvas.width; this.light.height = this.canvas.height;
    // Fill the screen with the room: the whole height shows; on narrow screens you pan sideways.
    // A little closer than the whole room, so the cats read well; drag to look around.
    this.zoom = Math.max(this.vh / ROOM_H * 1.18, this.vw / ROOM_W);
    const res = clamp(this.zoom * this.dpr, .5, 1.5);
    if (!this.art || Math.abs(this.art.res - res) > .2) this.art = paintRoom(res);
    this.pan(0, 0);
  }
  pan(dx: number, dy: number) {
    this.camX = clamp(this.camX - dx / this.zoom, 0, Math.max(0, ROOM_W - this.vw / this.zoom));
    this.camY = clamp(this.camY - dy / this.zoom, 0, Math.max(0, ROOM_H - this.vh / this.zoom));
  }
  /** Brings a world point into view (for following the gym cat). */
  lookAt(x: number) { this.camX = clamp(x - this.vw / this.zoom / 2, 0, Math.max(0, ROOM_W - this.vw / this.zoom)); }
  toWorld(sx: number, sy: number): Pt { return { x: sx / this.zoom + this.camX, y: sy / this.zoom + this.camY }; }
  toScreen = (x: number, y: number): Pt => ({ x: (x - this.camX) * this.zoom, y: (y - this.camY) * this.zoom });

  draw(feather: Pt | null) {
    const g = this.ctx, w = this.world, clock = w.clock, t = w.time;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#0f0a14'; g.fillRect(0, 0, this.vw, this.vh);
    g.save(); g.scale(this.zoom, this.zoom); g.translate(-this.camX, -this.camY);
    g.save(); g.beginPath(); g.roundRect(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, [WINDOW.w / 2, WINDOW.w / 2, 4, 4]); g.clip(); drawSky(g, clock, t); g.restore();
    if (this.art) g.drawImage(this.art.canvas, 0, 0, ROOM_W, ROOM_H);
    drawRoomLive(g, clock, t);

    // Depth order: everything by its ground y. An item a cat sits in draws its front after the cat.
    const list: { y: number; fn: () => void }[] = [];
    for (const it of w.items) {
      if (it.worn) continue;
      const def = ITEMS[it.id];
      list.push({ y: def.front ? it.y - 50 : it.y, fn: () => this.drawItem(it) });
      if (def.front) list.push({ y: it.y + 1, fn: () => { g.save(); g.translate(it.x, it.y); def.front!(g, t); g.restore(); } });
    }
    for (const c of w.cats) if (c.act.k !== 'held') list.push({ y: c.y + (c.z > 20 ? 10 : 0), fn: () => this.drawCatEntity(c) });
    if (w.ball) { const b = w.ball; list.push({ y: b.y, fn: () => this.drawBall(b.x, b.y, b.z) }); }
    list.sort((a, b) => a.y - b.y);
    for (const e of list) e.fn();
    if (this.ghost) { g.save(); g.globalAlpha = .6; g.translate(this.ghost.x, this.ghost.y); ITEMS[this.ghost.id].draw(g, t); ITEMS[this.ghost.id].front?.(g, t); g.restore(); }
    for (const c of w.cats) if (c.act.k === 'held') this.drawCatEntity(c);
    this.drawParticles();
    if (feather) this.drawFeather(feather);
    g.restore();

    // The hour's darkness, with warm light around the fire, lamps and candles.
    const lg = this.light.getContext('2d')!;
    lg.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); lg.clearRect(0, 0, this.vw, this.vh);
    const candles = w.items.filter(i => ITEMS[i.id].light).map(i => ({ x: i.x, y: i.y + ITEMS[i.id].light!.dy, r: ITEMS[i.id].light!.r }));
    drawLighting(lg, this.vw, this.vh, this.toScreen, this.zoom, clock.hours, t, candles);
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(this.light, 0, 0);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // A soft vignette for the haunted feel.
    const v = g.createRadialGradient(this.vw / 2, this.vh / 2, Math.min(this.vw, this.vh) * .35, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * .75);
    v.addColorStop(0, 'rgba(10,4,16,0)'); v.addColorStop(1, 'rgba(10,4,16,.55)');
    g.fillStyle = v; g.fillRect(0, 0, this.vw, this.vh);
  }

  private drawItem(it: Placed) {
    const g = this.ctx, def = ITEMS[it.id];
    if (this.selected === it.uid) { g.save(); g.setLineDash([10, 8]); g.strokeStyle = '#ffcf5a'; g.lineWidth = 3; g.beginPath(); g.ellipse(it.x, it.y, def.hw + 18, 22, 0, 0, Math.PI * 2); g.stroke(); g.restore(); }
    g.save(); g.translate(it.x, it.y); def.draw(g, this.world.time); g.restore();
  }

  /** A ghost hovers a little above the floor (drawing only; the simulation keeps it on the ground). */
  hover(c: Cat) { return c.costume === 'ghost' && c.act.k !== 'use' && c.act.k !== 'held' ? 26 + Math.sin(this.world.time * 2.4 + c.seed) * 8 : 0; }
  anchors(c: Cat): Anchors {
    const s = this.world.shapes(c), h = this.hover(c), up = <T extends { y: number }>(p: T): T => ({ ...p, y: p.y - h });
    return { head: up(s.head), neck: up(s.neck), body: up(s.body), mouth: up(s.mouth), tail: up(s.tail), feet: { x: c.x, y: c.y - c.z - h }, facing: c.facing, tilt: (c.pose.headRot ?? 0) * c.facing * (c.pose.front >= .5 ? -1 : 1), front: c.pose.front >= .5, time: this.world.time + c.seed, asleep: this.world.isAsleep(c), flying: this.world.isFlying(c) };
  }

  drawCatEntity(c: Cat) {
    const g = this.ctx, w = this.world, phys = w.phys(c), unit = CAT_SCALE * phys.scale;
    // Shadow on the floor (or on the sofa / tower top it stands on).
    const ground = c.act.k === 'use' || c.act.k === 'sofa' ? c.z : 0, lift = Math.max(0, c.z - ground);
    g.fillStyle = `rgba(10,4,16,${(.32 * (1 - Math.min(.7, lift / 200))).toFixed(3)})`;
    g.beginPath(); g.ellipse(c.x, c.y - ground, 46 * unit * (1 - Math.min(.5, lift / 300)), 11 * unit, 0, 0, Math.PI * 2); g.fill();
    const a = this.anchors(c), hover = this.hover(c);
    if (c.costume) drawCostume(g, c.costume, 'back', a);
    g.save();
    if (c.costume === 'ghost') g.globalAlpha = .9;
    g.translate(c.x, c.y - c.z - hover);
    g.scale(Math.max(.82, Math.abs(c.turn)), 1);
    let clipBelow: number | undefined;
    if (c.act.k === 'use') { const it = w.items.find(i => i.uid === (c.act as { item: string }).item), rim = it && ITEMS[it.id].use.rim; if (it && rim) clipBelow = ((it.y - rim) - (c.y - c.z)) / unit; }
    const lifting = c.clip === 'lift';
    const props = lifting ? (cx: CanvasRenderingContext2D, paws: { near: Pt; far: Pt }) => { const ph = liftPhase(c.clipT); drawBarbell(cx, paws.near, paws.far, ph.resting ? 0 : ph.up * (ph.c > .3 && ph.c < .65 ? 1 : .4)); } : undefined;
    drawCat(g, c.pose, c.look, phys, { facing: c.facing, scale: CAT_SCALE, blink: c.blink, time: w.time + c.seed, clipBelow, props });
    g.restore();
    if (c.costume) drawCostume(g, c.costume, 'front', a);
    if (c.act.k === 'held') this.drawHand(c);
    if (c.emote) {
      const e = c.emote, f = c.facing, bob = Math.sin(w.time * 5 + c.seed) * 1.5;
      if (e.kind === 'sweat') drawEmote(g, e.kind, a.head.x + a.head.r * .98 * f, a.head.y - a.head.r * .5, a.head.r * .5, e.age, e.dur);
      else drawEmote(g, e.kind, a.head.x + a.head.r * 1.2 * f, a.head.y - a.head.r * 1.45 + bob, a.head.r * .62, e.age, e.dur);
    }
  }

  private drawHand(c: Cat) {
    const g = this.ctx, s = this.world.shapes(c), n = s.neck, k = s.scale * 1.2;
    g.save(); g.strokeStyle = '#211c1c'; g.lineWidth = 3; g.lineJoin = 'round';
    g.fillStyle = '#4b3a63'; g.beginPath(); g.roundRect(n.x - 14 * k, n.y - 120 * k, 28 * k, 100 * k, 10 * k); g.fill(); g.stroke();
    g.fillStyle = '#f2d2b8'; g.beginPath(); g.ellipse(n.x, n.y - 14 * k, 18 * k, 14 * k, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.restore();
  }

  drawBall(x: number, y: number, z: number) {
    const g = this.ctx, r = 17;
    g.fillStyle = 'rgba(10,4,16,.3)'; g.beginPath(); g.ellipse(x, y, r * (1 - Math.min(.5, z / 300)), 5, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(x, y - z - r); g.rotate(x / 20);
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fillStyle = '#f08a2c'; g.fill();
    g.save(); g.clip(); g.fillStyle = '#2b1f2e'; g.fillRect(-r, -4, r * 2, 8); g.restore();
    g.strokeStyle = '#211c1c'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  private drawFeather(p: Pt) {
    const g = this.ctx, t = this.world.time, sway = Math.sin(t * 6) * .25;
    g.save(); g.strokeStyle = '#6e4a2c'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(p.x + 180, p.y - 300); g.quadraticCurveTo(p.x + 90, p.y - 140, p.x, p.y - 10); g.stroke();
    g.translate(p.x, p.y); g.rotate(.4 + sway);
    for (const [c, a] of [['#7d4b9c', -.3], ['#f08a2c', .1], ['#2b1f2e', .45]] as const) {
      g.save(); g.rotate(a); g.beginPath(); g.ellipse(0, 24, 8, 26, 0, 0, Math.PI * 2); g.fillStyle = c; g.fill(); g.strokeStyle = '#211c1c'; g.lineWidth = 2; g.stroke(); g.restore();
    }
    g.restore();
  }

  private drawParticles() {
    const g = this.ctx;
    for (const p of this.world.particles) {
      const u = p.age / p.life, a = 1 - u * u;
      g.save(); g.globalAlpha = a; g.translate(p.x, p.y);
      if (p.kind === 'heart') { const s = 9 + u * 4; g.fillStyle = '#ff6b8a'; g.beginPath(); g.moveTo(0, s * .9); g.bezierCurveTo(-s * 1.4, -s * .2, -s * .6, -s * 1.3, 0, -s * .4); g.bezierCurveTo(s * .6, -s * 1.3, s * 1.4, -s * .2, 0, s * .9); g.fill(); g.strokeStyle = '#211c1c'; g.lineWidth = 2; g.stroke(); }
      else if (p.kind === 'zzz') { g.fillStyle = '#d9d0ff'; g.font = '800 26px system-ui, sans-serif'; g.fillText('z', 0, 0); }
      else if (p.kind === 'exp') { g.font = '900 28px system-ui, sans-serif'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = '#211c1c'; g.strokeText(p.text ?? '', 0, 0); g.fillStyle = '#9dffb0'; g.fillText(p.text ?? '', 0, 0); }
      else if (p.kind === 'spark') { g.fillStyle = '#ffd25e'; g.beginPath(); for (let i = 0; i < 8; i++) { const b = i / 8 * Math.PI * 2, r = i % 2 ? 4 : 11; g.lineTo(Math.cos(b) * r, Math.sin(b) * r); } g.fill(); }
      else if (p.kind === 'puff') { g.fillStyle = '#e9e4f7'; g.beginPath(); g.arc(0, 0, 10 + u * 18, 0, Math.PI * 2); g.fill(); }
      else if (p.kind === 'note') { g.fillStyle = '#ffcf5a'; g.font = '800 26px system-ui, sans-serif'; g.fillText('♪', 0, 0); }
      else if (p.kind === 'confetti') { g.rotate(p.age * 7 + p.x); g.fillStyle = CONFETTI[Math.abs(Math.floor(p.x)) % CONFETTI.length]; g.fillRect(-7, -4, 14, 8); }
      g.restore();
    }
  }
}
