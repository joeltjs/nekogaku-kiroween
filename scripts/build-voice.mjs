// Generates Japanese audio with a local VOICEVOX Engine (R11.1). Offline batch; the app never
// calls the engine. Incremental: clips that already exist are skipped.
//
//   docker run -d --rm --name nekogaku-voicevox -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:cpu-latest
//   npm run voice:build            # all clips
//   npm run voice:build -- --limit=50
//
// Voice: VOICEVOX:四国めたん (speaker 2, ノーマル). Output: public/audio/voice/<hash>.mp3 (mono, 40 kbps)
// and data/voice-manifest.json. Needs ffmpeg.
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { buildContent, spokenTexts } from '../lib/content-build.js';
import { SPEAKER, voiceFile } from '../lib/voice.js';

const run = promisify(execFile);
const ENGINE = process.env.VOICEVOX_URL || 'http://127.0.0.1:50021';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const LIMIT = Number(args.limit) || Infinity, JOBS = Number(args.jobs) || 3;
const out = join(process.cwd(), 'public/audio/voice');
mkdirSync(out, { recursive: true });

// The game's own words: the ten Halloween items and the five costumes (game/halloween/items.ts).
const GAME_WORDS = ['かぼちゃ', 'かんおけ', 'おばけ', 'まんげつ', 'こうもり', 'ほうき', 'なべ', 'かれき', 'ろうそく', 'くも', 'きゅうけつき', 'おおかみおとこ', 'まじょ', 'かぼちゃランタン', 'くものす', 'ほね', 'ポーション', 'ミイラ'];

const { units } = buildContent();
const texts = new Set(GAME_WORDS);
for (const u of units) for (const c of u.cards) for (const t of spokenTexts(c, u.kind)) texts.add(t.replace(/[〜~]/g, '').trim());
const all = [...texts].filter(Boolean);
const missing = all.filter(t => !existsSync(join(out, voiceFile(t)))), todo = missing.slice(0, LIMIT);
console.log(`${all.length} texts, ${all.length - missing.length} already built, ${todo.length} to build now (${JOBS} at a time)`);

const version = await fetch(`${ENGINE}/version`).then(r => r.text()).catch(() => null);
if (!version) { console.error(`VOICEVOX Engine is not reachable at ${ENGINE}. Start it first (see the top of this file).`); process.exit(1); }
console.log(`VOICEVOX Engine ${version}`);

const tmp = join(tmpdir(), `nekogaku-voice-${process.pid}`); mkdirSync(tmp, { recursive: true });
let done = 0, failed = 0;
const started = Date.now();
async function one(text) {
  const q = await fetch(`${ENGINE}/audio_query?speaker=${SPEAKER}&text=${encodeURIComponent(text)}`, { method: 'POST' });
  if (!q.ok) throw new Error(`audio_query ${q.status}`);
  const query = await q.json();
  // Words a touch slower than sentences, with a little air before and after.
  query.speedScale = text.length <= 8 ? .92 : 1;
  query.prePhonemeLength = .08; query.postPhonemeLength = .12;
  const s = await fetch(`${ENGINE}/synthesis?speaker=${SPEAKER}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(query) });
  if (!s.ok) throw new Error(`synthesis ${s.status}`);
  const wav = join(tmp, `${voiceFile(text)}.wav`);
  writeFileSync(wav, Buffer.from(await s.arrayBuffer()));
  await run('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-ac', '1', '-ar', '24000', '-b:a', '40k', join(out, voiceFile(text))]);
  rmSync(wav, { force: true });
}
const queue = [...todo];
await Promise.all(Array.from({ length: JOBS }, async () => {
  while (queue.length) {
    const t = queue.shift();
    try { await one(t); } catch (e) { failed++; console.warn(`failed: ${t} (${e.message})`); }
    if (++done % 200 === 0) { const rate = done / ((Date.now() - started) / 1000); console.log(`${done}/${todo.length} · ${rate.toFixed(1)} clips/s · ~${Math.round((todo.length - done) / rate / 60)} min left`); }
  }
}));
rmSync(tmp, { recursive: true, force: true });
const manifest = Object.fromEntries(all.filter(t => existsSync(join(out, voiceFile(t)))).map(t => [t, voiceFile(t)]));
writeFileSync(join(process.cwd(), 'data/voice-manifest.json'), JSON.stringify({ speaker: SPEAKER, credit: 'VOICEVOX:四国めたん', clips: manifest }, null, 0));
console.log(`built ${done - failed}, failed ${failed}; manifest has ${Object.keys(manifest).length} clips. Run npm run db:seed to link them.`);
