import Link from 'next/link';
import Haunt from '../../components/Haunt';
import SignOut from '../../components/SignOut';
import './study.css';

export default function StudyLayout({ children }) {
  return (
    <div className="grimoire">
      <Haunt />
      <div className="fog" aria-hidden="true" />
      <header className="g-head">
        <Link href="/study" className="g-brand">The Grimoire <small>NekoGaku</small></Link>
        <nav aria-label="Main">
          <Link href="/">Haunted house</Link>
          <Link href="/credits">Credits</Link>
          <SignOut />
        </nav>
      </header>
      <main className="g-main">{children}</main>
      <footer className="g-foot">© 2026 NekoGaku</footer>
    </div>
  );
}
