import { NextResponse } from 'next/server';

/** Without a session cookie, the house and the grimoire send you to the door (/login). The pages check the session itself. */
export function middleware(req) {
  if (req.cookies.get('neko_session')?.value) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.searchParams.set('next', req.nextUrl.pathname);
  url.pathname = '/login';
  return NextResponse.redirect(url);
}
export const config = { matcher: ['/', '/study/:path*'] };
