'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import '../app/house.css';

/**
 * The haunted house. It is mounted once and then only hidden while the grimoire is open, so the
 * game (and its music) keeps running across pages, the way a single-page app should.
 */
export default function HouseHost({ active }) {
  const ref = useRef(null);
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let stop = null, cancelled = false;
    import('../game/main')
      .then(({ startHouse }) => { if (!cancelled && ref.current) stop = startHouse(ref.current); })
      .catch(err => { console.error(err); setFailed(true); });
    const go = e => { if (typeof e.detail === 'string') router.push(e.detail); };
    window.addEventListener('nekogaku:go', go);
    return () => { cancelled = true; window.removeEventListener('nekogaku:go', go); stop?.(); };
  }, [router]);
  useEffect(() => {
    // The canvas was hidden, so it has to measure itself again when it comes back.
    if (active) window.dispatchEvent(new Event('resize'));
  }, [active]);
  return (
    <main className="house-root" hidden={!active}>
      <div ref={ref} className="house-mount" />
      <noscript><p className="house-error">The haunted house needs JavaScript. The <a href="/study">Grimoire</a> works without it.</p></noscript>
      {failed && <p className="house-error">The house could not wake up. Reload the page, or open the <a href="/study">Grimoire</a>.</p>}
    </main>
  );
}
