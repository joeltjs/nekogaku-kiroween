'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { buildExam } from '../lib/quiz';
import { Explain } from './Lesson';

const CAT_NAMES = { cecil: 'Cecil', kuku: 'Kuku', bolu: 'Bolu' };
const LIMIT = 10 * 60;
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * The mock exam (simulation): 20 mixed questions from across the track, no feedback while you
 * answer, a 10-minute clock, then a full review with an explanation for every question.
 */
export default function Exam({ track, units }) {
  const [seed, setSeed] = useState(0);
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState([]);
  const [done, setDone] = useState(false);
  const [left, setLeft] = useState(LIMIT);
  const [result, setResult] = useState(null);
  const [buddy, setBuddy] = useState('cecil');
  useEffect(() => { setSeed(Date.now() % 100000); try { setBuddy(localStorage.getItem('nekogaku-buddy') || 'cecil'); } catch { /* fine */ } }, []);
  const exam = useMemo(() => buildExam(units, seed, 20), [units, seed]);
  useEffect(() => {
    if (done || !seed) return;
    const t = setInterval(() => setLeft(v => { if (v <= 1) { clearInterval(t); finish(); return 0; } return v - 1; }), 1000);
    return () => clearInterval(t);
  });

  async function finish(final = picks) {
    if (done) return;
    setDone(true);
    const correct = exam.reduce((s, q, k) => s + (final[k] === q.answer ? 1 : 0), 0), total = exam.length;
    setResult({ correct, total, pending: true });
    try {
      const r = await fetch('/api/progress', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ unitId: `exam-${track.id}`, correct, total, cat: buddy, label: `${track.title} mock exam` }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'save failed');
      setResult({ correct, total, ...data });
    } catch (e) { setResult({ correct, total, error: String(e.message || e) }); }
  }
  function choose(k) {
    const next = [...picks]; next[i] = k; setPicks(next);
    if (i + 1 < exam.length) setI(i + 1); else finish(next);
  }

  if (!seed || !exam.length) return <section className="lesson"><p>Summoning the exam…</p></section>;

  if (!done) {
    const q = exam[i], jpPrompt = q.kind === 'to-en' || q.kind === 'pattern';
    return (
      <section className="lesson">
        <header className="lesson-head">
          <h1>{track.title} · Mock exam</h1>
          <p className="step">Question {i + 1} of {exam.length} · <span className="timer">Time left {fmt(left)}</span> · answers are revealed at the end</p>
          <div className="pips" aria-hidden="true">{exam.map((_, k) => <i key={k} className={k === i ? 'on' : k < picks.length ? 'seen' : ''} />)}</div>
        </header>
        <article className="card quiz" key={`e${i}`}>
          <p className="q-sub">{q.unit}</p>
          <p className={jpPrompt ? 'q-jp' : 'q-en'} lang={jpPrompt ? 'ja' : 'en'}>{q.prompt}</p>
          {q.sub && <p className="q-sub">{q.sub}</p>}
          <div className="options" role="group" aria-label="Answers">
            {q.options.map((o, k) => <button type="button" key={k} className="opt" onClick={() => choose(k)} lang={q.kind === 'to-jp' || q.kind === 'pattern' ? 'ja' : undefined}><kbd>{k + 1}</kbd>{o}</button>)}
          </div>
        </article>
        <div className="lesson-nav">
          <button type="button" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>Previous question</button>
          <button type="button" className="ghost" onClick={() => finish()}>Finish now</button>
        </div>
      </section>
    );
  }

  const r = result ?? { correct: 0, total: exam.length };
  const pass = r.correct * 10 >= r.total * 6;
  return (
    <section className="lesson result">
      <h1>{pass ? 'You survived the exam' : 'The exam haunts you…'}</h1>
      <p className="score"><b>{r.correct}</b> / {r.total}</p>
      <p className="hint">{pass ? 'Pass line: 60%. Well done.' : 'Pass line: 60%. Read the explanations below and try again.'} Time used: {fmt(LIMIT - left)}</p>
      <p className="hint">{r.correct * 100 >= r.total * 80 ? 'This score counts toward opening the last ten Halloween items.' : 'Score 80% or more to count toward opening the last ten Halloween items.'}</p>
      {r.exp > 0 && <p className="reward"><b>{CAT_NAMES[r.cat] ?? 'Your cat'}</b> gains <b>+{r.exp} EXP</b> in the haunted house.</p>}
      {r.error && <p className="error">Could not save the result ({r.error}).</p>}
      <div className="lesson-nav">
        <Link className="primary" href="/">Visit the cats</Link>
        <button type="button" onClick={() => { setDone(false); setPicks([]); setI(0); setLeft(LIMIT); setResult(null); setSeed(s => s + 7); }}>New exam</button>
        <Link href={`/study/${track.id}`}>Back to {track.title}</Link>
      </div>
      <h2 className="g-section">Review: every answer, explained</h2>
      <div className="review">
        {exam.map((q, k) => {
          const ok = picks[k] === q.answer, jp = q.kind === 'to-en' || q.kind === 'pattern';
          return (
            <article key={k} className={ok ? 'ok' : 'bad'}>
              <p className="rq"><span className="tag">{ok ? 'Correct' : picks[k] == null ? 'Skipped' : 'Wrong'}</span><b>{k + 1}.</b> <span lang={jp ? 'ja' : undefined}>{q.prompt}</span> <small className="hint">· {q.unit}</small></p>
              {picks[k] == null ? <p className="ra"><b>Not answered.</b></p> : null}
              <div className="rx"><Explain q={q} picked={picks[k] ?? null} /></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
