import EnterForm from '../../components/EnterForm';
import Haunt from '../../components/Haunt';
import '../study/study.css';

export const metadata = { title: 'Knock knock · NekoGaku' };

export default async function Enter({ searchParams }) {
  const { next } = await searchParams;
  const safeNext = typeof next === 'string' && /^\/(study(\/[a-z0-9-]+){0,2})?$/.test(next) ? next : '/';
  return (
    <div className="grimoire">
      <Haunt />
      <main className="g-main door">
        <section className="g-hero">
          <h1>Sign in</h1>
          <p>Three cats live in this haunted house: <b>Cecil</b>, <b>Kuku</b> and <b>Bolu</b>. Whisper your access code to open the door. Your cats and your grimoire progress follow the code to any device.</p>
        </section>
        <EnterForm next={safeNext} />
        <p className="hint">Need a code? Ask whoever shared this link.</p>
      </main>
    </div>
  );
}
