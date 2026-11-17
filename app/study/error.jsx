'use client';

export default function StudyError({ reset }) {
  return (
    <section className="g-hero">
      <h1>A draft blew the candles out</h1>
      <p>The grimoire could not load this page. Check that the server is running and the database is set up (<code>npm run setup</code>), then try again.</p>
      <p><button type="button" className="g-music" onClick={() => reset()}>Try again</button></p>
    </section>
  );
}
