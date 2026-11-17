// Rebuilds the curriculum tables from data/. Progress is kept. Audio paths are attached for every
// clip that exists in public/audio/voice (run `npm run voice:build` first to have them).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { db, databaseUrl } from '../lib/db.js';
import { buildContent } from '../lib/content-build.js';
import { voiceFile } from '../lib/voice.js';

const client = db();
const { tracks, units } = buildContent();
const voiceDir = join(process.cwd(), 'public/audio/voice');
let withAudio = 0, clips = 0;
const audio = text => { if (!text) return undefined; const f = voiceFile(text); if (existsSync(join(voiceDir, f))) { clips++; return `/audio/voice/${f}`; } return undefined; };

for (const u of units) {
  for (const c of u.cards) {
    const a = audio(u.kind === 'vocab' || u.kind === 'ssw' ? (c.reading || c.jp) : '');
    if (a) { c.audio = a; withAudio++; }
    if (c.ex && (u.kind === 'grammar' || u.kind === 'ssw')) { const e = audio(c.ex.ja); if (e) c.ex.audio = e; }
    for (const m of c.more || []) { const e = audio(m.ja); if (e) m.audio = e; }
  }
}

const stmts = [
  'DELETE FROM units', 'DELETE FROM tracks',
  ...tracks.map(t => ({ sql: 'INSERT INTO tracks (id, ord, title, subtitle, kind) VALUES (?, ?, ?, ?, ?)', args: [t.id, t.ord, t.title, t.subtitle, t.kind] })),
];
await client.batch(stmts, 'write');
// Units in batches, so a big level does not make one huge statement list.
for (let i = 0; i < units.length; i += 100) {
  await client.batch(units.slice(i, i + 100).map(u => ({
    sql: 'INSERT INTO units (id, track_id, ord, kind, title, subtitle, size, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [u.id, u.track, u.ord, u.kind, u.title, u.subtitle, u.cards.length, JSON.stringify({ intro: u.intro ?? null, cards: u.cards, questions: u.questions ?? [] })],
  })), 'write');
}
await client.execute({ sql: 'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', args: ['seeded_at', new Date().toISOString()] });
const cards = units.reduce((s, u) => s + u.cards.length, 0);
console.log(`${tracks.length} tracks, ${units.length} units, ${cards} cards (${withAudio} cards with audio, ${clips} clips linked) → ${databaseUrl()}`);
