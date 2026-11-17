import { NextResponse } from 'next/server';

/** Without a session cookie, the house and the grimoire send you to the door (/login). The pages check the session itself. */
export function middleware(req) {
  if (req.cookies.get('neko_session')?.value) return NextResponse.next();
  
  // Respect reverse proxy / tunnel headers (x-forwarded-host, x-forwarded-proto)
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  
  const url = req.nextUrl.clone();
  if (forwardedHost) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(req.nextUrl.pathname)}`, `${forwardedProto}://${forwardedHost}`));
  }
  
  url.searchParams.set('next', req.nextUrl.pathname);
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/', '/study/:path*'] };
