import { db } from './db.js';

const TRACK_ID = /^[a-z0-9-]{2,12}$/;
const UNIT_ID = /^[a-z0-9-]{3,40}$/;
export const isTrackId = v => typeof v === 'string' && TRACK_ID.test(v);
export const isUnitId = v => typeof v === 'string' && UNIT_ID.test(v);

export async function listTracks(playerId) {
  const rows = (await db().execute({
    sql: `SELECT t.id, t.title, t.subtitle, t.kind, COUNT(u.id) AS units, COALESCE(SUM(u.size), 0) AS cards,
            (SELECT COUNT(*) FROM progress p JOIN units u2 ON u2.id = p.unit_id WHERE u2.track_id = t.id AND p.player_id = ? AND p.best * 10 >= p.total * 8) AS mastered
          FROM tracks t LEFT JOIN units u ON u.track_id = t.id GROUP BY t.id ORDER BY t.ord`,
    args: [playerId || ''],
  })).rows;
  return rows.map(r => ({ id: r.id, title: r.title, subtitle: r.subtitle, kind: r.kind, units: Number(r.units), cards: Number(r.cards), mastered: Number(r.mastered) }));
}

export async function getTrack(id, playerId) {
  if (!isTrackId(id)) return null;
  const t = (await db().execute({ sql: 'SELECT id, title, subtitle, kind FROM tracks WHERE id = ?', args: [id] })).rows[0];
  if (!t) return null;
  const units = (await db().execute({
    sql: `SELECT u.id, u.kind, u.title, u.subtitle, u.size, p.best, p.total FROM units u
          LEFT JOIN progress p ON p.unit_id = u.id AND p.player_id = ? WHERE u.track_id = ? ORDER BY u.ord`,
    args: [playerId || '', id],
  })).rows;
  return { id: t.id, title: t.title, subtitle: t.subtitle, kind: t.kind, units: units.map(u => ({ id: u.id, kind: u.kind, title: u.title, subtitle: u.subtitle, size: Number(u.size), best: u.best == null ? null : Number(u.best), total: u.total == null ? null : Number(u.total) })) };
}

export async function getUnit(trackId, unitId) {
  if (!isTrackId(trackId) || !isUnitId(unitId)) return null;
  const u = (await db().execute({ sql: 'SELECT id, track_id, ord, kind, title, subtitle, data_json FROM units WHERE id = ? AND track_id = ?', args: [unitId, trackId] })).rows[0];
  if (!u) return null;
  const data = JSON.parse(u.data_json);
  // Neighbours for the next button and for extra distractors.
  const near = (await db().execute({ sql: 'SELECT id, data_json FROM units WHERE track_id = ? AND kind = ? AND ord IN (?, ?) ORDER BY ord', args: [trackId, u.kind, Number(u.ord) - 1, Number(u.ord) + 1] })).rows;
  const next = (await db().execute({ sql: 'SELECT id FROM units WHERE track_id = ? AND ord > ? ORDER BY ord LIMIT 1', args: [trackId, Number(u.ord)] })).rows[0];
  const pool = near.flatMap(r => JSON.parse(r.data_json).cards).slice(0, 60);
  return { id: u.id, track: u.track_id, kind: u.kind, title: u.title, subtitle: u.subtitle, intro: data.intro, cards: data.cards, questions: data.questions, pool, next: next?.id ?? null };
}

export async function saveProgress(playerId, unitId, correct, total) {
  const now = Date.now();
  await db().execute({
    sql: `INSERT INTO progress (player_id, unit_id, best, total, attempts, updated_at) VALUES (?, ?, ?, ?, 1, ?)
          ON CONFLICT(player_id, unit_id) DO UPDATE SET best = MAX(best, excluded.best), total = excluded.total, attempts = attempts + 1, updated_at = excluded.updated_at`,
    args: [playerId, unitId, correct, total, now],
  });
  const r = (await db().execute({ sql: 'SELECT best, total, attempts FROM progress WHERE player_id = ? AND unit_id = ?', args: [playerId, unitId] })).rows[0];
  return { best: Number(r.best), total: Number(r.total), attempts: Number(r.attempts) };
}
export async function unitExists(unitId) {
  if (typeof unitId === 'string' && unitId.startsWith('exam-')) return isTrackId(unitId.slice(5)) && (await db().execute({ sql: 'SELECT 1 FROM tracks WHERE id = ?', args: [unitId.slice(5)] })).rows.length > 0;
  if (!isUnitId(unitId)) return false;
  return (await db().execute({ sql: 'SELECT 1 FROM units WHERE id = ?', args: [unitId] })).rows.length > 0;
}

/** Material for a mock exam: up to 10 random units of the track (each trimmed to its cards and questions). */
export async function getExamUnits(trackId) {
  if (!isTrackId(trackId)) return null;
  const t = (await db().execute({ sql: 'SELECT id, title, kind FROM tracks WHERE id = ?', args: [trackId] })).rows[0];
  if (!t) return null;
  const rows = (await db().execute({ sql: 'SELECT id, kind, title, data_json FROM units WHERE track_id = ? ORDER BY RANDOM() LIMIT 10', args: [trackId] })).rows;
  return { track: { id: String(t.id), title: String(t.title), kind: String(t.kind) }, units: rows.map(r => { const d = JSON.parse(r.data_json); return { id: String(r.id), kind: String(r.kind), title: String(r.title), cards: d.cards, questions: d.questions }; }) };
}

/** Track ids whose mock exam was passed (best score at 80% or more). */
export async function passedExamTracks(playerId) {
  if (!playerId) return [];
  const rows = (await db().execute({ sql: "SELECT unit_id, best, total FROM progress WHERE player_id = ? AND unit_id LIKE 'exam-%'", args: [playerId] })).rows;
  return rows.filter(r => Number(r.best) * 100 >= Number(r.total) * 80).map(r => String(r.unit_id).slice(5));
}
