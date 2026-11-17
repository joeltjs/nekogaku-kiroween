/**
 * The house's simulation: three cats, placed items, the ball, the feather, a gym set, particles.
 * Cats only have EXP and Love (R6). Poses come from the rig's clips, blended on every change,
 * with faces from the emotion layer.
 */
import { CAT_IDS, LOOKS, idealWeight, physique, type CatId, type CatLook, type Physique } from '../art/cat-look';
import { catShapes, lerpPose, type Pose } from '../art/cat-rig';
import { SLEEP_CLIPS, sampleClip, type ClipName } from '../art/cat-clips';
import { GAITS, gaitCycle } from '../art/cat-frames';
import { changeEmotion, emotionFace, newEmotion, type EmotionId, type EmotionState } from '../art/cat-emotion';
import type { EmoteKind } from '../art/emote';
import { approach, clamp, dist, mulberry32, smooth } from '../core/math';
import { COSTUMES, ITEMS, isItemId, type CostumeId, type ItemId } from '../halloween/items';
import { arcadeClock, type GameTime } from './clock';
import { COSTUME_SECONDS, GYM_SET_EXP, GYM_SET_LOVE, PET_LOVE, PLAY_LOVE, clampExp, clampLove, expFor, levelOf } from './progress';
import { GYM_SPOT, SOFA, WALK, clampToFloor, type Pt } from './room';
import { think } from './brain';
import { isItemUnlocked } from './unlock';
import { SLOT_COUNT, cleanSlots, openSlot, slotCount, slotPerkLove } from './album';

export const CAT_SCALE = 1.4;
/** Seconds the costume banner stays on screen before the slot banner (main.ts: 3.4 s plus a 0.4 s fade). */
const SLOT_BANNER_DELAY = 3.8;
export const CAT_NAMES: Record<CatId, string> = { cecil: 'Cecil', kuku: 'Kuku', bolu: 'Bolu' };
export const CAT_BLURBS: Record<CatId, string> = {
  cecil: 'The first cat of the house. White coat, grey-brown cap, a sour face that hides a soft heart.',
  kuku: 'A calico with the biggest eyes in the house. Spoilt, clingy, and a little naughty.',
  bolu: 'A golden tabby who never says no to a snack, a nap, or a barbell.',
};
/** Every cat starts as a kitten (level 1); they grow with EXP. */
const START_LEVEL: Record<CatId, number> = { cecil: 1, kuku: 1, bolu: 1 };

export type Act =
  | { k: 'idle'; until: number }
  | { k: 'walk'; to: Pt; run: boolean; then: Act }
  | { k: 'hop'; z0: number; z1: number; y0: number; y1: number; t: number; dur: number; then: Act }
  | { k: 'use'; item: string; until: number }
  | { k: 'sofa'; until: number }
  | { k: 'pet'; until: number; then: Act }
  | { k: 'chase' }
  | { k: 'feather'; step: 'stalk' | 'crouch' | 'pounce' | 'bat'; t: number; until: number }
  | { k: 'gym'; t: number; dur: number }
  | { k: 'held' }
  | { k: 'fall'; vz: number }
  | { k: 'land'; until: number }
  /** Flying (bat wings, the broom): `legs` more swoops to random spots, then down. */
  | { k: 'fly'; to: Pt; legs: number; t: number };

export interface Cat {
  id: CatId; name: string; look: CatLook;
  exp: number; love: number;
  /** Only while dressed up by a costume item (R7); null the rest of the time. */
  costume: CostumeId | null; costumeUntil: number;
  x: number; y: number; z: number; facing: 1 | -1; turn: number;
  clip: ClipName; clipT: number; phase: number; seed: number; intensity: number;
  pose: Pose; from: Pose | null; blendT: number; blendDur: number;
  blink: number; blinkTimer: number;
  emo: EmotionState;
  act: Act;
  emote?: { kind: EmoteKind; age: number; dur: number };
  lastPet: number; lastPlay: number; batCount: number;
  tailSway: number; tailVel: number; lastX: number;
}
export interface Placed { uid: string; id: ItemId; x: number; y: number; /** Carried by this cat while it wears it. */ worn?: CatId }
export interface Ball { x: number; y: number; z: number; vx: number; vy: number; vz: number; rest: number }
export type ParticleKind = 'heart' | 'zzz' | 'spark' | 'note' | 'puff' | 'exp' | 'confetti';
export interface Particle { kind: ParticleKind; x: number; y: number; vx: number; vy: number; life: number; age: number; text?: string }

export interface WorldEvents {
  sound(id: 'meow' | 'purr' | 'pop' | 'boing' | 'bat' | 'land' | 'whoosh' | 'clank' | 'sparkle' | 'levelup' | 'howl' | 'poof' | 'flap', catId?: CatId): void;
  banner(title: string, text: string): void;
  /** A cat just dressed up (the house says the costume's Japanese word). */
  costume?(cat: Cat, id: CostumeId): void;
}

