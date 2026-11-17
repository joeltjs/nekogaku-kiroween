// Applies db/migrations/*.sql in order, once each (tracked in schema_migrations).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db, databaseUrl } from '../lib/db.js';

const dir = join(process.cwd(), 'db/migrations');
const client = db();
await client.execute('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
const done = new Set((await client.execute('SELECT name FROM schema_migrations')).rows.map(r => r.name));
let applied = 0;
for (const name of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
  if (done.has(name)) continue;
  await client.executeMultiple(readFileSync(join(dir, name), 'utf8'));
  await client.execute({ sql: 'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)', args: [name, Date.now()] });
  console.log(`applied ${name}`);
  applied++;
}
console.log(`${applied ? applied : 'no'} new migration(s) on ${databaseUrl()}`);
