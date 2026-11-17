/**
 * Builds quizzes from units (R10.5): every question has exactly one correct option and no duplicate
 * options, and the same (unit, seed) always gives the same quiz. Every question explains itself:
 * `explain` says why the answer is right, and `notes[i]` says what option i really means, so a wrong
 * pick is explained too (the explanation comes from the cards' own data).
 * Pure and shared by the browser (components/Lesson.jsx, components/Exam.jsx) and the tests.
 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hashSeed(text, seed = 0) {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const norm = s => String(s ?? '').trim();
const asOption = o => (typeof o === 'string' ? { text: o, note: '' } : { text: o?.text, note: o?.note || '' });

/**
 * One multiple-choice question: the correct option plus up to `n - 1` distractors whose text differs
 * from it and from each other. Options are strings or { text, note }. Returns null if no distractor exists.
 */
export function makeQuestion({ prompt, sub, correct, distractors, explain, audio, kind }, rand, n = 4) {
  const right = asOption(correct); right.text = norm(right.text);
  if (!right.text) return null;
  const seen = new Set([right.text]), wrong = [];
  for (const d of shuffle(distractors.map(asOption), rand)) { const t = norm(d.text); if (!t || seen.has(t)) continue; seen.add(t); wrong.push({ text: t, note: d.note }); if (wrong.length >= n - 1) break; }
  if (!wrong.length) return null;
  const all = shuffle([right, ...wrong], rand);
  return { prompt, sub: sub || '', options: all.map(o => o.text), notes: all.map(o => o.note), answer: all.indexOf(right), explain: explain || '', audio: audio || '', kind };
}

const say = c => c.reading ? `${c.jp}（${c.reading}）` : c.jp;
const exampleLine = c => c.ex ? ` Example: ${c.ex.ja} (“${c.ex.en}”)` : '';

function cardQuestion(unitKind, c, rest, flip, rand) {
  const why = `${say(c)} means “${c.en}”.${c.note ? ` ${c.note}.` : ''}${exampleLine(c)}`.replace(/\.\./g, '.');
  if (unitKind === 'grammar' && c.ex?.ja && flip) {
    return makeQuestion({ prompt: c.ex.ja, sub: `Which pattern does this sentence use? (“${c.ex.en}”)`, correct: { text: c.jp, note: c.en }, distractors: rest.map(o => ({ text: o.jp, note: o.en })), explain: `${c.jp} means “${c.en}”.${c.note ? ` ${c.note}.` : ''} The sentence means “${c.ex.en}”.`, audio: c.ex.audio, kind: 'pattern' }, rand);
  }
  if (flip && unitKind !== 'grammar') {
    return makeQuestion({ prompt: c.en, sub: 'Which Japanese matches?', correct: { text: say(c), note: c.en }, distractors: rest.map(o => ({ text: say(o), note: o.en })), explain: why, audio: c.audio, kind: 'to-jp' }, rand);
  }
  return makeQuestion({ prompt: c.jp, sub: c.reading ? `${c.reading} · What does it mean?` : 'What does it mean?', correct: { text: c.en, note: say(c) }, distractors: rest.map(o => ({ text: o.en, note: say(o) })), explain: why, audio: c.audio, kind: 'to-en' }, rand);
}

/** `pool`: extra cards from the same track for distractors when the unit is small. */
export function buildQuiz(unit, seed, { count = 10, pool = [] } = {}) {
  const rand = rng(hashSeed(unit.id, seed));
  const cards = unit.cards || [], others = [...cards, ...pool];
  const qs = [];
  if (unit.kind === 'ssw') {
    for (const q of unit.questions || []) {
      const made = makeQuestion({ prompt: q.q, correct: q.options[q.answer], distractors: q.options.filter((_, i) => i !== q.answer), explain: q.why, kind: 'scenario' }, rand);
      if (made) qs.push(made);
    }
  }
  const picks = shuffle(cards, rand);
  for (let i = 0; i < picks.length && qs.length < count; i++) {
    const c = picks[i], flip = rand() < .5;
    const rest = others.filter(o => o !== c && o.jp !== c.jp && o.en !== c.en);
    const q = cardQuestion(unit.kind, c, rest, flip, rand);
    if (q) qs.push(q);
  }
  return qs.slice(0, count);
}

/** A mock exam (simulation): a few questions from each of several units, mixed. */
export function buildExam(units, seed, count = 20) {
  const rand = rng(hashSeed(units.map(u => u.id).join(','), seed));
  const per = Math.max(1, Math.ceil(count / Math.max(1, units.length)));
  const all = units.flatMap(u => buildQuiz(u, seed, { count: per, pool: units.filter(o => o.kind === u.kind && o !== u).flatMap(o => o.cards).slice(0, 40) }).map(q => ({ ...q, unit: u.title })));
  return shuffle(all, rand).slice(0, count);
}
