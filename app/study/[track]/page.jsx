import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTrack } from '../../../lib/curriculum';
import { readPlayer } from '../../../lib/player';
import { passedExamTracks } from '../../../lib/curriculum';
import { trackName } from '../../../game/sim/unlock';

export const dynamic = 'force-dynamic';

const KIND_LABEL = { vocab: 'Vocabulary', kanji: 'Kanji', grammar: 'Grammar', ssw: 'Units' };

export async function generateMetadata({ params }) {
  const { track } = await params;
  return { title: `${track.toUpperCase()} · The Grimoire` };
}

export default async function TrackPage({ params }) {
  const { track: id } = await params;
  const player = await readPlayer();
  if (!player) redirect(`/login?next=/study/${id}`);
  const track = await getTrack(id, player);
  const passed = track ? (await passedExamTracks(player)).includes(track.id) : false;
  if (!track) notFound();
  const groups = Object.entries(Object.groupBy ? Object.groupBy(track.units, u => u.kind) : track.units.reduce((m, u) => ((m[u.kind] ??= []).push(u), m), {}));
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/study">Grimoire</Link> <span className="crumb-sep" aria-hidden="true">›</span> <span className="crumb current" aria-current="page">{track.title}</span></nav>
      <section className="g-hero small"><h1>{track.title}</h1><p>{track.subtitle}</p></section>
      <div className="exam-cta"><p><b>Mock exam</b> · 20 mixed questions from all of {track.title}, 10 minutes, answers and explanations at the end. Score 80% or more to count toward opening the last ten Halloween items{passed ? ' (passed on your best try)' : ''}.</p><Link href={`/study/${track.id}/exam`}>Start the simulation</Link></div>
      {groups.map(([kind, units]) => (
        <section key={kind}>
          <h2 className="g-section">{KIND_LABEL[kind]} <small>{units.length} units</small></h2>
          <ol className="units">
            {units.map(u => {
              const sealed = u.best != null && u.best * 10 >= u.total * 8;
              return (
                <li key={u.id}>
                  <Link href={`/study/${track.id}/${u.id}`} className={`unit ${sealed ? 'sealed' : u.best != null ? 'tried' : ''}`}>
                    <b>{u.title}</b>
                    <span lang="ja">{u.subtitle}</span>
                    <small>{u.size} cards{u.best != null ? ` · best ${u.best}/${u.total}` : ''}{sealed ? ' · sealed' : ''}</small>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </>
  );
}
