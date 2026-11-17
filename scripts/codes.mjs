// Access codes for the house.
//   npm run codes -- new 3 "Judges"        prints 3 new codes (shown once; only hashes are stored)
//   npm run codes -- add NEKO-ABCD-EFGH "Me" registers a code you chose (use it to bring codes to another server)
//   npm run codes -- list                   shows how many players and their labels
import { addCode, newCode } from '../lib/accounts.js';
import { db } from '../lib/db.js';

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'new') {
  const n = Math.max(1, Math.min(50, Number(a) || 1));
  for (let i = 0; i < n; i++) console.log(await addCode(newCode(), b || ''));
} else if (cmd === 'add') {
  console.log(`registered ${await addCode(a, b || '')}`);
} else if (cmd === 'list') {
  const rows = (await db().execute('SELECT label, created_at FROM players ORDER BY created_at')).rows;
  for (const r of rows) console.log(`${new Date(Number(r.created_at)).toISOString()}  ${r.label || '(no label)'}`);
  console.log(`${rows.length} player(s)`);
} else {
  console.log('usage: npm run codes -- new <count> [label] | add <NEKO-XXXX-XXXX> [label] | list');
}
