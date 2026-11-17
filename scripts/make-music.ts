/**
 * Original background music for NekoGaku Kiroween, composed and synthesized here: no samples, no
 * borrowed melodies. Two Halloween pieces in minor keys (written with b3/b6/b7 degrees and minor/
 * borrowed chords): the house's waltz and the witching-hour lullaby (also the grimoire's music).
 * The synthesizer is NekoGaku's own (instruments, notation, arranger, reverb, loudness).
 *
 *   npm run music:build [-- parlor] [-- witching]
 *
 * Output: public/audio/music/*.mp3 and music.json. Every file holds one loop plus a couple of
 * seconds of overlap; the game crossfades over it, so loops are seamless.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SR = 44100, OVERLAP = 2.5, TARGET_LUFS = -20;
const out = resolve('public/audio/music');
mkdirSync(out, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'meong-music-'));

// ———————————————————————————————————————— basics

let seed = 1;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);
const TAU = Math.PI * 2;
/** Deterministic 0..1 from an integer (timing and velocity humanising, independent of `seed`). */
const hash = (n: number) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

/** Stereo bus. Voices are placed by sample index, so every pass of the loop lands on the same samples. */
class Mix {
  L: Float32Array; R: Float32Array;
  constructor(samples: number) { this.L = new Float32Array(samples); this.R = new Float32Array(samples); }
  /** Adds a mono voice starting at sample `i0`, panned -1..1 (equal power). */
  add(i0: number, voice: Float32Array, gain: number, pan = 0) {
    const gl = Math.cos((pan + 1) * Math.PI / 4) * gain, gr = Math.sin((pan + 1) * Math.PI / 4) * gain;
    for (let i = 0; i < voice.length; i++) { const j = i0 + i; if (j < 0) continue; if (j >= this.L.length) break; this.L[j] += voice[i] * gl; this.R[j] += voice[i] * gr; }
  }
}
const buffer = (seconds: number) => new Float32Array(Math.max(1, Math.ceil(seconds * SR)));
function lowpass(x: Float32Array, cutoff: number | ((i: number) => number)) {
  let y = 0;
  for (let i = 0; i < x.length; i++) { const fc = typeof cutoff === 'number' ? cutoff : cutoff(i), k = 1 - Math.exp(-TAU * fc / SR); y += (x[i] - y) * k; x[i] = y; }
  return x;
}
function highpass(x: Float32Array, cutoff: number) {
  let y = 0, prev = 0; const k = Math.exp(-TAU * cutoff / SR);
  for (let i = 0; i < x.length; i++) { y = k * (y + x[i] - prev); prev = x[i]; x[i] = y; }
  return x;
}
function bandpass(x: Float32Array, f: number, q = 1) { return lowpass(highpass(x, f / (1 + 1 / q)), f * (1 + 1 / q)); }
const noise = () => rand() * 2 - 1;

// ———————————————————————————————————————— instruments (one note → a mono buffer)

/** Attack (eased), optional slow decay while held, then a soft release from wherever it was. */
function envelope(t: number, dur: number, a: number, r: number, decay = 0) {
  const level = (u: number) => u < a ? Math.sin(Math.PI / 2 * u / a) ** 2 : Math.exp(-(u - a) * decay);
  if (t < dur) return level(t);
  const x = (t - dur) / r; return x >= 1 ? 0 : level(dur) * (1 - x) ** 2;
}

interface ToneOpt { h: number[]; a: number; r: number; decay?: number; vib?: number; rate?: number; delay?: number; breath?: number; chiff?: number; scoop?: number; cut?: number }
/** Wind, reed and brass voices: a harmonic recipe with delayed vibrato, breath noise and a soft envelope. */
function tone(f: number, dur: number, vel: number, o: ToneOpt) {
  const b = buffer(dur + o.r + .02), n = b.length, top = Math.min(o.h.length, Math.floor(15000 / f));
  const norm = .55 / Math.sqrt(o.h.reduce((s, x) => s + x * x, 0)), vph = rand() * TAU, rate = o.rate ?? 5.2;
  let br: Float32Array | null = null;
  if (o.breath) { br = new Float32Array(n); for (let i = 0; i < n; i++) br[i] = noise(); bandpass(br, Math.min(f * 1.5, 5000), 1.5); }
  let ph = rand();
  for (let i = 0; i < n; i++) {
    const t = i / SR, depth = o.vib ? o.vib * Math.min(1, Math.max(0, t - (o.delay ?? .25)) / .4) : 0;
    let ff = f * (1 + depth * Math.sin(TAU * rate * t + vph));
    if (o.scoop) ff *= 2 ** (-o.scoop * Math.exp(-t / .05) / 12);
    ph += ff / SR; ph -= Math.floor(ph);
    let v = 0; for (let k = 0; k < top; k++) v += o.h[k] * Math.sin(TAU * (k + 1) * ph);
    const air = br ? br[i] * o.breath! * (1 + (o.chiff ?? 0) * Math.exp(-t / .03)) : 0;
    b[i] = (v * norm + air) * envelope(t, dur, o.a, o.r, o.decay);
  }
  return o.cut ? lowpass(b, o.cut * (.65 + .35 * vel)) : b;
}
/** Band-limited sawtooth (polyBLEP), for strings. */
function saw(p: number, dt: number) {
  let v = 2 * p - 1;
  if (p < dt) { const x = p / dt; v -= x + x - x * x - 1; } else if (p > 1 - dt) { const x = (p - 1) / dt; v -= x * x + x + x + 1; }
  return v;
}
/** String section: four detuned saws, gentle vibrato, two low-pass poles. */
function strings(f: number, dur: number, vel: number, attack: number, vib: number) {
  const b = buffer(dur + .9), det = [-.006, -.002, .0025, .0065], ph = det.map(() => rand()), vph = rand() * TAU;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR, w = 1 + vib * Math.sin(TAU * 5.3 * t + vph) * Math.min(1, t / .6);
    let v = 0;
    for (let k = 0; k < 4; k++) { const dt = f * (1 + det[k]) * w / SR; ph[k] += dt; if (ph[k] >= 1) ph[k] -= 1; v += saw(ph[k], dt); }
    b[i] = v * .16 * envelope(t, dur, attack, .7, .04);
  }
  return lowpass(lowpass(b, 1300 + 1500 * vel), 3200);
}
function pluckString(f: number, dur: number, vel: number, damp: number, bright: number, cut: number) {
  const len = Math.min(dur + 1.2, 3), b = buffer(len), n = Math.max(2, Math.round(SR / f)), line = new Float32Array(n);
  let lp = 0; for (let i = 0; i < n; i++) { lp += (noise() - lp) * (.3 + bright * .6); line[i] = lp * vel; }
  for (let i = 0, p = 0; i < b.length; i++, p = (p + 1) % n) {
    const next = line[(p + 1) % n]; const v = (line[p] + next) * .5 * damp; b[i] = line[p]; line[p] = v;
    if (i / SR > dur + .05) line[p] *= .995;
  }
  return lowpass(b, cut);
}
/** A bell from (ratio, amplitude, decay) partials. */
function bell(f: number, seconds: number, parts: [number, number, number][], gain: number, click = 0) {
  const b = buffer(seconds);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR; let v = 0;
    for (const [r, a, d] of parts) if (f * r < 18000) v += a * Math.sin(TAU * f * r * t) * Math.exp(-t * d);
    if (click && t < .002) v += noise() * click * (1 - t / .002);
    b[i] = v * Math.min(1, t / .0015) * gain;
  }
  return b;
}

