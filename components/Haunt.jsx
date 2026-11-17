/** Decoration for the grimoire: a blood moon, bats, cobwebs, a drifting ghost and candles. Pure SVG + CSS, hidden from screen readers. */
const Bat = ({ className }) => (
  <svg className={`bat ${className}`} viewBox="0 0 60 26"><path d="M30 8c-3-5-9-7-15-5 3 2 3 5 1 7-4-3-10-3-16 1 6 0 9 3 10 7 2-3 6-4 9-2 2-3 6-4 11 0 5-4 9-3 11 0 3-2 7-1 9 2 1-4 4-7 10-7-6-4-12-4-16-1-2-2-2-5 1-7-6-2-12 0-15 5z" /></svg>
);

export default function Haunt() {
  return (
    <div className="haunt" aria-hidden="true">
      <div className="moon" />
      <Bat className="b1" /><Bat className="b2" /><Bat className="b3" />
      <svg className="web web-l" viewBox="0 0 200 200"><g fill="none" stroke="currentColor" strokeWidth="1.2">{[0, 15, 30, 45, 60, 75, 90].map(a => <line key={a} x1="0" y1="0" x2={200 * Math.cos(a * Math.PI / 180)} y2={200 * Math.sin(a * Math.PI / 180)} />)}{[40, 80, 120, 160].map(r => <path key={r} d={[0, 15, 30, 45, 60, 75, 90].map((a, i) => `${i ? 'Q' : 'M'}${i ? `${r * .92 * Math.cos((a - 7.5) * Math.PI / 180)} ${r * .92 * Math.sin((a - 7.5) * Math.PI / 180)} ` : ''}${r * Math.cos(a * Math.PI / 180)} ${r * Math.sin(a * Math.PI / 180)}`).join(' ')} />)}</g><line x1="70" y1="0" x2="70" y2="120" stroke="currentColor" /><circle cx="70" cy="128" r="7" fill="#120b16" /></svg>
      <svg className="web web-r" viewBox="0 0 200 200"><g fill="none" stroke="currentColor" strokeWidth="1.2">{[0, 15, 30, 45, 60, 75, 90].map(a => <line key={a} x1="0" y1="0" x2={200 * Math.cos(a * Math.PI / 180)} y2={200 * Math.sin(a * Math.PI / 180)} />)}{[40, 80, 120, 160].map(r => <path key={r} d={[0, 15, 30, 45, 60, 75, 90].map((a, i) => `${i ? 'Q' : 'M'}${i ? `${r * .92 * Math.cos((a - 7.5) * Math.PI / 180)} ${r * .92 * Math.sin((a - 7.5) * Math.PI / 180)} ` : ''}${r * Math.cos(a * Math.PI / 180)} ${r * Math.sin(a * Math.PI / 180)}`).join(' ')} />)}</g></svg>
      <svg className="ghost" viewBox="0 0 80 100"><path d="M8 96V40C8 18 22 6 40 6s32 12 32 34v56l-8-8-8 8-8-8-8 8-8-8-8 8-8-8z" /><ellipse cx="29" cy="42" rx="5" ry="8" fill="#120b16" /><ellipse cx="51" cy="42" rx="5" ry="8" fill="#120b16" /><ellipse cx="40" cy="62" rx="6" ry="8" fill="#120b16" /></svg>
      <div className="candles">{[0, 1, 2].map(k => <span key={k} className={`candle c${k}`}><i /></span>)}</div>
    </div>
  );
}