const quiet: WorldEvents = { sound() { /* none */ }, banner() { /* none */ } };

export class World {
  cats: Cat[];
  items: Placed[] = [];
  ball: Ball | null = null;
  feather: Pt | null = null;
  particles: Particle[] = [];
  /** Seconds of simulation since this page opened (animation time). */
  time = 0;
  /** Play time in ms over the house's whole life (drives the arcade clock). */
  playMs = 0;
  /** Album slots opened so far, as `cat:costume` keys (see album.ts). */
  albumSlots: string[] = [];
  /** Moments scheduled for a later game time (the slot celebration waits for its banner). */
  private later: { at: number; run: () => void }[] = [];
  private runLater() {
    if (!this.later.length) return;
    const due = this.later.filter(l => l.at <= this.time);
    this.later = this.later.filter(l => l.at > this.time);
    for (const l of due) l.run();
  }
  /** Today's EXP from play, capped (R3.3). */
  playExp = { day: 1, exp: 0 };
  /** Tracks whose mock exam was passed with PASS_PERCENT or more (from the server). */
  examsPassed: string[] = [];
  itemUnlocked(id: ItemId) { return isItemUnlocked(id, this.examsPassed); }
  rand = mulberry32(Date.now() & 0xffff);
  events: WorldEvents = quiet;
  private serial = 0;

  constructor() {
    this.cats = CAT_IDS.map((id, i) => this.newCat(id, 520 + i * 460, WALK.y0 + 160 + (i % 2) * 120));
  }

  private newCat(id: CatId, x: number, y: number): Cat {
    const seed = id.length * 13 + id.charCodeAt(0);
    const clip: ClipName = 'sit';
    const pose = sampleClip(clip, { t: 0, phase: 0, seed, intensity: 1 });
    return {
      id, name: CAT_NAMES[id], look: LOOKS[id], exp: expFor(START_LEVEL[id]), love: 2, costume: null, costumeUntil: 0,
      x, y, z: 0, facing: x > 1000 ? -1 : 1, turn: 1, clip, clipT: 0, phase: 0, seed, intensity: 1,
      pose, from: null, blendT: 0, blendDur: .25, blink: 1, blinkTimer: 2 + (seed % 3),
      emo: newEmotion('content'), act: { k: 'idle', until: 1 + (seed % 4) },
      lastPet: -99, lastPlay: -99, batCount: 0, tailSway: 0, tailVel: 0, lastX: x,
    };
  }

  get clock(): GameTime { return arcadeClock(this.playMs); }
  get isNight() { const p = this.clock.phase; return p === 'night' || p === 'witching' || p === 'dawn'; }
  getCat(id: string) { return this.cats.find(c => c.id === id); }
  level(cat: Cat) { return levelOf(cat.exp); }
  phys(cat: Cat): Physique { const l = this.level(cat); return physique(cat.look, l, idealWeight(l)); }
  unit(cat: Cat) { return CAT_SCALE * this.phys(cat).scale; }

  /** World-space shapes (head, body, neck and so on) for hit tests and costumes. */
  shapes(cat: Cat) {
    const p = this.phys(cat), s = CAT_SCALE * p.scale, local = catShapes(cat.pose, p), f = cat.facing, lift = cat.pose.front >= .5 ? 0 : cat.pose.lift;
    const tx = (v: Pt) => ({ x: cat.x + v.x * s * f, y: cat.y - cat.z + (v.y - lift) * s });
    return { head: { ...tx(local.head), r: local.head.r * s }, body: { ...tx(local.body), rx: local.body.rx * s, ry: local.body.ry * s }, neck: tx(local.neck), paw: tx(local.paw), tail: tx(local.tail), mouth: tx(local.mouth), scale: s };
  }

  setClip(cat: Cat, clip: ClipName, blend = .25) {
    if (cat.clip === clip) return;
    cat.from = cat.pose; cat.blendT = 0; cat.blendDur = blend;
    cat.clip = clip; cat.clipT = 0;
  }
  mark(cat: Cat, kind: EmoteKind, dur = 1.4) { cat.emote = { kind, age: 0, dur }; }
  emit(kind: ParticleKind, x: number, y: number, count = 1, text?: string) {
    for (let i = 0; i < count; i++) {
      const confetti = kind === 'confetti';
      this.particles.push({ kind, x: x + (this.rand() - .5) * (confetti ? 60 : 30), y, vx: (this.rand() - .5) * (confetti ? 200 : 30), vy: -(confetti ? 60 : 30) - this.rand() * (confetti ? 120 : 30), life: kind === 'zzz' ? 2.4 : kind === 'exp' ? 1.8 : confetti ? 2.6 : 1.4, age: 0, text });
    }
  }
  isAsleep(cat: Cat) { return SLEEP_CLIPS.has(cat.clip) || cat.clip === 'sleep'; }
  isBusy(cat: Cat) { return cat.act.k === 'held' || cat.act.k === 'fall' || cat.act.k === 'gym' || cat.act.k === 'hop' || cat.act.k === 'fly'; }
  isFlying(cat: Cat) { return cat.act.k === 'fly'; }