type Inst = (f: number, dur: number, vel: number) => Float32Array;
const INST: Record<string, Inst> = {
  flute: (f, d, v) => tone(f, d, v, { h: [1, .22, .07, .03], a: .06, r: .16, vib: .0045, rate: 5.1, breath: .1, chiff: 2, cut: 6500 }),
  /** Round, pure and a little hollow: the cozy-farm whistle. */
  ocarina: (f, d, v) => tone(f, d, v, { h: [1, .06, .025], a: .045, r: .12, vib: .0035, rate: 4.8, breath: .045, chiff: 3, cut: 5000 }),
  /** Shinobue: breathy, scoops up into each note, faster vibrato. */
  fue: (f, d, v) => tone(f, d, v, { h: [1, .3, .1, .04], a: .025, r: .09, vib: .007, rate: 5.9, delay: .18, breath: .2, chiff: 2, scoop: .6, cut: 8000 }),
  oboe: (f, d, v) => tone(f, d, v, { h: [.55, 1, .9, .65, .5, .35, .25, .16, .1, .06], a: .04, r: .12, vib: .0055, rate: 5.6, breath: .02, cut: 4200 }),
  clarinet: (f, d, v) => tone(f, d, v, { h: [1, .05, .55, .04, .32, .03, .18, .02, .08], a: .05, r: .15, vib: .0025, breath: .03, cut: 3200 }),
  horn: (f, d, v) => tone(f, d, v, { h: [1, .55, .32, .18, .09, .05], a: .08, r: .25, vib: .002, cut: 1500 }),
  bassoon: (f, d, v) => tone(f, d, v, { h: [.45, 1, .85, .6, .4, .28, .18, .1], a: .035, r: .1, decay: .3, vib: .002, cut: 1800 }),
  tuba: (f, d, v) => tone(f, d, v, { h: [1, .8, .5, .3, .16, .08], a: .03, r: .12, decay: .8, cut: 900 }),
  /** Accordion: two reeds a few cents apart (musette), with a short bellows swell. */
  accordion(f, dur, vel) {
    const b = buffer(dur + .1), top = Math.min(9, Math.floor(11000 / f)); let p1 = rand(), p2 = rand();
    for (let i = 0; i < b.length; i++) {
      const t = i / SR; p1 += f * 1.0035 / SR; p2 += f * .9965 / SR; p1 -= Math.floor(p1); p2 -= Math.floor(p2);
      let v = 0; for (let k = 1; k <= top; k++) v += (Math.sin(TAU * k * p1) + Math.sin(TAU * k * p2)) * (k % 2 ? 1 : .6) / k;
      b[i] = v * .2 * envelope(t, dur, .03, .08, .15);
    }
    return lowpass(b, 2000 + 900 * vel);
  },
  strings: (f, d, v) => strings(f, d, v, .45, .0035),
  /** The same section playing a tune: quicker bow, more vibrato. */
  violin: (f, d, v) => strings(f, d, v, .1, .005),
  pizz: (f, d, v) => pluckString(f, .25, v, .985, .55, 3200),
  harp(f, dur, vel) {
    const b = pluckString(f, 2.2, vel, .9975, .35, 4200);
    for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = b[i] * .8 + Math.sin(TAU * f * t) * Math.exp(-t * 2.2) * .25 * vel * Math.min(1, t / .003); }
    return b;
  },
  guitar: (f, d, v) => pluckString(f, d, v, .996, .5, 2600),
  shamisen(f, dur, vel) {
    const b = pluckString(f, dur, vel, .992, .9, 5000);
    for (let i = 0; i < b.length; i++) b[i] = Math.tanh(b[i] * 1.8) * .7;
    return b;
  },
  glock: (f, d, v) => lowpass(bell(f, 2.4, [[1, 1, 1.4], [2.756, .35, 5], [5.404, .15, 11]], .5 * v, .2), 9000),
  celesta: f => lowpass(bell(f, 2.2, [[1, 1, 1.6], [4, .25, 4], [10.1, .06, 9]], .6, 0), 6000),
  musicbox: f => bell(f, 2.6, [[1, 1, 1.9], [2, .35, 3], [5.43, .18, 7], [8.9, .08, 11]], .55),
  /** Soft piano: a few decaying partials with a hammer thump. */
  piano(f, dur, vel) {
    const b = buffer(dur + 1.4), parts = [[1, 1, .9], [2, .45, 1.6], [3, .2, 2.4], [4, .1, 3.2], [5, .05, 4]];
    for (let i = 0; i < b.length; i++) {
      const t = i / SR; let v = 0;
      for (const [k, a, d] of parts) v += a * Math.sin(TAU * f * k * (1 + .0004 * k * k) * t) * Math.exp(-t * d * (.6 + f / 900));
      b[i] = v * envelope(t, dur, .003, .5) * .6;
    }
    return lowpass(b, 2400 + 3000 * vel);
  },
  /** Plucked double bass. */
  cbass(f, dur, vel) {
    const b = buffer(Math.min(dur, 2) + .4);
    for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = (Math.sin(TAU * f * t) + .25 * Math.sin(TAU * 2 * f * t) * Math.exp(-t * 3)) * envelope(t, Math.min(dur, 2), .008, .2, .9) * .9; }
    return lowpass(b, 900);
  },
};

