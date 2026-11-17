import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** The SQLite database (libSQL). `DATABASE_URL` may point at a file or a libsql:// server. */
export function databaseUrl() {
  const url = process.env.DATABASE_URL || `file:${resolve(process.cwd(), '.data/nekogaku.sqlite')}`;
  if (url.startsWith('file:')) mkdirSync(dirname(url.slice(5)), { recursive: true });
  return url;
}

let client;
export function db() {
  if (!client) {
    client = createClient({ url: databaseUrl(), authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
  }
  return client;
}
