'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildQuiz } from '../lib/quiz';

const CAT_NAMES = { cecil: 'Cecil', kuku: 'Kuku', bolu: 'Bolu' };

function play(src) { if (!src) return; const a = new Audio(src); a.volume = .95; a.play().catch(() => {}); }
function Say({ src, label = 'Play audio' }) {
  if (!src) return null;
  return <button type="button" className="say" onClick={() => play(src)} aria-label={label} title={label}><svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>;
}

/** Why the answer is right, and what the wrong pick really means (built from the cards). */
export function Explain({ q, picked }) {
  const wrong = picked != null && picked !== q.answer;
  return (
    <>
      {wrong && <p><b>You chose:</b> <span lang={q.kind === 'to-jp' || q.kind === 'pattern' ? 'ja' : undefined}>{q.options[picked]}</span>{q.notes?.[picked] ? <> (that is <span lang={q.kind === 'to-en' ? 'ja' : undefined}>{q.notes[picked]}</span>).</> : '.'}</p>}
      <p><b>Answer:</b> <span lang={q.kind === 'to-jp' || q.kind === 'pattern' ? 'ja' : undefined}>{q.options[q.answer]}</span></p>
      {q.explain && <p className="why">{q.explain}</p>}
    </>
  );
}

/** Study cards, then a quiz, then the result that feeds the study buddy cat (R10.4, R10.6). */
export default function Lesson({ unit }) {
  const [phase, setPhase] = useState('cards');
  const [i, setI] = useState(0);
  const [seed, setSeed] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);
  const [buddy, setBuddy] = useState('cecil');
  const nextRef = useRef(null);
  useEffect(() => { try { setBuddy(localStorage.getItem('nekogaku-buddy') || 'cecil'); } catch { /* fine */ } setSeed(Date.now() % 100000); }, []);
  const quiz = useMemo(() => buildQuiz(unit, seed, { count: 10, pool: unit.pool }), [unit, seed]);
  const cards = unit.cards;

  // Keyboard: arrows for cards, 1–4 for answers, Enter for next.
  useEffect(() => {
    const onKey = e => {
      if (phase === 'cards') { if (e.key === 'ArrowRight') setI(v => Math.min(cards.length - 1, v + 1)); if (e.key === 'ArrowLeft') setI(v => Math.max(0, v - 1)); }
      if (phase === 'quiz') {
        const n = Number(e.key); if (picked == null && n >= 1 && n <= (quiz[i]?.options.length ?? 0)) choose(n - 1);
        if (picked != null && e.key === 'Enter') nextRef.current?.click();
      }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => { if (phase === 'cards') play(cards[i]?.audio); }, [phase, i, cards]);

  function choose(k) {
    if (picked != null) return;
    setPicked(k);
    const q = quiz[i], ok = k === q.answer;
    setAnswers(a => [...a, ok]);
    if (q.audio) play(q.audio);
  }
  async function next() {
    if (i + 1 < quiz.length) { setI(i + 1); setPicked(null); return; }
    const correct = answers.filter(Boolean).length, total = quiz.length;
    setPhase('result'); setResult({ correct, total, pending: true });
    try {
      const r = await fetch('/api/progress', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ unitId: unit.id, correct, total, cat: buddy, label: unit.title }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'save failed');
      setResult({ correct, total, ...data });
    } catch (e) { setResult({ correct, total, error: String(e.message || e) }); }
  }
  function restart(mode) { setPhase(mode); setI(0); setAnswers([]); setPicked(null); setResult(null); setSeed(s => s + 1); }

  if (phase === 'cards') {
    const c = cards[i];
    return (
      <section className="lesson">
        <header className="lesson-head">
          <h1>{unit.title}</h1>
          {unit.intro && <p className="intro">{unit.intro}</p>}
          <p className="step">Card {i + 1} of {cards.length}</p>
          <div className="pips" aria-hidden="true">{cards.map((_, k) => <i key={k} className={k === i ? 'on' : k < i ? 'seen' : ''} />)}</div>
        </header>
        <article className="card" key={i}>
          <div className="card-jp"><span lang="ja">{c.jp}</span><Say src={c.audio} label={`Hear ${c.jp}`} /></div>
          {c.reading && <p className="card-reading" lang="ja">{c.reading}</p>}
          <p className="card-en">{c.en}</p>
          {c.note && <p className="card-note">{c.note}</p>}
          {c.ex && <div className="card-ex"><p lang="ja">{c.ex.ja} <Say src={c.ex.audio} label="Hear the example" /></p><p>{c.ex.en}</p></div>}
          {c.more?.map((m, k) => <div className="card-ex" key={k}><p lang="ja">{m.ja} <Say src={m.audio} label="Hear the example" /></p><p>{m.en}</p></div>)}
        </article>
        <div className="lesson-nav">
          <button type="button" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>Previous card</button>
          {i + 1 < cards.length
            ? <button type="button" className="primary" onClick={() => setI(i + 1)}>Next card</button>
            : <button type="button" className="primary" onClick={() => restart('quiz')}>Start the quiz</button>}
          <button type="button" className="ghost" onClick={() => restart('quiz')}>Skip to quiz</button>
        </div>
      </section>
    );
  }

  if (phase === 'quiz') {
    const q = quiz[i];
    if (!q) return <section className="lesson"><p>This unit has no quiz yet.</p></section>;
    const jpPrompt = q.kind === 'to-en' || q.kind === 'pattern';
    return (
      <section className="lesson">
        <header className="lesson-head">
          <h1>{unit.title} · Quiz</h1>
          <p className="step">Question {i + 1} of {quiz.length} · {answers.filter(Boolean).length} correct</p>
          <div className="pips" aria-hidden="true">{quiz.map((_, k) => <i key={k} className={k === i ? 'on' : k < answers.length ? (answers[k] ? 'ok' : 'bad') : ''} />)}</div>
        </header>
        <article className="card quiz" key={`q${i}`}>
          <p className={jpPrompt ? 'q-jp' : 'q-en'} lang={jpPrompt ? 'ja' : 'en'}>{q.prompt}</p>
          {q.sub && <p className="q-sub">{q.sub}</p>}
          <div className="options" role="group" aria-label="Answers">
            {q.options.map((o, k) => {
              const state = picked == null ? '' : k === q.answer ? 'right' : k === picked ? 'wrong' : 'dim';
              return <button type="button" key={k} className={`opt ${state}`} onClick={() => choose(k)} disabled={picked != null} lang={q.kind === 'to-jp' || q.kind === 'pattern' ? 'ja' : undefined}><kbd>{k + 1}</kbd>{o}</button>;
            })}
          </div>
          {picked != null && (
            <div className={`verdict ${picked === q.answer ? 'right' : 'wrong'}`} role="status">
              <strong>{picked === q.answer ? 'Correct! The spell holds.' : 'The spell fizzles…'}</strong>
              <Explain q={q} picked={picked} />
              <button ref={nextRef} type="button" className="primary" onClick={next}>{i + 1 < quiz.length ? 'Next question' : 'See the result'}</button>
            </div>
          )}
        </article>
      </section>
    );
  }

  const r = result ?? { correct: 0, total: 0 };
  const sealed = r.total && r.correct * 10 >= r.total * 8;
  return (
    <section className="lesson result">
      <h1>{sealed ? 'Unit sealed' : 'The trial is over'}</h1>
      <p className="score"><b>{r.correct}</b> / {r.total}</p>
      {r.pending && <p>Writing it in the grimoire…</p>}
      {r.error && <p className="error">Could not save the result ({r.error}). Your answers still count here.</p>}
      {r.exp > 0 && <p className="reward"><b>{CAT_NAMES[r.cat] ?? 'Your cat'}</b> gains <b>+{r.exp} EXP</b> in the haunted house.</p>}
      {r.best != null && <p className="hint">Best score here: {r.best}/{r.total} · attempts: {r.attempts}</p>}
      <div className="lesson-nav">
        <Link className="primary" href="/">Visit {CAT_NAMES[r.cat] ?? 'the cats'}</Link>
        <button type="button" onClick={() => restart('quiz')}>Retry the trial</button>
        <button type="button" onClick={() => restart('cards')}>Study the cards again</button>
        {unit.next && <Link href={`/study/${unit.track}/${unit.next}`}>Next unit</Link>}
      </div>
    </section>
  );
}
