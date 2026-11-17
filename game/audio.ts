/**
 * Sound (R11.2, R11.3). Effects are synthesized on the spot with Web Audio: meows, purrs, pops,
 * boings, the barbell's clank, a camera shutter. No recorded or third-party sounds.
 * Music is one of our synthesized tracks, looped seamlessly over its built-in overlap.
 */
import type { CatId } from './art/cat-look';

type Sfx = 'meow' | 'purr' | 'pop' | 'boing' | 'bat' | 'land' | 'whoosh' | 'clank' | 'sparkle' | 'levelup' | 'shutter' | 'tap' | 'howl' | 'poof' | 'flap';
/** Each cat's own voice: base pitch (Hz) and how much it slides. */
const VOICE: Record<CatId, { f: number; slide: number; len: number }> = {
  cecil: { f: 520, slide: .75, len: .5 },
  kuku: { f: 760, slide: 1.25, len: .38 },
  bolu: { f: 430, slide: .85, len: .6 },
};

interface MusicMeta { overlap: number; tracks: Record<string, { file: string; loop: number; title: string }> }

export class Audio {
  effects = true;
  music = true;
  voice = true;
  private ctx?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private last = new Map<string, number>();
  private track = '';
  private loopTimer = 0;
  private meta?: Promise<MusicMeta | null>;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private sources: AudioBufferSourceNode[] = [];