// Percussion (no pitch).
const DRUM: Record<string, (vel: number) => Float32Array> = {
  bdrum(vel) { const b = buffer(.6); let ph = 0; for (let i = 0; i < b.length; i++) { const t = i / SR, f = 46 + 40 * Math.exp(-t * 25); ph += TAU * f / SR; b[i] = Math.sin(ph) * Math.exp(-t * 6) * vel; } return lowpass(b, 300); },
  shaker(vel) { const b = Float32Array.from(buffer(.09), (_, i) => noise() * Math.sin(Math.PI * i / (.09 * SR)) * vel); return highpass(b, 5500); },
  woodhi: vel => wood(1250, vel), woodlo: vel => wood(840, vel),
  tamb(vel) {
    const b = Float32Array.from(buffer(.25), (_, i) => noise() * Math.exp(-i / SR * 22) * .5 * vel);
    highpass(b, 6000);
    for (let n = 0; n < 5; n++) { const f = 6000 + rand() * 4000; for (let i = 0; i < b.length; i++) b[i] += Math.sin(TAU * f * i / SR) * Math.exp(-i / SR * 25) * .12 * vel; }
    return b;
  },
  triangle: vel => bell(3520, 2.5, [[1, 1, 1.8], [1.337, .7, 2.2], [1.77, .5, 2.6], [2.26, .35, 3], [2.68, .25, 3.4]], .1 * vel),
  sleigh(vel) {
    const b = buffer(.6);
    for (let n = 0; n < 7; n++) { const f = 5200 + rand() * 3800, at = rand() * .05; for (let i = Math.round(at * SR); i < b.length; i++) { const t = i / SR - at; b[i] += Math.sin(TAU * f * t) * Math.exp(-t * 18) * .25 * vel; } }
    return b;
  },
  taiko(vel) { const b = buffer(.9); let ph = 0; for (let i = 0; i < b.length; i++) { const t = i / SR, f = 70 + 60 * Math.exp(-t * 20); ph += TAU * f / SR; b[i] = (Math.sin(ph) * Math.exp(-t * 4.5) + noise() * .25 * Math.exp(-t * 40)) * vel; } return lowpass(b, 1400); },
  shime(vel) { const b = buffer(.12); for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = (Math.sin(TAU * 420 * t) * .5 + noise() * .5) * Math.exp(-t * 45) * vel; } return bandpass(b, 900, 1.2); },
  kane(vel) { const b = buffer(.5); for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = (Math.sin(TAU * 2350 * t) + .6 * Math.sin(TAU * 3910 * t) + .4 * Math.sin(TAU * 5620 * t)) * Math.exp(-t * 9) * .3 * vel; } return b; },
  chime(vel) { const f = pick([2093, 2349, 2637, 3136, 3520]), b = buffer(2.5); for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = (Math.sin(TAU * f * t) + .3 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 3)) * Math.exp(-t * 1.4) * .3 * vel; } return b; },
};
function wood(f: number, vel: number) {
  const b = buffer(.12);
  for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = (Math.sin(TAU * f * t) * Math.exp(-t * 55) + .4 * Math.sin(TAU * f * 2.3 * t) * Math.exp(-t * 90) + (t < .003 ? noise() * .4 * (1 - t / .003) : 0)) * .6 * vel; }
  return b;
}

// ———————————————————————————————————————— notation
//
// Melody: space-separated tokens, `|` between bars (each bar is checked against the meter).
//   5  3'  1,  #4  b7     scale degree of the major key; ' = octave up, , = octave down
//   :1.5                  length in quarter beats (kept until the next one given)
//   r  rest, _  tie (lengthens the previous note)
// Chords: one bar per `|`, roman numerals of the key: I ii iii IV V vi vii°, lower case minor,
// b/# for borrowed roots (bVII, iv), suffix sus2 / sus4 / add2 / 7, inversion /3 or /5, and
// :beats to split a bar (otherwise the bar is shared equally).

type Meter = '2/4' | '3/4' | '4/4' | '6/8';
const BEATS: Record<Meter, number> = { '2/4': 2, '3/4': 3, '4/4': 4, '6/8': 3 };
/** Positions in the bar where the tune should sit on a chord tone. */
const STRONG: Record<Meter, number[]> = { '2/4': [0], '3/4': [0], '4/4': [0, 2], '6/8': [0, 1.5] };
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