  // Progression

  addExp(cat: Cat, exp: number, why: string) {
    if (exp <= 0) return;
    const before = this.level(cat);
    cat.exp = clampExp(cat.exp + exp);
    const s = this.shapes(cat); this.emit('exp', s.head.x, s.head.y - s.head.r - 10, 1, `+${exp} EXP`);
    const after = this.level(cat);
    if (after > before) {
      this.events.sound('levelup', cat.id);
      this.events.banner(`${cat.name} reached level ${after}!`, `${why} ${cat.name} is growing up.`);
      this.emit('spark', s.head.x, s.head.y, 6);
    }
  }
  addLove(cat: Cat, love: number) {
    const before = Math.floor(cat.love);
    cat.love = clampLove(cat.love + love);
    if (Math.floor(cat.love) > before) { const sh = this.shapes(cat); this.emit('heart', sh.head.x, sh.head.y - sh.head.r, 4); this.events.banner(`${cat.name}: ${Math.floor(cat.love)} hearts`, 'Love grows with petting and play.'); }
  }
  /** Play gives a little EXP: 1 per 20 s of play per cat, at most 30 a day. */
  private playReward(cat: Cat) {
    if (this.time - cat.lastPlay < 20) return;
    cat.lastPlay = this.time;
    this.addLove(cat, PLAY_LOVE);
    const day = this.clock.day;
    if (this.playExp.day !== day) this.playExp = { day, exp: 0 };
    if (this.playExp.exp < 30) { this.playExp.exp++; this.addExp(cat, 1, 'Playing pays off.'); }
  }
  // Player actions

  pet(cat: Cat) {
    if (this.isBusy(cat)) return;
    const asleep = this.isAsleep(cat);
    const back = cat.act.k === 'pet' ? cat.act.then : cat.act;
    // On an item or the sofa it stays where it is after the petting; on the floor it sits a while.
    const stay = asleep || back.k === 'use' || back.k === 'sofa' || cat.z > 1;
    cat.act = { k: 'pet', until: this.time + 2.6, then: stay ? back : { k: 'idle', until: this.time + 4 } };
    if (!asleep) this.setClip(cat, cat.pose.front >= .5 ? 'petHead' : 'pet');
    this.mark(cat, 'heart', 1.4);
    const s = this.shapes(cat); this.emit('heart', s.head.x, s.head.y - s.head.r, 2);
    this.events.sound(asleep ? 'purr' : 'meow', cat.id);
    if (this.time - cat.lastPet > 4) { cat.lastPet = this.time; this.addLove(cat, PET_LOVE); }
  }
  pickUp(cat: Cat) {
    if (cat.act.k === 'gym') this.endGym(cat, false);
    cat.act = { k: 'held' }; this.setClip(cat, 'held', .15);
    this.events.sound('meow', cat.id);
  }
  /** While carried, the cat hangs under the finger. */
  moveHeld(cat: Cat, p: Pt) {
    const ground = clampToFloor({ x: p.x, y: p.y + 150 });
    cat.x = ground.x; cat.y = ground.y; cat.z = Math.max(0, ground.y - (p.y + 60));
  }
  drop(cat: Cat) {
    if (cat.act.k !== 'held') return;
    cat.act = { k: 'fall', vz: 0 }; this.setClip(cat, 'fall', .1);
  }
  throwBall(target: Pt) {
    const to = clampToFloor(target), from = { x: to.x + (this.rand() - .5) * 200, y: Math.min(WALK.y1, to.y + 120) };
    this.ball = { x: from.x, y: from.y, z: 140, vx: (to.x - from.x) * 1.4, vy: (to.y - from.y) * 1.4, vz: 160, rest: 0 };
    this.events.sound('whoosh');
    const awake = this.cats.filter(c => !this.isBusy(c) && c.act.k !== 'feather').sort((a, b) => dist(a, to) - dist(b, to));
    for (const c of awake.slice(0, 2)) { if (this.isAsleep(c) && this.rand() < .6) continue; c.act = { k: 'chase' }; c.batCount = 0; }
  }
  setFeather(p: Pt | null) { this.feather = p ? { x: p.x, y: p.y } : null; }

