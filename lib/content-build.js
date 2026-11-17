/**
 * Builds the grimoire's tracks and units from data/ (OpenJLPT + our SSW units). Used by the seed
 * script, the voice build (to know which Japanese needs audio) and the content check.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'];
export const UNIT_SIZE = { vocab: 20, kanji: 20, grammar: 5 };
const root = process.cwd();
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const chunk = (list, n) => {
  const parts = Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
  // A tiny last unit (fewer than 8 cards, or 3 grammar points) joins the one before it.
  if (parts.length > 1 && parts[parts.length - 1].length < Math.min(8, Math.ceil(n * .6))) parts[parts.length - 2].push(...parts.pop());
  return parts;
};
const firstExample = ex => (Array.isArray(ex) && ex.find(e => e?.ja && e?.en)) || null;

/** Every JLPT card: { jp, reading, en, note?, ex? }. */
function vocabCards(level) {
  return read(`data/openjlpt/vocab/${level}.json`).filter(v => v.word && v.meanings?.length).map(v => {
    const ex = firstExample(v.examples);
    return { jp: v.word, reading: v.reading || '', en: v.meanings.slice(0, 3).join('; '), ...(ex ? { ex: { ja: ex.ja, en: ex.en } } : {}) };
  });
}
function kanjiCards(level) {
  return read(`data/openjlpt/kanji/${level}.json`).filter(k => k.character && k.meanings?.length).map(k => ({
    jp: k.character,
    reading: [...(k.onyomi || []).slice(0, 2), ...(k.kunyomi || []).slice(0, 2)].join('・'),
    en: k.meanings.slice(0, 3).join('; '),
    note: `${k.strokes} strokes · on: ${(k.onyomi || []).join('、') || 'none'} · kun: ${(k.kunyomi || []).join('、') || 'none'}`,
  }));
}
function grammarCards(level) {
  return read(`data/openjlpt/grammar/${level}.json`).filter(g => g.pattern && g.meaning).map(g => {
    const ex = firstExample(g.examples);
    return { jp: g.pattern, reading: '', en: g.meaning, note: g.formation ? `Form: ${g.formation}` : '', ...(ex ? { ex: { ja: ex.ja, en: ex.en } } : {}), more: (g.examples || []).slice(1, 3).filter(e => e.ja && e.en) };
  });
}

const span = cards => `${cards[0].jp} – ${cards[cards.length - 1].jp}`;

export function buildContent() {
  const tracks = [], units = [];
  LEVELS.forEach((level, li) => {
    const L = level.toUpperCase();
    tracks.push({ id: level, ord: li, title: `JLPT ${L}`, subtitle: ['Beginner: the first steps', 'Basic: everyday Japanese', 'Intermediate: the bridge', 'Upper intermediate: news and work', 'Advanced: native-level reading'][li], kind: 'jlpt' });
    let ord = 0;
    for (const [kind, cards, label] of [['vocab', vocabCards(level), 'Vocabulary'], ['kanji', kanjiCards(level), 'Kanji'], ['grammar', grammarCards(level), 'Grammar']]) {
      chunk(cards, UNIT_SIZE[kind]).forEach((part, i) => units.push({ id: `${level}-${kind}-${String(i + 1).padStart(3, '0')}`, track: level, ord: ord++, kind, title: `${label} ${i + 1}`, subtitle: span(part), cards: part }));
    }
  });
  for (const [i, file] of ['kaigo', 'food'].entries()) {
    const t = read(`data/ssw/${file}.json`);
    tracks.push({ id: t.id, ord: 10 + i, title: t.title, subtitle: t.subtitle, kind: 'ssw' });
    t.units.forEach((u, ord) => units.push({ id: u.id, track: t.id, ord, kind: 'ssw', title: u.title, subtitle: u.terms.slice(0, 3).map(x => x.jp).join('・'), intro: u.intro, cards: u.terms.map(x => ({ jp: x.jp, reading: x.reading === x.jp ? '' : x.reading, en: x.en, ...(x.note ? { note: x.note } : {}) })), questions: u.questions }));
  }
  return { tracks, units };
}

/** The Japanese strings that get VOICEVOX audio: what a card says, and its example sentence. */
export function spokenTexts(card, kind) {
  const out = [];
  if (kind === 'vocab' || kind === 'ssw') out.push(card.reading || card.jp);
  if (card.ex?.ja && (kind === 'grammar' || kind === 'ssw')) out.push(card.ex.ja);
  if (kind === 'grammar') for (const m of card.more || []) out.push(m.ja);
  return out.filter(t => t && t.length <= 120);
}