interface MNote { t: number; d: number; m: number }
function parseMel(src: string, tonic: number, barBeats: number, where: string) {
  const notes: MNote[] = []; let t = 0, dur = 1, barStart = 0, bars = 0;
  const closeBar = () => { if (barBeats && !near(t - barStart, barBeats)) throw new Error(`${where}: bar ${bars + 1} has ${t - barStart} beats`); bars++; barStart = t; };
  for (const tok of src.trim().split(/\s+/)) {
    if (tok === '|') { closeBar(); continue; }
    const m = /^(r|_|([#b]?)([1-7])([',]*))(?::([\d.]+))?$/.exec(tok);
    if (!m) throw new Error(`${where}: bad token ${tok}`);
    if (m[5]) dur = parseFloat(m[5]);
    if (m[1] === '_') notes[notes.length - 1].d += dur;
    else if (m[1] !== 'r') {
      const oct = [...m[4]].reduce((s, c) => s + (c === "'" ? 12 : -12), 0), acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
      notes.push({ t, d: dur, m: tonic + MAJOR[+m[3] - 1] + acc + oct });
    }
    t += dur;
  }
  if (barBeats) closeBar();
  return { notes, bars, len: t };
}

interface Span { t: number; d: number; root: number; tones: number[]; bass: number; sym: string; plain: boolean }
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
function parseChords(src: string, tonic: number, barBeats: number, where: string) {
  const spans: Span[] = [];
  src.split('|').forEach((bar, bi) => {
    const toks = bar.trim().split(/\s+/);
    const parsed = toks.map(tok => {
      const m = /^([b#]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(°?)(sus2|sus4|add2|7)?(?:\/([35]))?(?::([\d.]+))?$/.exec(tok);
      if (!m) throw new Error(`${where}: bad chord ${tok}`);
      const deg = NUMERALS.indexOf(m[2].toUpperCase()), minor = m[2] === m[2].toLowerCase();
      const root = ((tonic + MAJOR[deg] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0)) % 12 + 12) % 12;
      const third = m[3] ? 3 : minor ? 3 : 4, fifth = m[3] ? 6 : 7;
      const tones = m[4] === 'sus2' ? [0, 2, fifth] : m[4] === 'sus4' ? [0, 5, fifth] : m[4] === 'add2' ? [0, 2, third, fifth] : m[4] === '7' ? [0, third, fifth, 10] : [0, third, fifth];
      const bass = (root + (m[5] === '3' ? third : m[5] === '5' ? fifth : 0)) % 12;
      return { root, tones, bass, sym: tok.replace(/:.*/, ''), plain: !m[4], d: m[6] ? parseFloat(m[6]) : 0 };
    });
    const fixed = parsed.reduce((s, c) => s + c.d, 0), free = parsed.filter(c => !c.d).length;
    let t = bi * barBeats;
    for (const c of parsed) { const d = c.d || (barBeats - fixed) / free; spans.push({ ...c, t, d }); t += d; }
    if (!near(t, (bi + 1) * barBeats)) throw new Error(`${where}: chord bar ${bi + 1} does not fill the bar`);
  });
  return spans;
}
const pcsOf = (c: Span) => c.tones.map(x => (c.root + x) % 12);
const has = (c: Span, m: number) => pcsOf(c).includes(((m % 12) + 12) % 12);
function scaleIn(keyPc: number, lo: number, hi: number) { const r: number[] = []; for (let m = lo; m <= hi; m++) if (MAJOR.includes(((m - keyPc) % 12 + 12) % 12)) r.push(m); return r; }
/** Close voicing of the chord inside [lo, hi], nearest to the previous one (smooth inner voices). */
function voicing(c: Span, prev: number[] | null, lo: number, hi: number) {
  const pcs = [...new Set(pcsOf(c))];
  let best: number[] = [], score = Infinity;
  for (let base = lo; base < lo + 12; base++) {
    if (!pcs.includes(base % 12)) continue;
    const v = [base]; for (let m = base + 1; v.length < pcs.length && m <= hi; m++) if (pcs.includes(m % 12) && !v.some(x => x % 12 === m % 12)) v.push(m);
    if (v.length < pcs.length) continue;
    const centre = prev ? prev.reduce((a, b) => a + b, 0) / prev.length : (lo + hi) / 2, mid = v.reduce((a, b) => a + b, 0) / v.length;
    const s = Math.abs(mid - centre);
    if (s < score) { score = s; best = v; }
  }
  return best;
}
const inRange = (pc: number, lo: number) => lo + ((pc - lo) % 12 + 12) % 12;

// ———————————————————————————————————————— songs

type Kind = 'lead' | 'double' | 'harm' | 'counter' | 'bass' | 'chop' | 'pad' | 'arp' | 'strum' | 'fill' | 'ostinato';
/** `g` is the note level in dB relative to the tune (every instrument is calibrated to the same note loudness). */
interface Layer { k: Kind; i: string; g: number; o?: number; lo?: number; hi?: number; style?: 'oom' | 'bar' }
const ly = (k: Kind, i: string, g: number, extra: Partial<Layer> = {}): Layer => ({ k, i, g, ...extra });
interface Play { s: string; L: Layer[]; p?: string; pick?: string; dyn?: number }
interface Song {
  id: string; title: string; key: string; bpm: number; meter: Meter; tonic: number; wet: number; seed: number;
  /** Sections: chords and tune (scale degrees relative to `tonic`). */
  secs: Record<string, { ch: string; mel: string }>;
  form: Play[];
}

// Arrangement building blocks, shared by the pieces below.
const oom = (i: string, db = -4) => ly('bass', i, db, { style: 'oom' });
const roots = (i: string, db = -4) => ly('bass', i, db, { style: 'bar' });
const harpArp = (db = -9, o = 0) => ly('arp', 'harp', db, { o });
const strPad = (db = -12, lo = 53, hi = 72) => ly('pad', 'strings', db, { lo, hi });
const glockFill = (db = -9) => ly('fill', 'glock', db);

const SONGS: Song[] = [
  // The house's theme: a spooky waltz in D minor. Celesta over plucked bass and pizzicato "pah-pahs",
  // woodblocks clicking like dancing bones; the middle turns to the relative major and back.
  {
    id: 'parlor', title: 'Pumpkin Parlor Waltz', key: 'D minor', bpm: 120, meter: '3/4', tonic: 62, wet: .3, seed: 1031,
    secs: {
      I: { ch: 'i | i | iv | V', mel: 'r:3 | r:3 | r:3 | r:3' },
      A: {
        ch: 'i | i | iv | i | bVI | iv | V | V | i | i | iv | bVI | iv | V | i | i',
        mel: "5:1 1':1 b3':1 | 1':1.5 b7:.5 5:1 | 4:1 b6:1 1':1 | b3':2 r:1 | b6:1 1':1 b3':1 | 1':1.5 b6:.5 4:1 | 5:1 7:1 2':1 | 5:2 r:1 | " +
          "5:1 1':1 b3':1 | 5':1.5 4':.5 b3':1 | 4':1 1':1 b6:1 | 1':2 b6:1 | 4:1 b6:1 1':1 | 2':1 7:1 5:1 | 1':3 | r:3",
      },
      B: {
        ch: 'bIII | bVII | bVI | V | bIII | bVII | iv | V',
        mel: "b3':1.5 4':.5 5':1 | 4':1 2':1 b7:1 | 1':1.5 b7:.5 b6:1 | 7:2 r:1 | b3':1 5':1 b3':1 | 2':1.5 1':.5 b7:1 | b6:1 4:1 1:1 | 5:3",
      },
      T: { ch: 'iv | V | i | i', mel: "4:1 b6:1 1':1 | 7:1 2':1 5':1 | 1':3 | r:3" },
    },
    form: [
      { s: 'I', p: 'bones-lite', L: [harpArp(-9), oom('cbass', -3), ly('chop', 'pizz', -5)] },
      { s: 'A', p: 'bones', L: [ly('lead', 'celesta', 0), oom('cbass', -3), ly('chop', 'pizz', -4), strPad(-14)] },
      { s: 'B', p: 'bones-lite', L: [ly('lead', 'violin', -1), harpArp(-10), oom('cbass', -3), strPad(-12)] },
      { s: 'A', p: 'bones', L: [ly('lead', 'musicbox', 0, { o: 12 }), ly('double', 'oboe', -6), oom('bassoon', -2), ly('chop', 'pizz', -4), glockFill(-12)] },
      { s: 'T', p: 'bones-lite', L: [ly('lead', 'celesta', 0), harpArp(-10), oom('cbass', -3)] },
    ],
  },
  // The witching hour (00:00–03:00) and the grimoire: a slow 6/8 music-box lullaby in A minor.
  {
    id: 'witching', title: 'The Witching Hour', key: 'A minor', bpm: 66, meter: '6/8', tonic: 57, wet: .4, seed: 1313,
    secs: {
      I: { ch: 'i | iv', mel: 'r:3 | r:3' },
      A: {
        ch: 'i | bVI | iv | V | i | bVI | iv:1.5 V:1.5 | i',
        mel: "5:1 b3:.5 1:1.5 | 1:1 b3:.5 b6:1.5 | 4:1 b6:.5 1':1.5 | 7,:1.5 2:1.5 | 5:1 1':.5 b3':1.5 | 1':1 b7:.5 b6:1.5 | 4:1.5 7,:1.5 | 1:3",
      },
      B: {
        ch: 'bIII | bVII | bVI | V | bIII | bVII | iv | V',
        mel: "b3':1 5:.5 b3':1.5 | b7:1.5 4:1.5 | b6:1 1':.5 b3':1.5 | 7:3 | 5':1 b3':.5 1':1.5 | 4':1 2':.5 b7:1.5 | 4:1 1':.5 b6:1.5 | 5:1.5 7,:1.5",
      },
      T: { ch: 'iv | i', mel: "4:1 b6:.5 1':1.5 | 1:3" },
    },
    form: [
      { s: 'I', p: 'twinkle', L: [harpArp(-8), strPad(-14, 50, 69), roots('cbass', -7)] },
      { s: 'A', p: 'twinkle', L: [ly('lead', 'musicbox', 0, { o: 12 }), harpArp(-12), strPad(-15, 50, 69), roots('cbass', -7)] },
      { s: 'B', p: 'twinkle', L: [ly('lead', 'celesta', 0, { o: 12 }), ly('double', 'flute', -10), harpArp(-12), strPad(-14, 50, 69), roots('cbass', -7)] },
      { s: 'A', p: 'twinkle', L: [ly('lead', 'musicbox', 0, { o: 12 }), ly('double', 'celesta', -8), harpArp(-13), strPad(-15, 50, 69), roots('cbass', -7)] },
      { s: 'T', L: [ly('lead', 'musicbox', 0, { o: 12 }), harpArp(-12), strPad(-15, 50, 69), roots('cbass', -7)] },
    ],
  },
];

// ———————————————————————————————————————— arrangement → note events

interface Ev { t: number; d: number; i: string; m: number; v: number; g: number; pan: number; layer: string; drum?: boolean }
interface Hit { at: number; drum: string; v: number; pan?: number }
/** Drum levels in dB relative to the tune (each drum calibrated like the instruments). */
const PERC_DB: Record<string, number> = { shaker: -12, woodlo: -7, woodhi: -8, triangle: -13, tamb: -9, bdrum: -7, sleigh: -10, chime: -12, taiko: -3, shime: -9, kane: -11 };

/** Percussion for one bar. `n` counts bars inside the section (for every-4/8-bar accents). */
function percussion(style: string, meter: Meter, n: number): Hit[] {
  const h: Hit[] = [], bb = BEATS[meter];
  const eighths = (acc = .8, off = .5) => { for (let s = 0; s < bb * 2; s++) h.push({ at: s / 2, drum: 'shaker', v: s % 2 ? off : acc, pan: .35 }); };
  const triangle = (every: number, v: number) => { if (n % every === 0) h.push({ at: 0, drum: 'triangle', v, pan: .4 }); };
  switch (style) {
    case 'bones': h.push({ at: 0, drum: 'woodlo', v: .8, pan: -.3 }, { at: 1, drum: 'woodhi', v: .75, pan: .3 }, { at: 2, drum: 'woodhi', v: .6, pan: .3 }); triangle(8, .6); break;
    case 'bones-lite': for (const at of [1, 2]) h.push({ at, drum: 'woodhi', v: .45, pan: .3 }); break;
    case 'farm': eighths(); h.push({ at: 0, drum: 'woodlo', v: .9, pan: -.3 }, { at: 1, drum: 'woodhi', v: .8, pan: -.3 }); triangle(8, .9); break;
    case 'farm-lite': eighths(.6, .4); triangle(8, .8); break;
    case 'summer': eighths(); for (const at of [1, 3]) h.push({ at, drum: 'tamb', v: .9, pan: -.35 }); for (const at of [0, 2]) h.push({ at, drum: 'bdrum', v: at ? .7 : 1 }); break;
    case 'summer-lite': eighths(.6, .4); h.push({ at: 3, drum: 'tamb', v: .8, pan: -.35 }); break;
    case 'waltz': h.push({ at: 0, drum: 'bdrum', v: .8 }); for (const at of [1, 2]) h.push({ at, drum: 'shaker', v: 1, pan: .35 }); triangle(4, .8); break;
    case 'waltz-lite': for (const at of [1, 2]) h.push({ at, drum: 'shaker', v: .5, pan: .35 }); triangle(8, .7); break;
    case 'snow': triangle(4, .6); break;
    case 'sleigh': for (const at of [1, 3]) h.push({ at, drum: 'sleigh', v: .8, pan: .35 }); triangle(4, .6); break;
    case 'twinkle': triangle(4, .55); if (n % 8 === 6) h.push({ at: 1.5, drum: 'chime', v: .7, pan: -.4 }); break;
    case 'matsuri':
      h.push({ at: 0, drum: 'taiko', v: 1 }, { at: 2, drum: 'taiko', v: .7 }, { at: 2.5, drum: 'taiko', v: .6 });
      if (n % 2) h.push({ at: 3.5, drum: 'taiko', v: .55 });
      for (let s = 0; s < 8; s++) h.push({ at: s / 2, drum: 'shime', v: s % 2 ? .6 : 1, pan: -.25 });
      for (const [at, v] of [[1, 1], [3, 1], [3.5, .55]]) h.push({ at, drum: 'kane', v, pan: .4 });
      break;
    case 'matsuri-lite':
      h.push({ at: 0, drum: 'taiko', v: .9 }, { at: 2, drum: 'taiko', v: .65 }, { at: 2.5, drum: 'taiko', v: .55 });
      for (const at of [1, 3]) h.push({ at, drum: 'kane', v: .9, pan: .4 });
      break;
  }
  return h;
}

/**
 * Level calibration: 1 / the loudest 50 ms RMS of a reference note (C5, or A2 for bass voices),
 * so a layer's dB value means the same thing for a flute, a harp or a taiko.
 */
const CAL = new Map<string, number>();
function calibrate(name: string, drum: boolean) {
  if (!CAL.has(name)) {
    seed = 7;
    const b = drum ? DRUM[name](1) : INST[name](mtof(['tuba', 'bassoon', 'cbass'].includes(name) ? 45 : 72), 1, .8), w = Math.round(.05 * SR);
    let acc = 0, best = 0;
    for (let k = 0; k < b.length; k++) { acc += b[k] * b[k]; if (k >= w) acc -= b[k - w] * b[k - w]; best = Math.max(best, acc / w); }
    CAL.set(name, .25 / Math.sqrt(best));
  }
  return CAL.get(name)!;
}
const dB = (x: number) => 10 ** (x / 20);

/** 8th-note broken-chord patterns per meter, as indexes into the open chord (bass, 5th, 8ve, 10th, 12th). */
const ARP: Record<Meter, number[]> = { '2/4': [0, 1, 2, 3], '3/4': [0, 1, 2, 3, 2, 1], '4/4': [0, 1, 2, 3, 4, 3, 2, 1], '6/8': [0, 1, 2, 3, 2, 1] };
/** After-beats ("pah") per meter. */
const CHOP: Record<Meter, number[]> = { '2/4': [.5, 1.5], '3/4': [1, 2], '4/4': [1, 3], '6/8': [1, 2.5] };
/** Guitar strum per meter: [beat, down?, velocity]. */
const STRUM: Record<Meter, [number, boolean, number][]> = {
  '2/4': [[0, true, .9], [.5, false, .45], [1, true, .7], [1.5, false, .45]],
  '3/4': [[0, true, .9], [1, true, .6], [1.5, false, .4], [2, true, .6], [2.5, false, .4]],
  '4/4': [[0, true, .9], [1, true, .65], [1.5, false, .45], [2.5, false, .5], [3, true, .7], [3.5, false, .45]],
  '6/8': [[0, true, .9], [1, false, .4], [1.5, true, .7], [2.5, false, .4]],
};
const PAN: Partial<Record<Kind, number>> = { lead: -.05, double: .2, harm: -.3, counter: .35, chop: -.35, strum: -.3, arp: .4, fill: .5, ostinato: -.4 };

function compose(song: Song) {
  const meter = song.meter, bb = BEATS[meter], keyPc = song.tonic % 12;
  const secs = Object.fromEntries(Object.entries(song.secs).map(([k, s]) => {
    const mel = parseMel(s.mel, song.tonic, bb, `${song.id}.${k}`), ch = parseChords(s.ch, song.tonic, bb, `${song.id}.${k}`);
    if (!near(ch.reduce((a, c) => a + c.d, 0), mel.bars * bb)) throw new Error(`${song.id}.${k}: ${mel.bars} melody bars but chords for ${ch.length}`);
    return [k, { ...mel, ch }];
  }));
  let at = 0;
  const plays = song.form.map((p, idx) => { const sec = secs[p.s]; const start = at; at += sec.bars * bb; return { ...p, idx, start, end: at, sec }; });
  const loopBeats = at;
  // The whole tune in loop time; a pickup belongs to the section it leads into.
  let mel: (MNote & { play: number })[] = [];
  const spans: Span[] = [];
  for (const p of plays) {
    if (p.pick) {
      if (!p.idx) throw new Error(`${song.id}: no pickup into the first section`);
      const pk = parseMel(p.pick, song.tonic, 0, `${song.id} pickup`), s = p.start - pk.len;
      mel = mel.filter(n => n.t < s - 1e-6);
      for (const n of mel) if (n.t + n.d > s) n.d = s - n.t;
      mel.push(...pk.notes.map(n => ({ ...n, t: n.t + s, play: p.idx })));
    }
    mel.push(...p.sec.notes.map(n => ({ ...n, t: n.t + p.start, play: p.idx })));
    spans.push(...p.sec.ch.map(c => ({ ...c, t: c.t + p.start })));
  }
  const chordAt = (t: number) => { let c = spans[0]; for (const s of spans) { if (s.t <= t + 1e-6) c = s; else break; } return c; };
  const strongAt = (t: number) => STRONG[meter].some(s => near(((t % bb) + bb) % bb, s));
  const scale = scaleIn(keyPc, 24, 108);
  const evs: Ev[] = [], active: Record<string, number> = {};
  let serial = 0;
  const push = (layer: string, i: string, t: number, d: number, m: number, v: number, g: number, pan: number, drum = false) => {
    const k = serial++, late = drum ? hash(k) * .004 : hash(k) * .009;  // seconds, applied at render
    evs.push({ t: t + late * song.bpm / 60, d, i, m, v: Math.min(1, v * (.95 + hash(k + .5) * .1)), g, pan, layer, drum });
  };
  for (const p of plays) {
    const dyn = p.dyn ?? 1, own = mel.filter(n => n.play === p.idx);
    for (const L of p.L) {
      const g = dB(L.g) * calibrate(L.i, false) * dyn, pan = PAN[L.k] ?? 0, name = `${L.k}:${L.i}`;
      active[name] = (active[name] ?? 0) + (p.end - p.start);
      const bars = Array.from({ length: (p.end - p.start) / bb }, (_, b) => p.start + b * bb);
      if (L.k === 'lead' || L.k === 'double') {
        for (const n of own) push(name, L.i, n.t, n.d * .94, n.m + (L.o ?? 0), strongAt(n.t) ? .9 : .78, g, pan);
      } else if (L.k === 'harm') {
        for (const n of own) {
          const below = scale.filter(x => x < n.m).reverse(), c = chordAt(n.t);
          let m = below[1];
          if (strongAt(n.t) && !has(c, m)) m = below[4] !== undefined && has(c, below[4]) ? below[4] : below.find(x => n.m - x >= 3 && has(c, x)) ?? m;
          push(name, L.i, n.t, n.d * .94, m + (L.o ?? 0), strongAt(n.t) ? .8 : .7, g, pan);
        }
      } else if (L.k === 'counter') {
        // A slow inner line on chord tones under the tune, mostly 3rds and 5ths, moving by step.
        const unit = meter === '4/4' ? 2 : bb, line: MNote[] = [];
        let prev = Math.round((L.lo! + L.hi!) / 2);
        for (let t = p.start; t < p.end - 1e-6; t += unit) {
          const c = chordAt(t + .01), over = mel.filter(n => n.t < t + unit && n.t + n.d > t);
          const floor = over.length ? Math.min(...over.map(n => n.m)) : 999, now = over.find(n => n.t <= t + 1e-6)?.m;
          let best = prev, score = Infinity;
          for (let m = L.lo!; m <= L.hi!; m++) {
            if (!has(c, m)) continue;
            let s = Math.abs(m - prev) + (m > floor - 3 ? 12 : 0) + (now !== undefined && m % 12 === now % 12 ? 3 : 0) + (m % 12 === c.root ? 1.5 : 0) + (m === prev ? 1.2 : 0);
            if (m % 12 === (c.root + c.tones[1]) % 12) s -= .5;
            if (s < score) { score = s; best = m; }
          }
          line.push({ t, d: unit, m: best }); prev = best;
        }
        for (let k = 0; k < line.length - 1; k++) {
          const a = line[k], b = line[k + 1], gap = Math.abs(b.m - a.m);
          if (gap >= 3 && gap <= 4 && a.d >= 2) { const mid = scale.find(x => x > Math.min(a.m, b.m) && x < Math.max(a.m, b.m)); if (mid) { a.d -= 1; line.splice(k + 1, 0, { t: a.t + a.d, d: 1, m: mid }); k++; } }
        }
        for (let k = line.length - 1; k > 0; k--) if (line[k].m === line[k - 1].m && near(line[k - 1].t + line[k - 1].d, line[k].t)) { line[k - 1].d += line[k].d; line.splice(k, 1); }
        for (const n of line) push(name, L.i, n.t, n.d * .97, n.m, .7, g, pan);
      } else if (L.k === 'bass') {
        bars.forEach((b0, bi) => {
          const hits: [number, boolean][] = L.style === 'bar' ? [[0, true]] : meter === '2/4' ? [[0, true], [1, false]] : meter === '4/4' ? [[0, true], [2, false]] : meter === '6/8' ? [[0, true], [1.5, false]] : [[0, bi % 2 === 0 || chordAt(b0).sym !== chordAt(b0 - bb).sym]];
          for (const [h, root] of hits) {
            const c = chordAt(b0 + h), r = inRange(c.bass, 40), fifth = inRange((c.root + c.tones[2]) % 12, 40);
            const len = L.style === 'bar' ? bb : meter === '3/4' ? 1.2 : .8;
            push(name, L.i, b0 + h, len, root ? r : fifth, h ? .7 : .85, g, 0);
          }
          // A chord that changes mid-bar gets its own root.
          for (const s of spans) if (s.t > b0 + 1e-6 && s.t < b0 + bb - 1e-6 && !hits.some(([h]) => near(b0 + h, s.t))) push(name, L.i, s.t, .8, inRange(s.bass, 40), .75, g, 0);
        });
      } else if (L.k === 'chop') {
        let prev: number[] | null = null;
        for (const b0 of bars) for (const h of CHOP[meter]) { const v = voicing(chordAt(b0 + h), prev, L.lo ?? 55, L.hi ?? 70); prev = v; v.forEach((m, j) => push(name, L.i, b0 + h, .4, m, .6, g, pan + j * .08)); }
      } else if (L.k === 'pad') {
        let prev: number[] | null = null;
        const mine = spans.filter(s => s.t >= p.start - 1e-6 && s.t < p.end - 1e-6);
        for (let k = 0; k < mine.length; k++) {
          let d = mine[k].d; while (k + 1 < mine.length && mine[k + 1].sym === mine[k].sym) d += mine[++k].d;
          const s = mine[k], start = s.t + s.d - d, v = voicing(s, prev, L.lo ?? 53, L.hi ?? 72); prev = v;
          v.forEach((m, j) => push(name, L.i, start, d * .98, m, .6, g, (j / Math.max(1, v.length - 1)) * .8 - .4));
        }
      } else if (L.k === 'arp') {
        for (const b0 of bars) ARP[meter].forEach((ix, s) => {
          const t = b0 + s / 2, c = chordAt(t), pcs = pcsOf(c), seq = [inRange(c.bass, 43)];
          for (let m = seq[0] + 1; seq.length < 5; m++) if (pcs.includes(m % 12) && m - seq[seq.length - 1] >= (seq.length === 1 ? 7 : 3)) seq.push(m);
          push(name, L.i, t, 1.5, seq[ix] + (L.o ?? 0), s ? .55 : .8, g, pan - .5 + ix * .25);
        });
      } else if (L.k === 'strum') {
        let prev: number[] | null = null;
        for (const b0 of bars) {
          const pat = STRUM[meter];
          pat.forEach(([h, down, v], j) => {
            const t = b0 + h, c = chordAt(t), voice = voicing(c, prev, 52, 67); prev = voice;
            const len = (j + 1 < pat.length ? pat[j + 1][0] : bb) - h;
            const strs = down ? [inRange(c.bass, 40), ...voice] : voice.slice(-3).reverse();
            strs.forEach((m, s) => push(name, L.i, t + s * .012 * song.bpm / 60, len, m, v * (down ? 1 : .8), g, pan + s * .06));
          });
        }
      } else if (L.k === 'ostinato') {
        bars.forEach((b0, bi) => {
          const pat = bi % 2 ? [0, 7, 12, 14, 12, 7, 5, 7] : [0, 7, 12, 7, 0, 7, 12, 7];
          for (let s = 0; s < bb * 2; s++) { const t = b0 + s / 2, r = inRange(chordAt(t).root, 50); push(name, L.i, t, .45, r + pat[s % 8], s % 2 ? .5 : .7, g, pan); }
        });
      } else if (L.k === 'fill') {
        // Little bell answers in the gaps of the tune (call and response).
        const notes = mel.filter(n => n.t >= p.start - 1e-6 && n.t < p.end), gaps: [number, number][] = [];
        let end = p.start;
        for (const n of notes) { if (n.t - end >= 1.5) gaps.push([end, n.t]); end = Math.max(end, n.t + n.d); }
        if (p.end - end >= 1.5) gaps.push([end, p.end]);
        for (const [a, b] of gaps) {
          const t0 = Math.ceil((a + .01) * 2) / 2, count = Math.min(4, Math.floor((b - t0 - .25) / .5)), c = chordAt(t0);
          const tones: number[] = []; for (let m = 79; tones.length < count; m++) if (has(c, m)) tones.push(m);
          tones.forEach((m, j) => push(name, L.i, t0 + j * .5, .5, m + (L.o ?? 0), .6 - j * .05, g, pan));
        }
      }
    }
    if (p.p) {
      for (let b = 0; b < (p.end - p.start) / bb; b++)
        for (const h of percussion(p.p, meter, b)) push(`perc:${h.drum}`, h.drum, p.start + b * bb + h.at, .2, 0, h.v, dB(PERC_DB[h.drum]) * calibrate(h.drum, true) * dyn, h.pan ?? 0, true);
      for (const d of new Set(Array.from({ length: (p.end - p.start) / bb }, (_, b) => percussion(p.p!, meter, b)).flat().map(h => h.drum))) active[`perc:${d}`] = (active[`perc:${d}`] ?? 0) + (p.end - p.start);
    }
  }
  return { evs, loopBeats, plays, spans, mel, active };
}

// ———————————————————————————————————————— reverb (Freeverb-style), on a send without the bass

function reverb(L: Float32Array, R: Float32Array, wet: number, room = .84, damp = .35) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], allp = [556, 441, 341, 225];
  const proc = (x: Float32Array, spread: number) => {
    const y = new Float32Array(x.length);
    for (const c of combs) {
      const n = c + spread, line = new Float32Array(n); let p = 0, store = 0;
      for (let i = 0; i < x.length; i++) { const o = line[p]; store = o * (1 - damp) + store * damp; line[p] = x[i] * .015 + store * room; y[i] += o; p = (p + 1) % n; }
    }
    for (const a of allp) {
      const n = a + spread, line = new Float32Array(n); let p = 0;
      for (let i = 0; i < y.length; i++) { const b = line[p]; const v = -y[i] + b; line[p] = y[i] + b * .5; y[i] = v; p = (p + 1) % n; }
    }
    return y;
  };
  const l = proc(highpass(L.slice(), 220), 0);
  for (let i = 0; i < L.length; i++) L[i] += l[i] * wet;
  const r = proc(highpass(R.slice(), 220), 23);
  for (let i = 0; i < R.length; i++) R[i] += r[i] * wet;
}

// ———————————————————————————————————————— render

/** Seconds of the previous pass rendered before the loop, so reverb and ringing notes carry over. */
const PRE = 12;
function render(song: Song) {
  const { evs, loopBeats, plays, spans, mel, active } = compose(song);
  // The loop is a whole number of samples (off by < 0.012 ms), so the passes are sample-identical.
  const beat = 60 / song.bpm, loopN = Math.round(loopBeats * beat * SR), loop = loopN / SR, preN = PRE * SR, ovN = Math.round(OVERLAP * SR);
  // The bus starts PRE seconds before the loop: sample 0 is loop time (loopN - preN).
  const mix = new Mix(preN + loopN + ovN + SR);
  const energy: Record<string, number> = {};
  evs.forEach((ev, k) => {
    for (let pass = 0; pass < 3; pass++) {
      const i0 = pass * loopN + Math.round(ev.t * beat * SR) - (loopN - preN);
      if (pass === 0 && i0 < 0) continue;
      if (pass === 2 && i0 > preN + loopN + ovN + SR / 2) continue;
      // Same random choices every pass (plucks, breath, bells): the passes are identical, so
      // the crossfade at the loop point is seamless.
      seed = 1 + (song.seed * 100003 + k * 7919) % 2147483645;
      const voice = ev.drum ? DRUM[ev.i](ev.v) : INST[ev.i](mtof(ev.m), ev.d * beat, ev.v), gain = ev.g * (ev.drum ? 1 : ev.v);
      mix.add(i0, voice, gain, ev.pan);
      if (pass === 1) { let e = 0; for (let i = 0; i < voice.length; i++) e += voice[i] * voice[i]; energy[ev.layer] = (energy[ev.layer] ?? 0) + e * gain * gain; }
    }
  });
  reverb(mix.L, mix.R, song.wet);
  // Warm top, no rumble at the bottom (before cutting, so the head has the same filter history as the tail).
  lowpass(mix.L, 13000); lowpass(mix.R, 13000); highpass(mix.L, 35); highpass(mix.R, 35);
  const L = mix.L.slice(preN, preN + loopN + ovN), R = mix.R.slice(preN, preN + loopN + ovN);
  // Stem level while the layer plays (dB), for checking the balance against the tune.
  const layers = Object.fromEntries(Object.entries(energy).map(([k, e]) => [k, +(10 * Math.log10(e / (active[k] * beat * SR) + 1e-12)).toFixed(1)]));
  return { L, R, loop, info: describe(song, plays, spans, mel, layers) };
}

/** Facts about the piece for the evidence report (harmony, tune, form, mix balance). */
function describe(song: Song, plays: ReturnType<typeof compose>['plays'], spans: Span[], mel: MNote[], layers: Record<string, number>) {
  const bb = BEATS[song.meter], names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'], nm = (m: number) => `${names[m % 12]}${Math.floor(m / 12) - 1}`;
  const plain = spans.filter(s => s.plain).length;
  const chordOf = (t: number) => spans.filter(s => s.t <= t + 1e-6).pop()!;
  const strong = mel.filter(n => STRONG[song.meter].some(s => near(((n.t % bb) + bb) % bb, s)) || n.d >= 1.5);
  const sorted = [...mel].sort((a, b) => a.t - b.t), steps = sorted.slice(1).map((n, k) => Math.abs(n.m - sorted[k].m));
  const lo = Math.min(...mel.map(n => n.m)), hi = Math.max(...mel.map(n => n.m));
  return {
    id: song.id, title: song.title, key: song.key, meter: song.meter, bpm: song.bpm, ...(song.meter === '6/8' ? { dottedQuarter: +(song.bpm / 1.5).toFixed(1) } : {}),
    bars: plays.reduce((s, p) => s + p.sec.bars, 0),
    form: plays.map(p => `${p.s === 'I' ? 'Intro' : p.s === 'T' ? 'Tag' : p.s}(${p.sec.bars})`).join(' '),
    chords: Object.fromEntries(Object.entries(song.secs).map(([k, s]) => [k, s.ch.replace(/\s+/g, ' ')])),
    chordCount: spans.length, plainTriadPct: Math.round(plain / spans.length * 100),
    nonTriads: [...new Set(spans.filter(s => !s.plain).map(s => s.sym))],
    tuneRange: `${nm(lo)}–${nm(hi)}`, tuneNotes: mel.length,
    stepwisePct: Math.round(steps.filter(s => s <= 2).length / steps.length * 100), largestLeap: Math.max(...steps),
    strongChordTonePct: Math.round(strong.filter(n => has(chordOf(n.t), n.m)).length / strong.length * 100),
    strongOffChord: strong.filter(n => !has(chordOf(n.t), n.m)).map(n => `bar ${Math.floor(n.t / bb) + 1}: ${nm(n.m)} over ${chordOf(n.t).sym}`),
    instruments: [...new Set(plays.flatMap(p => p.L.map(l => l.i)))],
    percussion: [...new Set(plays.map(p => p.p).filter(Boolean))],
    layerDb: layers,
  };
}

// ———————————————————————————————————————— loudness and encoding

function writeWav(path: string, L: Float32Array, R: Float32Array | null) {
  const ch = R ? 2 : 1, n = L.length, data = Buffer.alloc(44 + n * ch * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * ch * 2, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(ch, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * ch * 2, 28); data.writeUInt16LE(ch * 2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * ch * 2, 40);
  for (let i = 0; i < n; i++) { data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * ch * 2); if (R) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * ch * 2); }
  writeFileSync(path, data);
}
function encode(id: string, L: Float32Array, R: Float32Array | null, kbps: number) {
  const wav = join(work, `${id}.wav`);
  writeWav(wav, L, R);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-b:a', `${kbps}k`, join(out, `${id}.mp3`)]);
  rmSync(wav, { force: true });
}
/** Integrated loudness (LUFS) and true peak (dBTP) of a file, from ffmpeg's loudnorm analysis. */
function loudness(file: string) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  const j = JSON.parse(r.stderr.slice(r.stderr.lastIndexOf('{'), r.stderr.lastIndexOf('}') + 1));
  return { i: parseFloat(j.input_i), tp: parseFloat(j.input_tp) };
}
/** One constant gain to the target loudness (a varying gain would break the loop), then soft peaks. */
function normalise(id: string, L: Float32Array, R: Float32Array) {
  let peak = 0; for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  for (let i = 0; i < L.length; i++) { L[i] *= .5 / peak; R[i] *= .5 / peak; }
  const wav = join(work, `${id}-probe.wav`);
  writeWav(wav, L, R);
  const { i: lufs } = loudness(wav); rmSync(wav, { force: true });
  const g = 10 ** ((TARGET_LUFS - lufs) / 20), knee = .5, ceil = .74;
  const soft = (x: number) => { const a = Math.abs(x); return a <= knee ? x : Math.sign(x) * (knee + (ceil - knee) * Math.tanh((a - knee) / (ceil - knee))); };
  for (let i = 0; i < L.length; i++) { L[i] = soft(L[i] * g); R[i] = soft(R[i] * g); }
}

