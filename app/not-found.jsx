import Link from 'next/link';
import './study/study.css';

export default function NotFound() {
  return (
    <div className="grimoire"><main className="g-main">
      <section className="g-hero"><h1>Nothing haunts this page</h1><p>The page you asked for does not exist. Go back to the <Link href="/">haunted house</Link> or the <Link href="/study">grimoire</Link>.</p></section>
    </main></div>
  );
}
