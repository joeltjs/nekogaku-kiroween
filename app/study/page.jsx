import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listTracks } from '../../lib/curriculum';
import { readPlayer } from '../../lib/player';
import { passedExamTracks } from '../../lib/curriculum';
import { EXAM_TRACKS, START_ITEMS, allExamsPassed, examsPassed, trackName } from '../../game/sim/unlock';
import { ITEM_IDS } from '../../game/halloween/items';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'The Grimoire · NekoGaku' };

const SIGILS = { n5: '壱', n4: '弐', n3: '参', n2: '肆', n1: '伍', kaigo: '介', food: '食' };

export default async function StudyHub() {
  const player = await readPlayer();
  if (!player) redirect('/login?next=/study');
  const tracks = await listTracks(player);
  const passed = await passedExamTracks(player);
  const open = allExamsPassed(passed) ? ITEM_IDS.length : START_ITEMS.length;
  const jlpt = tracks.filter(t => t.kind === 'jlpt'), ssw = tracks.filter(t => t.kind === 'ssw');
  const card = t => (
    <Link key={t.id} href={`/study/${t.id}`} className="tomb">
      <span className="tomb-sigil" lang="ja" aria-hidden="true">{SIGILS[t.id]}</span>
      <h3>{t.title}</h3>
      <p>{t.subtitle}</p>
      <span className="tomb-meta">{t.units} units · {t.cards.toLocaleString('en')} cards</span>
      <span className="tomb-bar" aria-label={`${t.mastered} of ${t.units} units mastered`}><i style={{ width: `${t.units ? (t.mastered / t.units) * 100 : 0}%` }} /></span>
    </Link>
  );
  if (!tracks.length) return (
    <section className="g-hero">
      <h1>The grimoire is empty</h1>
      <p>No lessons are in the database yet. On the server, run <code>npm run setup</code> to create the tables and load the JLPT and SSW units, then reload this page.</p>
    </section>
  );
  return (
    <>
      <section className="g-hero">
        <h1>Open the grimoire</h1>
        <p>Every spell is a Japanese word. Study the cards, pass the quiz, and Cecil, the first cat in the haunted house, gains EXP. Score 80% or more to seal a unit.</p>
      </section>
      <section className="unlock-box" aria-labelledby="unlock-title">
        <h2 id="unlock-title">Halloween items: {open} of {ITEM_IDS.length} open</h2>
        <p>Start with five items. Pass each track's mock exam with 80% or more to open the last ten. Passed so far: {examsPassed(passed).length} of {EXAM_TRACKS.length}.</p>
        <ul>{EXAM_TRACKS.map(t => <li key={t} className={passed.includes(t) ? 'done' : ''}>{trackName(t)}: {passed.includes(t) ? 'passed' : 'mock exam not yet passed'}</li>)}</ul>
      </section>
      <h2 className="g-section">JLPT · N5 to N1</h2>
      <div className="tombs">{jlpt.map(card)}</div>
      <h2 className="g-section">Specified Skilled Worker (SSW)</h2>
      <div className="tombs">{ssw.map(card)}</div>
    </>
  );
}