  /** Browsers allow sound only after a tap: call this from the first pointer event. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = .8; this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.music ? .55 : 0; this.musicBus.connect(this.master);
      if (this.track) { const t = this.track; this.track = ''; this.playMusic(t); }
    }
    void this.ctx.resume();
  }
  setMusic(on: boolean) {
    this.music = on;
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(on ? .55 : 0, this.ctx.currentTime, .4);
  }

  play(id: Sfx, cat?: CatId) {
    if (!this.effects || !this.ctx || !this.master) return;
    const gap = id === 'meow' || id === 'howl' ? 700 : id === 'flap' ? 180 : id === 'purr' ? 1600 : id === 'clank' ? 300 : 60, key = id + (cat ?? ''), now = performance.now();
    if (now - (this.last.get(key) ?? 0) < gap) return;
    this.last.set(key, now);
    const c = this.ctx, t = c.currentTime, out = this.master;
    const env = (g: GainNode, a: number, peak: number, d: number) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0005, t + a + d); };
    const osc = (type: OscillatorType, f: number) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; return o; };
    const noise = (sec: number) => { const b = c.createBuffer(1, Math.ceil(c.sampleRate * sec), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; };
    switch (id) {
      case 'meow': {
        // Two formant-filtered saws gliding up and down: "mi-aaow".
        const v = VOICE[cat ?? 'cecil'], len = v.len * (.9 + Math.random() * .25), f0 = v.f * (.94 + Math.random() * .12);
        const o = osc('sawtooth', f0), g = c.createGain(), bp = c.createBiquadFilter(), bp2 = c.createBiquadFilter();
        bp.type = 'bandpass'; bp.Q.value = 6; bp2.type = 'bandpass'; bp2.Q.value = 4;
        o.frequency.setValueAtTime(f0 * .85, t); o.frequency.linearRampToValueAtTime(f0 * (1 + .3 * v.slide), t + len * .35); o.frequency.linearRampToValueAtTime(f0 * .7, t + len);
        bp.frequency.setValueAtTime(900, t); bp.frequency.linearRampToValueAtTime(1500, t + len * .4); bp.frequency.linearRampToValueAtTime(800, t + len);
        bp2.frequency.setValueAtTime(2600, t); bp2.frequency.linearRampToValueAtTime(3200, t + len * .4);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.32, t + .05); g.gain.setValueAtTime(.3, t + len * .6); g.gain.exponentialRampToValueAtTime(.001, t + len);
        const vib = osc('sine', 6), vg = c.createGain(); vg.gain.value = f0 * .02; vib.connect(vg).connect(o.frequency);
        o.connect(bp).connect(g); o.connect(bp2).connect(g); g.connect(out);
        o.start(t); vib.start(t); o.stop(t + len + .05); vib.stop(t + len + .05);
        break;
      }
      case 'purr': {
        const n = noise(1.6), lp = c.createBiquadFilter(), g = c.createGain(), am = osc('sine', 26), ag = c.createGain();
        lp.type = 'lowpass'; lp.frequency.value = 260; ag.gain.value = .5; am.connect(ag).connect(g.gain);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.45, t + .2); g.gain.linearRampToValueAtTime(0, t + 1.6);
        n.connect(lp).connect(g).connect(out); n.start(t); am.start(t); am.stop(t + 1.6);
        break;
      }
      case 'pop': case 'tap': {
        const o = osc('sine', id === 'pop' ? 520 : 880), g = c.createGain(); o.frequency.exponentialRampToValueAtTime(id === 'pop' ? 1200 : 660, t + .08);
        env(g, .005, .25, .12); o.connect(g).connect(out); o.start(t); o.stop(t + .2); break;
      }
      case 'boing': {
        const o = osc('triangle', 180), g = c.createGain(); o.frequency.exponentialRampToValueAtTime(420, t + .12); o.frequency.exponentialRampToValueAtTime(220, t + .3);
        env(g, .005, .2, .3); o.connect(g).connect(out); o.start(t); o.stop(t + .35); break;
      }
      case 'bat': case 'land': {
        const n = noise(.12), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = id === 'bat' ? 1800 : 400; bp.Q.value = 1.2;
        env(g, .002, id === 'bat' ? .35 : .5, .1); n.connect(bp).connect(g).connect(out); n.start(t); break;
      }
      case 'whoosh': {
        const n = noise(.4), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.Q.value = .8;
        bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(2400, t + .3);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.25, t + .12); g.gain.linearRampToValueAtTime(0, t + .4);
        n.connect(bp).connect(g).connect(out); n.start(t); break;
      }
      case 'clank': {
        for (const [f, a] of [[310, .2], [823, .12], [1490, .08]] as const) { const o = osc('sine', f), g = c.createGain(); env(g, .002, a, .5); o.connect(g).connect(out); o.start(t); o.stop(t + .55); }
        break;
      }
      case 'sparkle': case 'levelup': {
        const notes = id === 'levelup' ? [660, 880, 990, 1320] : [1320, 1760, 2093];
        notes.forEach((f, i) => { const o = osc('triangle', f), g = c.createGain(), at = t + i * .09; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.16, at + .01); g.gain.exponentialRampToValueAtTime(.001, at + .5); o.connect(g).connect(out); o.start(at); o.stop(at + .55); });
        break;
      }
      case 'howl': {
        // A cat's "a-wooo": a long meow that rises, holds and falls, with a slow vibrato.
        const v = VOICE[cat ?? 'cecil'], f0 = v.f * .8, len = 1.5;
        const o = osc('sawtooth', f0), g = c.createGain(), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 5;
        o.frequency.setValueAtTime(f0 * .7, t); o.frequency.linearRampToValueAtTime(f0 * 1.35, t + .35); o.frequency.setValueAtTime(f0 * 1.35, t + .9); o.frequency.linearRampToValueAtTime(f0 * .75, t + len);
        bp.frequency.setValueAtTime(700, t); bp.frequency.linearRampToValueAtTime(1300, t + .4); bp.frequency.linearRampToValueAtTime(600, t + len);
        const vib = osc('sine', 5), vg = c.createGain(); vg.gain.value = f0 * .03; vib.connect(vg).connect(o.frequency);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.3, t + .15); g.gain.setValueAtTime(.28, t + 1.1); g.gain.exponentialRampToValueAtTime(.001, t + len);
        o.connect(bp).connect(g).connect(out); o.start(t); vib.start(t); o.stop(t + len + .05); vib.stop(t + len + .05);
        break;
      }
      case 'poof': {
        const n = noise(.5), lp = c.createBiquadFilter(), g = c.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(300, t + .45);
        g.gain.setValueAtTime(.45, t); g.gain.exponentialRampToValueAtTime(.001, t + .5); n.connect(lp).connect(g).connect(out); n.start(t);
        [880, 1320, 1760].forEach((f, i) => { const o = osc('sine', f), gg = c.createGain(), at = t + .05 + i * .06; gg.gain.setValueAtTime(0, at); gg.gain.linearRampToValueAtTime(.1, at + .01); gg.gain.exponentialRampToValueAtTime(.001, at + .35); o.connect(gg).connect(out); o.start(at); o.stop(at + .4); });
        break;
      }
      case 'flap': {
        const n = noise(.09), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = .9;
        env(g, .01, .18, .08); n.connect(bp).connect(g).connect(out); n.start(t); break;
      }
      case 'shutter': {
        for (const at of [0, .07]) { const n = noise(.05), hp = c.createBiquadFilter(), g = c.createGain(); hp.type = 'highpass'; hp.frequency.value = 2500; g.gain.setValueAtTime(.4, t + at); g.gain.exponentialRampToValueAtTime(.001, t + at + .05); n.connect(hp).connect(g).connect(out); n.start(t + at); }
        break;
      }
    }
  }

  private loadMeta() { return this.meta ??= fetch('/audio/music/music.json').then(r => r.ok ? r.json() as Promise<MusicMeta> : null).catch(() => null); }
  private load(file: string) {
    let p = this.buffers.get(file);
    if (!p) { p = fetch(`/audio/music/${file}`).then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(b => this.ctx!.decodeAudioData(b)).catch(() => null); this.buffers.set(file, p); }
    return p;
  }
  /** Loops a track from music.json; passes crossfade over the file's overlap so the loop is seamless. */
  async playMusic(id: string) {
    if (this.track === id) return;
    this.track = id;
    if (!this.ctx || !this.musicBus) return;
    const meta = await this.loadMeta(), info = meta?.tracks[id]; if (!info || this.track !== id) return;
    const buf = await this.load(info.file); if (!buf || this.track !== id) return;
    for (const s of this.sources) { try { s.stop(this.ctx.currentTime + 1); } catch { /* already stopped */ } }
    this.sources = [];
    window.clearTimeout(this.loopTimer);
    const loop = info.loop || buf.duration - (meta!.overlap || 0), fade = Math.min(2.2, meta!.overlap || 0);
    let next = this.ctx.currentTime + .05, first = true;
    const schedule = () => {
      if (this.track !== id || !this.ctx || !this.musicBus) return;
      while (next < this.ctx.currentTime + 6) {
        const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = buf; s.connect(g).connect(this.musicBus);
        g.gain.setValueAtTime(first ? 1 : 0, next); if (!first) g.gain.linearRampToValueAtTime(1, next + fade);
        g.gain.setValueAtTime(1, next + loop); g.gain.linearRampToValueAtTime(0, next + loop + fade);
        s.start(next); s.stop(next + loop + fade + .1); this.sources.push(s); this.sources = this.sources.slice(-4);
        first = false; next += loop;
      }
      this.loopTimer = window.setTimeout(schedule, 2000);
    };
    schedule();
  }
  stop() { this.track = ''; window.clearTimeout(this.loopTimer); for (const s of this.sources) { try { s.stop(); } catch { /* fine */ } } this.sources = []; void this.ctx?.close(); this.ctx = undefined; }
  /** Plays a generated VOICEVOX clip (the item words). */
  say(src: string) { if (!this.voice) return; const a = new window.Audio(src); a.volume = .9; void a.play().catch(() => undefined); }
}
