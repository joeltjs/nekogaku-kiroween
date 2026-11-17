import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { signIn, signOut } from '../../../lib/accounts';
import { SESSION_COOKIE, sessionCookieOptions } from '../../../lib/player';

export const dynamic = 'force-dynamic';

// A small brake on guessing codes: 10 tries a minute per address.
const tries = new Map();
function limited(ip) {
  const now = Date.now(), t = (tries.get(ip) || []).filter(x => now - x < 60_000);
  t.push(now); tries.set(ip, t);
  if (tries.size > 5000) tries.clear();
  return t.length > 10;
}

/** Sign in with an access code. */
export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
  if (limited(ip)) return NextResponse.json({ error: 'Too many tries. Wait a minute.' }, { status: 429 });
  let body; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const token = await signIn(body?.code);
  if (!token) return NextResponse.json({ error: 'That code does not open this house.' }, { status: 401 });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
  return NextResponse.json({ ok: true });
}

/** Sign out. */
export async function DELETE() {
  const jar = await cookies();
  await signOut(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
