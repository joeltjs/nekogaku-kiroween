import { NextResponse } from 'next/server';
import { readHouse, takeRewards, writeHouse } from '../../../lib/accounts';
import { currentPlayer } from '../../../lib/player';
import { passedExamTracks } from '../../../lib/curriculum';

export const dynamic = 'force-dynamic';
const MAX_SAVE = 200_000;

/** The player's house save and the EXP waiting from the grimoire (handed over once). */
export async function GET(req) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const onlyRewards = new URL(req.url).searchParams.get('only') === 'rewards';
  const [house, rewards, exams] = await Promise.all([onlyRewards ? null : readHouse(player.id), takeRewards(player.id), passedExamTracks(player.id)]);
  return NextResponse.json({ player: { id: player.id, label: player.label }, save: house?.json ?? null, savedAt: house?.savedAt ?? 0, rewards, exams });
}

export async function PUT(req) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const text = await req.text();
  if (text.length > MAX_SAVE) return NextResponse.json({ error: 'Save too large' }, { status: 413 });
  let body; try { body = JSON.parse(text); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { save, savedAt } = body ?? {};
  if (typeof save !== 'string' || !Number.isFinite(savedAt)) return NextResponse.json({ error: 'Invalid save' }, { status: 400 });
  try { const d = JSON.parse(save); if (d?.v !== 1) throw new Error(); } catch { return NextResponse.json({ error: 'Invalid save' }, { status: 400 }); }
  await writeHouse(player.id, save, Math.min(Date.now() + 60_000, Math.round(savedAt)));
  return NextResponse.json({ ok: true });
}
