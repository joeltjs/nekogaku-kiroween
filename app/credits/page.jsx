import Link from 'next/link';
import '../study/study.css';

export const metadata = { title: 'Credits · NekoGaku' };

export default function Credits() {
  return (
    <div className="grimoire">
      <main className="g-main credits">
        <nav className="crumbs"><Link href="/">Haunted house</Link> · <Link href="/study">Grimoire</Link></nav>
        <section className="g-hero small"><h1>Credits and licenses</h1></section>
        <h2>Voices</h2>
        <ul><li><b>VOICEVOX:四国めたん</b>. Japanese audio generated offline with the <a href="https://voicevox.hiroshiba.jp/">VOICEVOX</a> Engine. Use follows the VOICEVOX and character terms (credit shown here).</li></ul>
        <h2>Japanese data</h2>
        <ul>
          <li><a href="https://github.com/evanclan/OpenJLPT">OpenJLPT</a> (CC BY-SA 4.0): N5–N1 vocabulary, kanji and grammar. It builds on JMdict/EDICT and KANJIDIC2 by the <a href="https://www.edrdg.org/">EDRDG</a> (CC BY-SA 4.0), Jonathan Waller's JLPT lists (<a href="https://www.tanos.co.uk/jlpt/">tanos.co.uk</a>, CC BY), and example sentences from <a href="https://tatoeba.org">Tatoeba</a> (CC BY 2.0 FR). The curriculum database derived from it is shared under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.</li>
          <li>SSW Kaigo and Food units: written for NekoGaku in English (CC BY-SA 4.0). General study material, not legal or medical advice.</li>
        </ul>
        <h2>Art, music and sound</h2>
        <ul>
          <li>Cecil, Kuku and Bolu, the room, the items and the costumes are drawn in code by NekoGaku (MIT).</li>
          <li>Music is composed and synthesized by <code>scripts/make-music.ts</code> without samples. Sound effects are synthesized in the browser.</li>
        </ul>
        <h2>Code</h2>
        <ul><li>NekoGaku source code: MIT License. Built with Kiro.</li></ul>
      </main>
    </div>
  );
}