  placeItem(id: ItemId, p: Pt): Placed | null {
    if (!this.itemUnlocked(id)) return null;
    const at = clampToFloor(p), placed = { uid: `i${Date.now().toString(36)}${this.serial++}`, id, x: at.x, y: at.y };
    this.items.push(placed); this.emit('puff', at.x, at.y, 4); this.events.sound('pop');
    return placed;
  }
  moveItem(uid: string, p: Pt) { const it = this.items.find(i => i.uid === uid); if (!it) return; const at = clampToFloor(p); it.x = at.x; it.y = at.y; this.kickUsers(uid); }
  removeItem(uid: string) { const it = this.items.find(i => i.uid === uid); if (it?.worn) { const c = this.getCat(it.worn); if (c) this.undress(c); } this.kickUsers(uid); this.items = this.items.filter(i => i.uid !== uid); }
  private kickUsers(uid: string) { for (const c of this.cats) if (c.act.k === 'use' && c.act.item === uid) { c.z = 0; c.act = { k: 'idle', until: this.time + 1 }; this.setClip(c, 'stand'); } }
  usersOf(uid: string) {
    const going = (a: Act) => (a.k === 'use' && a.item === uid) || ((a.k === 'walk' || a.k === 'hop') && a.then.k === 'use' && a.then.item === uid);
    const worn = this.items.find(i => i.uid === uid)?.worn;
    return this.cats.filter(c => c.id === worn || going(c.act));
  }

  /** The player gives an item to a cat: it goes and uses it (a costume item dresses it up). */
  giveItem(cat: Cat, uid: string) {
    const it = this.items.find(i => i.uid === uid && !i.worn); if (!it) return false;
    if (cat.act.k === 'held' || cat.act.k === 'fall') return false;
    if (cat.act.k === 'gym') this.endGym(cat, false);
    for (const c of this.cats) if (c !== cat && this.usersOf(uid).includes(c) && !this.isBusy(c)) { c.z = 0; c.act = { k: 'idle', until: this.time + 2 }; this.setClip(c, 'stand'); }
    if (cat.costume) this.undress(cat);
    const u = ITEMS[it.id].use, side = Math.sign(cat.x - it.x) || 1;
    cat.z = cat.act.k === 'use' || cat.act.k === 'sofa' ? 0 : cat.z;
    cat.act = { k: 'walk', to: { x: it.x + (u.z > 30 || u.rim ? 0 : side * Math.abs(u.dx)), y: it.y + (u.z > 30 ? 40 : u.rim ? 30 : u.dy) }, run: true, then: { k: 'use', item: it.uid, until: this.time + u.stay[0] + 1.5 } };
    this.mark(cat, 'exclaim', 1); this.events.sound('meow', cat.id);
    return true;
  }
  private dressUp(cat: Cat, it: Placed) {
    const def = ITEMS[it.id], id = def.use.costume!, c = COSTUMES[id];
    cat.z = 0; if (def.use.rim) cat.y = Math.min(WALK.y1, it.y + 50);
    cat.costume = id; cat.costumeUntil = this.time + COSTUME_SECONDS;
    if (def.use.worn) it.worn = cat.id;
    const s = this.shapes(cat); this.emit('puff', s.body.x, s.body.y, 8); this.emit('spark', s.head.x, s.head.y - s.head.r, 4);
    this.events.sound('poof'); this.addLove(cat, PLAY_LOVE);
    this.events.banner(`${cat.name} is a ${c.name.toLowerCase()}!`, `${c.jp} (${c.romaji}) means “${c.name.toLowerCase()}”.`);
    this.events.costume?.(cat, id);
    if (id === 'werewolf') { this.setClip(cat, 'lookUp', .2); this.events.sound('howl', cat.id); this.mark(cat, 'exclaim', 1.4); cat.act = { k: 'idle', until: this.time + 2.5 }; }
    else if (c.flies) this.takeOff(cat);
    else { this.setClip(cat, 'stand'); cat.act = { k: 'idle', until: this.time + 1.5 }; }
    const slot = openSlot(this.albumSlots, cat.id, id);
    const perk = slotPerkLove(this.albumSlots, cat.id, id);
    if (perk > 0) this.addLove(cat, perk);
    if (slot.fresh) { this.albumSlots = slot.open; this.celebrateSlot(cat, id); }
  }
  /** First time this cat wears this costume: a banner now, then confetti and a hop when that banner is on screen. */
  private celebrateSlot(cat: Cat, id: CostumeId) {
    this.events.banner('New album slot open', `${CAT_NAMES[cat.id]} as a ${COSTUMES[id].name.toLowerCase()}. ${slotCount(this.albumSlots)} of ${SLOT_COUNT} slots are open.`);
    this.later.push({ at: this.time + SLOT_BANNER_DELAY, run: () => this.slotMoment(cat, id) });
  }
  private slotMoment(cat: Cat, id: CostumeId) {
    const s = this.shapes(cat);
    this.emit('confetti', s.head.x, s.head.y - s.head.r, 60);
    this.mark(cat, 'spark', 1.6);
    this.events.sound('sparkle', cat.id);
    const calm = cat.act.k === 'idle' || cat.act.k === 'walk';
    if (!COSTUMES[id].flies && calm) cat.act = { k: 'hop', z0: 0, z1: 0, y0: cat.y, y1: cat.y, t: 0, dur: .6, then: { k: 'idle', until: this.time + 1.5 } };
  }
  takeOff(cat: Cat) {
    cat.act = { k: 'fly', to: { x: WALK.x0 + 150 + this.rand() * (WALK.x1 - WALK.x0 - 300), y: WALK.y0 + this.rand() * (WALK.y1 - WALK.y0) * .7 }, legs: 3 + Math.floor(this.rand() * 3), t: 0 };
    this.events.sound('flap');
  }
  undress(cat: Cat) {
    const id = cat.costume; if (!id) return;
    cat.costume = null;
    const s = this.shapes(cat); this.emit('puff', s.body.x, s.body.y, 8); this.events.sound('poof');
    for (const it of this.items) if (it.worn === cat.id) { it.worn = undefined; const p = clampToFloor({ x: cat.x + (cat.facing > 0 ? -110 : 110), y: cat.y + 20 }); it.x = p.x; it.y = p.y; }
  }
  startGym(cat: Cat) {
    for (const c of this.cats) if (c !== cat && c.act.k === 'gym') this.endGym(c, false);
    cat.z = 0;
    cat.act = { k: 'walk', to: GYM_SPOT, run: true, then: { k: 'gym', t: 0, dur: 18.4 } };
    this.events.sound('meow', cat.id);
  }
  endGym(cat: Cat, finished: boolean) {
    if (finished) {
      this.addExp(cat, GYM_SET_EXP, 'A strong set at the barbell.'); this.addLove(cat, GYM_SET_LOVE);
      this.mark(cat, 'spark', 1.6); this.events.sound('sparkle');
    }
    cat.act = { k: 'idle', until: this.time + 3 }; this.setClip(cat, finished ? 'sit' : 'stand');
  }
  /** EXP sent from the grimoire (R10.6). */
  applyReward(catId: string, exp: number, source: string) {
    const cat = this.getCat(catId) ?? this.cats[0];
    this.addExp(cat, Math.max(0, Math.min(500, Math.round(exp))), source);
    this.mark(cat, 'spark', 1.6);
    return cat;
  }

