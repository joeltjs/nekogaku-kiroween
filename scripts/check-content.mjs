// Content check (R10.2–R10.7, R12.2): run by the Kiro hook on data changes and before a build.
//  - every track and unit has content, every SSW question has 4 options and a valid answer
//  - no Indonesian left in learner-facing text (data, UI code outside the ported rig in game/art)
//  - no third-party game asset names or music references
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildContent, LEVELS } from '../lib/content-build.js';

const root = process.cwd(), problems = [];
const { tracks, units } = buildContent();
for (const id of [...LEVELS, 'kaigo', 'food']) if (!tracks.some(t => t.id === id)) problems.push(`missing track ${id}`);
for (const u of units) {
  if (!u.cards.length) problems.push(`${u.id}: no cards`);
  for (const c of u.cards) if (!c.jp || !c.en) problems.push(`${u.id}: card without Japanese or English`);
  for (const q of u.questions || []) {
    if (q.options?.length !== 4 || new Set(q.options).size !== 4) problems.push(`${u.id}: question needs 4 different options: ${q.q}`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) problems.push(`${u.id}: bad answer index: ${q.q}`);
    if (!q.why) problems.push(`${u.id}: question without explanation: ${q.q}`);
  }
}

// Words that only appear in Indonesian (checked on learner-facing files).
const INDONESIAN = /\b(yang|dengan|untuk|tidak|kucing|belajar|sudah|kamu|kalau|karena|bagaimana|silakan|soal|jawaban|materi|latihan|makanan|rumah)\b/i;
const THIRD_PARTY = /(fantastic\s*cats|dazzleplay|harvest\s*moon|dragon\s*quest|\/assets\/fc\/)/i;
const scan = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? scan(p) : [p]; });
const files = ['app', 'components', 'lib', 'data/ssw', 'game/halloween', 'game/sim', 'game/main.ts', 'game/render.ts', 'game/audio.ts']
  .flatMap(p => statSync(join(root, p)).isDirectory() ? scan(join(root, p)) : [join(root, p)])
  .filter(f => /\.(jsx?|mjs|ts|json|css)$/.test(f));
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const where = `${relative(root, f)}:${i + 1}`;
    if (INDONESIAN.test(line)) problems.push(`${where}: Indonesian? ${line.trim().slice(0, 90)}`);
    if (THIRD_PARTY.test(line) && !f.endsWith('check-content.mjs')) problems.push(`${where}: third-party asset reference: ${line.trim().slice(0, 90)}`);
  });
}
for (const f of scan(join(root, 'public'))) if (/\/fc\/|harvest|dq\/|hm\//i.test(relative(root, f))) problems.push(`public asset not allowed: ${relative(root, f)}`);

const cards = units.reduce((s, u) => s + u.cards.length, 0);
if (problems.length) { console.error(problems.slice(0, 60).join('\n')); console.error(`\n${problems.length} problem(s).`); process.exit(1); }
console.log(`content ok: ${tracks.length} tracks, ${units.length} units, ${cards} cards, ${files.length} learner-facing files clean`);