// ———————————————————————————————————————— build

const args = process.argv.slice(2), only = args.filter(a => !a.startsWith('--'));
const reportPath = args.find(a => a.startsWith('--report='))?.slice(9);
const metaPath = join(out, 'music.json');
type Meta = { overlap: number; tracks: Record<string, { file: string; loop: number; title: string; fade?: number }> };
const old: Meta | null = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : null;
const meta: Meta = { overlap: OVERLAP, tracks: {} };
const report: unknown[] = [];
for (const song of SONGS) {
  if (only.length && !only.includes(song.id)) { meta.tracks[song.id] = old?.tracks[song.id] ?? { file: `${song.id}.mp3`, loop: 0, title: song.title }; continue; }
  const t = Date.now(), { L, R, loop, info } = render(song);
  normalise(song.id, L, R);
  encode(song.id, L, R, 128);
  let lufs = loudness(join(out, `${song.id}.mp3`));
  // The encoder trims the very top, which K-weighting counts: correct once with a constant gain.
  if (Math.abs(lufs.i - TARGET_LUFS) > .15) {
    const g = dB(TARGET_LUFS - lufs.i); for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }
    encode(song.id, L, R, 128); lufs = loudness(join(out, `${song.id}.mp3`));
  }
  meta.tracks[song.id] = { file: `${song.id}.mp3`, loop, title: song.title };
  report.push({ ...info, loop: +loop.toFixed(3), lufs: lufs.i, truePeak: lufs.tp });
  console.log(`${song.id}: ${loop.toFixed(1)} s, ${lufs.i} LUFS, ${lufs.tp} dBTP, triads ${info.plainTriadPct}%, chord tones on strong beats ${info.strongChordTonePct}% (${((Date.now() - t) / 1000).toFixed(1)} s)`);
}
writeFileSync(metaPath, JSON.stringify(meta, null, 1));
if (reportPath) {
  const prev: { id: string }[] = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : [];
  const merged = [...prev.filter(p => !report.some(r => (r as { id: string }).id === p.id)), ...report];
  writeFileSync(reportPath, JSON.stringify(merged, null, 1));
}
rmSync(work, { recursive: true, force: true });
console.log('music.json written');
