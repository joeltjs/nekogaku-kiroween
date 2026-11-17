// Starts every player from zero: house, items, grimoire progress, rewards and sessions are cleared.
// Access codes stay, so the same codes can be used again. Run it once before the judges start.
//   npm run reset:progress            (asks for confirmation)
//   npm run reset:progress -- --yes   (no question)
import { createInterface } from 'node:readline/promises';
import { db } from '../lib/db.js';

const TABLES = ['house_saves', 'rewards', 'progress', 'sessions'];
const c = db();
const { n } = (await c.execute('SELECT COUNT(*) AS n FROM players')).rows[0];
if (!process.argv.includes('--yes')) {
  const ask = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await ask.question(`Clear progress for ${n} player(s)? Codes stay. Type "yes": `);
  ask.close();
  if (answer.trim() !== 'yes') { console.log('nothing changed'); process.exit(0); }
}
for (const t of TABLES) await c.execute(`DELETE FROM ${t}`);
console.log(`cleared ${TABLES.join(', ')} for ${n} player(s); ${n} code(s) kept`);
