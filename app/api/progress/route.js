import { NextResponse } from 'next/server';
import { saveProgress, unitExists } from '../../../lib/curriculum';
import { addReward } from '../../../lib/accounts';
import { currentPlayer } from '../../../lib/player';
import { rewardForQuiz } from '../../../game/sim/progress';

export const dynamic = 'force-dynamic';
/** Every cat in the house gets the same EXP from a finished quiz. */
const CATS = ['cecil', 'kuku', 'bolu'];

/** Saves a finished quiz and queues the EXP it is worth for each cat (R10.6). */
export async function POST(req) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { unitId, correct, total, label } = body ?? {};
  if (!Number.isInteger(correct) || !Number.isInteger(total) || total < 1 || total > 50 || correct < 0 || correct > total) {
    return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
  }
  if (!(await unitExists(unitId))) return NextResponse.json({ error: 'Unknown unit' }, { status: 404 });
  const exp = rewardForQuiz(correct, total);
  const progress = await saveProgress(player.id, unitId, correct, total);
  const source = `${typeof label === 'string' ? label.slice(0, 50) : unitId} (${correct}/${total})`;
  if (exp > 0) for (const cat of CATS) await addReward(player.id, cat, exp, source);
  return NextResponse.json({ ...progress, exp, cats: CATS });
}
