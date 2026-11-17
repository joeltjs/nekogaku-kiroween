import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { db } from './db.js';

/** Code alphabet without look-alikes (no 0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const sha256 = text => createHash('sha256').update(text).digest('hex');

export function newCode() {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `NEKO-${part()}-${part()}`;
}
/** Uppercases and strips spaces; returns null unless it looks like NEKO-XXXX-XXXX. */
export function normalizeCode(input) {
  if (typeof input !== 'string') return null;
  const c = input.toUpperCase().replace(/[\s_]/g, '').replace(/^NEKO(?=[A-Z0-9]{8}$)/, 'NEKO-').replace(/^(NEKO-[A-Z0-9]{4})(?=[A-Z0-9]{4}$)/, '$1-');
  return /^NEKO-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c) ? c : null;
}

export async function addCode(code, label = '') {
  const c = normalizeCode(code); if (!c) throw new Error(`Not a valid code: ${code}`);
  const id = randomUUID();
  await db().execute({ sql: 'INSERT INTO players (id, code_hash, label, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(code_hash) DO NOTHING', args: [id, sha256(c), String(label).slice(0, 60), Date.now()] });
  return c;
}

/** Checks a code and opens a session; returns the raw session token (for the cookie) or null. */
export async function signIn(code) {
  const c = normalizeCode(code); if (!c) return null;
  const p = (await db().execute({ sql: 'SELECT id FROM players WHERE code_hash = ?', args: [sha256(c)] })).rows[0];
  if (!p) return null;
  const token = randomBytes(32).toString('base64url'), now = Date.now();
  await db().execute({ sql: 'INSERT INTO sessions (token_hash, player_id, created_at, last_seen) VALUES (?, ?, ?, ?)', args: [sha256(token), p.id, now, now] });
  return token;
}
export async function playerForToken(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const r = (await db().execute({ sql: 'SELECT s.player_id, p.label FROM sessions s JOIN players p ON p.id = s.player_id WHERE s.token_hash = ?', args: [sha256(token)] })).rows[0];
  return r ? { id: String(r.player_id), label: String(r.label || '') } : null;
}
export async function signOut(token) {
  if (typeof token === 'string') await db().execute({ sql: 'DELETE FROM sessions WHERE token_hash = ?', args: [sha256(token)] });
}

export async function readHouse(playerId) {
  const r = (await db().execute({ sql: 'SELECT json, saved_at FROM house_saves WHERE player_id = ?', args: [playerId] })).rows[0];
  return r ? { json: String(r.json), savedAt: Number(r.saved_at) } : null;
}
export async function writeHouse(playerId, json, savedAt) {
  await db().execute({
    sql: `INSERT INTO house_saves (player_id, json, saved_at) VALUES (?, ?, ?)
          ON CONFLICT(player_id) DO UPDATE SET json = excluded.json, saved_at = excluded.saved_at WHERE excluded.saved_at >= house_saves.saved_at`,
    args: [playerId, json, savedAt],
  });
}
export async function addReward(playerId, cat, exp, source) {
  await db().execute({ sql: 'INSERT INTO rewards (player_id, cat, exp, source, created_at) VALUES (?, ?, ?, ?, ?)', args: [playerId, cat, exp, String(source).slice(0, 80), Date.now()] });
}
/** Hands over (and deletes) the rewards waiting for this player. */
export async function takeRewards(playerId) {
  const rows = (await db().execute({ sql: 'SELECT id, cat, exp, source FROM rewards WHERE player_id = ? ORDER BY id LIMIT 50', args: [playerId] })).rows;
  if (rows.length) await db().execute({ sql: `DELETE FROM rewards WHERE player_id = ? AND id <= ?`, args: [playerId, rows[rows.length - 1].id] });
  return rows.map(r => ({ cat: String(r.cat), exp: Number(r.exp), source: String(r.source) }));
}
