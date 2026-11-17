import { cookies } from 'next/headers';
import { playerForToken } from './accounts.js';

export const SESSION_COOKIE = 'neko_session';
export const sessionCookieOptions = () => ({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 180, secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false' });

/** The signed-in player ({ id, label }) or null. */
export async function currentPlayer() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? playerForToken(token) : null;
}
export async function readPlayer() { return (await currentPlayer())?.id ?? null; }
