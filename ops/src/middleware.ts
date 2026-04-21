import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Exposes the incoming pathname to server components so requireAdmin() can
 * build a `?next=<path>` redirect. Next.js doesn't surface the current URL
 * to server components by default.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const path = req.nextUrl.pathname + req.nextUrl.search;
  res.headers.set('x-ops-path', path);
  // Forward to downstream handlers too
  req.headers.set('x-ops-path', path);
  return NextResponse.next({
    request: { headers: req.headers },
    headers: res.headers,
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