  // Step

  step(dt: number) {
    this.time += dt; this.playMs += dt * 1000;
    this.runLater();
    this.stepBall(dt);
    for (const cat of this.cats) {
      if (cat.costume && this.time > cat.costumeUntil && (cat.act.k === 'idle' || cat.act.k === 'walk')) this.undress(cat);
      this.stepCat(cat, dt); this.animate(cat, dt);
    }
    for (const p of this.particles) {
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= .98;
      if (p.kind === 'confetti') p.vy += 150 * dt;
    }
    this.particles = this.particles.filter(p => p.age < p.life);
  }

  private stepBall(dt: number) {
    const b = this.ball; if (!b) return;
    b.vz -= 900 * dt; b.z += b.vz * dt;
    if (b.z <= 0) { b.z = 0; if (Math.abs(b.vz) > 80) { b.vz = -b.vz * .45; this.events.sound('boing'); } else b.vz = 0; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    const f = b.z > 0 ? .995 : Math.exp(-2.2 * dt); b.vx *= f; b.vy *= f;
    if (b.x < WALK.x0 || b.x > WALK.x1) { b.vx = -b.vx * .7; b.x = clamp(b.x, WALK.x0, WALK.x1); }
    if (b.y < WALK.y0 || b.y > WALK.y1) { b.vy = -b.vy * .7; b.y = clamp(b.y, WALK.y0, WALK.y1); }
    if (Math.hypot(b.vx, b.vy) < 8 && b.z === 0) b.rest += dt; else b.rest = 0;
    if (b.rest > 12 && !this.cats.some(c => c.act.k === 'chase')) this.ball = null;
  }

  private stepCat(cat: Cat, dt: number) {
    const a = cat.act, t = this.time;
    if (cat.emote) { cat.emote.age += dt; if (cat.emote.age >= cat.emote.dur) cat.emote = undefined; }
    switch (a.k) {
      case 'held': return;
      case 'fall': {
        a.vz -= 1400 * dt; cat.z += a.vz * dt;
        if (cat.z <= 0) { cat.z = 0; cat.act = { k: 'land', until: t + .55 }; this.setClip(cat, 'land', .05); this.events.sound('land'); }
        return;
      }
      case 'land': if (t >= a.until) { cat.act = { k: 'idle', until: t + 1.5 }; this.setClip(cat, 'shake'); } return;
      case 'pet': if (t >= a.until) cat.act = a.then; return;
      case 'walk': {
        const d = dist(cat, a.to), speed = (a.run ? 260 : 85) * (.75 + .25 * this.phys(cat).scale);
        if (d < 6) { cat.x = a.to.x; cat.y = a.to.y; this.arrive(cat, a.then); return; }
        const step = Math.min(d, speed * dt);
        cat.x += (a.to.x - cat.x) / d * step; cat.y += (a.to.y - cat.y) / d * step;
        if (Math.abs(a.to.x - cat.x) > 2) cat.facing = a.to.x > cat.x ? 1 : -1;
        this.setClip(cat, a.run ? 'run' : 'walk', .18);
        cat.phase += step / (gaitCycle(GAITS[a.run ? 'run' : 'walk']) * this.unit(cat));
        return;
      }
      case 'hop': {
        a.t += dt; const u = Math.min(1, a.t / a.dur), e = smooth(u);
        cat.z = a.z0 + (a.z1 - a.z0) * e + Math.sin(u * Math.PI) * 40; cat.y = a.y0 + (a.y1 - a.y0) * e;
        this.setClip(cat, u < .85 ? 'leap' : 'land', .08);
        if (u >= 1) { cat.z = a.z1; this.events.sound('land'); this.arrive(cat, a.then); }
        return;
      }
      case 'use': {
        const it = this.items.find(i => i.uid === a.item);
        if (!it) { cat.z = 0; cat.act = { k: 'idle', until: t + 1 }; return; }
        if (t >= a.until) { if (ITEMS[it.id].use.costume) this.dressUp(cat, it); else this.leaveItem(cat, it); }
        else if (ITEMS[it.id].use.sleep && this.isAsleep(cat) && this.rand() < dt * .4) this.emit('zzz', cat.x, cat.y - cat.z - 50 * this.unit(cat));
        return;
      }
      case 'sofa': if (t >= a.until) { cat.act = { k: 'hop', z0: cat.z, z1: 0, y0: cat.y, y1: SOFA.y + 70, t: 0, dur: .6, then: { k: 'idle', until: t + 2 } }; } return;
      case 'fly': {
        a.t += dt;
        const landing = a.legs <= 0, d = dist(cat, a.to), speed = 300;
        const zTarget = landing ? 0 : 150 + Math.sin(a.t * 2.2 + cat.seed) * 25;
        cat.z += (zTarget - cat.z) * Math.min(1, dt * (landing ? 3 : 1.8));
        if (d > 8) { const step = Math.min(d, speed * dt); cat.x += (a.to.x - cat.x) / d * step; cat.y += (a.to.y - cat.y) / d * step; if (Math.abs(a.to.x - cat.x) > 3) cat.facing = a.to.x > cat.x ? 1 : -1; }
        this.setClip(cat, cat.costume === 'witch' ? 'loaf' : 'leap', .25);
        if (cat.costume === 'bat' && Math.floor((a.t - dt) * 2.4) !== Math.floor(a.t * 2.4)) this.events.sound('flap');
        if (!landing && d <= 8) { a.legs--; a.to = a.legs > 0 ? { x: WALK.x0 + 150 + this.rand() * (WALK.x1 - WALK.x0 - 300), y: WALK.y0 + this.rand() * (WALK.y1 - WALK.y0) * .8 } : clampToFloor({ x: cat.x + cat.facing * 120, y: cat.y + 40 }); if (this.rand() < .4) this.mark(cat, 'music', 1); }
        if (landing && cat.z < 3 && d <= 8) { cat.z = 0; cat.act = { k: 'land', until: t + .55 }; this.setClip(cat, 'land', .05); this.events.sound('land'); }
        if (a.t > 40) a.legs = 0;
        return;
      }
      case 'chase': return this.chase(cat, dt);
      case 'feather': return this.stalk(cat, dt);
      case 'gym': {
        a.t += dt; cat.facing = 1;
        this.setClip(cat, 'lift', .3);
        if (Math.floor((a.t - dt) / 2.2) !== Math.floor(a.t / 2.2) && a.t % 9.2 < 6.6) this.events.sound('clank');
        if (a.t > 4 && Math.floor((a.t - dt) / 4.6) !== Math.floor(a.t / 4.6)) this.mark(cat, 'sweat', 1.3);
        if (a.t >= a.dur) this.endGym(cat, true);
        return;
      }
      case 'idle': {
        if (this.feather && !this.isAsleep(cat) && dist(cat, this.feather) < 520 && this.rand() < dt * 2) { cat.act = { k: 'feather', step: 'stalk', t: 0, until: t + 30 }; return; }
        if (t >= a.until) think(this, cat);
        return;
      }
    }
  }

  /** Reached the end of a walk or a hop. */
  private arrive(cat: Cat, next: Act) {
    if (next.k === 'use') {
      const it = this.items.find(i => i.uid === next.item); if (!it) { cat.act = { k: 'idle', until: this.time + 1 }; return; }
      const u = ITEMS[it.id].use;
      if (u.z > 30 && cat.z < u.z - 1) { cat.act = { k: 'hop', z0: cat.z, z1: u.z, y0: cat.y, y1: it.y + u.dy, t: 0, dur: .7, then: next }; return; }
      cat.x = it.x + (u.dx ? Math.sign(cat.x - it.x || 1) * Math.abs(u.dx) : 0); cat.y = it.y + u.dy; cat.z = u.z;
      if (u.faceIt) cat.facing = it.x > cat.x ? 1 : -1;
      const clip = u.clips[Math.floor(this.rand() * u.clips.length)];
      this.setClip(cat, clip, .3);
      cat.act = next;
      if (it.id === 'spider') this.events.sound('bat');
      return;
    }
    if (next.k === 'sofa') {
      if (cat.z < SOFA.z - 1) { cat.act = { k: 'hop', z0: 0, z1: SOFA.z, y0: cat.y, y1: SOFA.y, t: 0, dur: .65, then: next }; return; }
      this.setClip(cat, this.isNight && this.rand() < .6 ? 'sleepLoaf' : 'loaf', .3); cat.act = next; return;
    }
    if (next.k === 'gym') { cat.facing = 1; this.setClip(cat, 'lift', .3); this.events.banner(`${cat.name} hits the barbell!`, 'One set, then EXP.'); }
    cat.act = next;
  }

  private leaveItem(cat: Cat, it: Placed) {
    const u = ITEMS[it.id].use;
    if (u.z > 30) { cat.act = { k: 'hop', z0: cat.z, z1: 0, y0: cat.y, y1: Math.min(WALK.y1, it.y + 60), t: 0, dur: .7, then: { k: 'idle', until: this.time + 2 } }; return; }
    cat.z = 0;
    if (u.rim) cat.y = Math.min(WALK.y1, it.y + 50);
    cat.act = { k: 'idle', until: this.time + 1.5 }; this.setClip(cat, 'stand');
  }

  private chase(cat: Cat, dt: number) {
    const b = this.ball;
    if (!b || cat.batCount >= 3) { cat.act = { k: 'idle', until: this.time + 2 }; this.setClip(cat, 'sitPlay'); return; }
    const d = dist(cat, b);
    if (d > 70) {
      const step = Math.min(d - 60, 270 * dt);
      cat.x += (b.x - cat.x) / d * step; cat.y += (b.y - cat.y) / d * step; cat.facing = b.x > cat.x ? 1 : -1;
      this.setClip(cat, 'run', .15); cat.phase += step / (gaitCycle(GAITS.run) * this.unit(cat));
      return;
    }
    if (cat.clip !== 'bat' || cat.clipT > .6) {
      this.setClip(cat, 'bat', .08); cat.clipT = 0; cat.batCount++;
      const ang = (this.rand() - .5) * 1.6 + (cat.facing > 0 ? 0 : Math.PI), power = 280 + this.rand() * 200;
      b.vx = Math.cos(ang) * power; b.vy = Math.sin(ang) * power * .6; b.vz = 140; b.z = Math.max(b.z, 2);
      this.events.sound('bat'); this.playReward(cat);
      if (this.rand() < .4) this.mark(cat, 'music', 1.2);
    }
  }

  private stalk(cat: Cat, dt: number) {
    const a = cat.act as Extract<Act, { k: 'feather' }>, f = this.feather;
    if (!f || this.time > a.until) { cat.act = { k: 'idle', until: this.time + 2 }; this.setClip(cat, 'sit'); return; }
    a.t += dt;
    const ground = clampToFloor({ x: f.x, y: Math.max(f.y + 40, WALK.y0) }), d = dist(cat, ground);
    cat.facing = f.x > cat.x ? 1 : -1;
    if (a.step === 'stalk') {
      if (d > 150) { const step = Math.min(d - 140, (d > 400 ? 220 : 110) * dt); cat.x += (ground.x - cat.x) / d * step; cat.y += (ground.y - cat.y) / d * step; this.setClip(cat, d > 400 ? 'run' : 'slowWalk', .15); cat.phase += step / (gaitCycle(GAITS[d > 400 ? 'run' : 'slow']) * this.unit(cat)); }
      else { a.step = 'crouch'; a.t = 0; this.setClip(cat, 'crouch', .2); cat.intensity = 1; }
    } else if (a.step === 'crouch') {
      if (d > 230) { a.step = 'stalk'; return; }
      if (a.t > .9 + (cat.seed % 5) * .15) { a.step = 'pounce'; a.t = 0; this.events.sound('whoosh'); }
    } else if (a.step === 'pounce') {
      const u = Math.min(1, a.t / .45);
      cat.z = Math.sin(u * Math.PI) * 60; this.setClip(cat, 'leap', .05);
      const step = Math.min(d, 420 * dt); if (d > 30) { cat.x += (ground.x - cat.x) / d * step; cat.y += (ground.y - cat.y) / d * step; }
      if (u >= 1) { cat.z = 0; a.step = 'bat'; a.t = 0; this.setClip(cat, 'bat', .05); this.events.sound('bat'); this.playReward(cat); if (this.rand() < .5) this.mark(cat, 'exclaim', 1); }
    } else if (a.t > .7) { a.step = d > 150 ? 'stalk' : 'crouch'; a.t = 0; this.setClip(cat, 'crouch', .2); }
  }

  // Pose

  private wantEmotion(cat: Cat): EmotionId {
    const a = cat.act;
    if (this.isAsleep(cat)) return 'sleepy';
    if (a.k === 'pet') return 'love';
    if (a.k === 'gym') return 'determined';
    if (a.k === 'held') return 'surprised';
    if (a.k === 'chase' || a.k === 'feather') return 'playful';
    if (a.k === 'fall') return 'scared';
    if (a.k === 'fly') return 'joy';
    if (cat.costume === 'vampire' || cat.costume === 'werewolf') return 'proud';
    if (cat.costume) return 'playful';
    return cat.love >= 6 ? 'happy' : 'content';
  }

  private animate(cat: Cat, dt: number) {
    cat.clipT += dt;
    if (cat.from) { cat.blendT += dt; if (cat.blendT >= cat.blendDur) cat.from = null; }
    let target = sampleClip(cat.clip, { t: cat.clipT, phase: cat.phase, seed: cat.seed, intensity: cat.intensity });
    // The tail lags behind turning and starting to walk (a damped spring).
    const vx = (cat.x - cat.lastX) / Math.max(dt, 1e-3); cat.lastX = cat.x;
    const push = clamp(-vx * cat.facing * .004, -1, 1) + (cat.facing !== Math.sign(cat.turn || 1) ? .8 : 0);
    cat.tailVel += (push - cat.tailSway) * 30 * dt - cat.tailVel * 7 * dt;
    cat.tailSway = clamp(cat.tailSway + cat.tailVel * dt, -1.5, 1.5);
    target = { ...target, tailSway: target.tailSway + cat.tailSway };
    const want = this.wantEmotion(cat);
    if (want !== cat.emo.id) changeEmotion(cat.emo, want, this.time);
    target = emotionFace(target, cat.emo, this.time, cat.seed, target.eyeStyle !== 'open' || target.mouth !== 'w');
    // Tense moments of play narrow the pupils.
    if (cat.act.k === 'feather' || cat.act.k === 'chase') target = { ...target, pupil: Math.min(target.pupil ?? 1, .65) };
    cat.pose = cat.from ? lerpPose(cat.from, target, smooth(cat.blendT / cat.blendDur)) : target;
    if (this.isAsleep(cat) || (cat.pose.eyeStyle !== 'open' && cat.pose.eyeStyle !== 'wide')) cat.blink = 1;
    else {
      cat.blinkTimer -= dt;
      if (cat.blinkTimer < 0) { cat.blink = 0; if (cat.blinkTimer < -.13) { cat.blink = 1; cat.blinkTimer = 2 + this.rand() * 4.5; } }
    }
    cat.turn = approach(cat.turn, cat.facing, 30, dt);
  }

  /** A fresh house: starting levels, no items. */
  reset() {
    this.items = []; this.ball = null; this.feather = null; this.particles = []; this.later = []; this.playMs = 0; this.playExp = { day: 1, exp: 0 };
    this.cats = CAT_IDS.map((id, i) => this.newCat(id, 520 + i * 460, WALK.y0 + 160 + (i % 2) * 120));
  }

  // Save

  snapshot() {
    return {
      v: 1, playMs: Math.round(this.playMs), playExp: this.playExp, albumSlots: this.albumSlots,
      cats: this.cats.map(c => ({ id: c.id, exp: c.exp, love: +c.love.toFixed(2), x: Math.round(c.x), y: Math.round(c.y) })),
      items: this.items.map(i => { const c = i.worn ? this.getCat(i.worn) : undefined, p = c ? clampToFloor({ x: c.x - 100, y: c.y }) : i; return { uid: i.uid, id: i.id, x: Math.round(p.x), y: Math.round(p.y) }; }),
    };
  }
  load(raw: unknown): boolean {
    if (!raw || typeof raw !== 'object') return false;
    const d = raw as Record<string, unknown>;
    if (d.v !== 1) return false;
    if (typeof d.playMs === 'number' && Number.isFinite(d.playMs)) this.playMs = Math.max(0, d.playMs);
    this.albumSlots = cleanSlots(d.albumSlots);
    const pe = d.playExp as { day?: unknown; exp?: unknown } | undefined;
    if (pe && typeof pe.day === 'number' && typeof pe.exp === 'number') this.playExp = { day: pe.day, exp: clamp(pe.exp, 0, 30) };
    if (Array.isArray(d.cats)) for (const s of d.cats as Record<string, unknown>[]) {
      const cat = this.getCat(String(s?.id)); if (!cat) continue;
      if (typeof s.exp === 'number') cat.exp = clampExp(s.exp);
      if (typeof s.love === 'number') cat.love = clampLove(s.love);
      if (typeof s.x === 'number' && typeof s.y === 'number') { const p = clampToFloor({ x: s.x, y: s.y }); cat.x = cat.lastX = p.x; cat.y = p.y; }
    }
    if (Array.isArray(d.items)) this.items = (d.items as Record<string, unknown>[]).filter(i => isItemId(i?.id) && this.itemUnlocked(i.id as ItemId) && typeof i.x === 'number' && typeof i.y === 'number').slice(0, 40)
      .map((i, k) => { const p = clampToFloor({ x: i.x as number, y: i.y as number }); return { uid: typeof i.uid === 'string' ? i.uid.slice(0, 24) : `l${k}`, id: i.id as ItemId, x: p.x, y: p.y }; });
    return true;
  }
}
