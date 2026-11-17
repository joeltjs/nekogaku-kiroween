import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import Exam from '../../../../components/Exam';
import Lesson from '../../../../components/Lesson';
import { getExamUnits, getUnit } from '../../../../lib/curriculum';
import { readPlayer } from '../../../../lib/player';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { track, unit } = await params;
  return { title: `${unit === 'exam' ? `${track.toUpperCase()} mock exam` : unit} · The Grimoire` };
}

export default async function UnitPage({ params }) {
  const { track, unit: unitId } = await params;
  if (!(await readPlayer())) redirect(`/login?next=/study/${track}/${unitId}`);
  if (unitId === 'exam') {
    const exam = await getExamUnits(track);
    if (!exam) notFound();
    return (
      <>
        <nav className="crumbs" aria-label="Breadcrumb"><Link href="/study">Grimoire</Link> <span className="crumb-sep" aria-hidden="true">›</span> <Link href={`/study/${track}`}>{exam.track.title}</Link> <span className="crumb-sep" aria-hidden="true">›</span> <span className="crumb current" aria-current="page">Mock exam</span></nav>
        <Exam track={exam.track} units={exam.units} />
      </>
    );
  }
  const unit = await getUnit(track, unitId);
  if (!unit) notFound();
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/study">Grimoire</Link> <span className="crumb-sep" aria-hidden="true">›</span> <Link href={`/study/${track}`}>{track.toUpperCase()}</Link> <span className="crumb-sep" aria-hidden="true">›</span> <span className="crumb current" aria-current="page">{unit.title}</span></nav>
      <Lesson unit={unit} />
    </>
  );
}
