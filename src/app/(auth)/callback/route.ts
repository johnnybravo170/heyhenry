/**
 * OAuth + magic-link callback.
 *
 * Supabase's email flows redirect here with `?code=...&next=...`. We
 * exchange the code for a session (which writes the auth cookies) and
 * then send the user to `next` (default `/dashboard`).
 *
 * Errors surface as a redirect to `/login?error=...` rather than a 500;
 * the page can render them.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next') ?? '/dashboard';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  // If the user has a verified TOTP factor, magic-link sign-in only gets
  // them to aal1. Route them through the challenge before landing on
  // `next`. We encode `next` as a query so the MFA page can honour it
  // (though currently /login/mfa always routes to /dashboard).
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === 'aal2' && aal.currentLevel === 'aal1') {
    return NextResponse.redirect(new URL('/login/mfa', request.url));
  }

  const target = next.startsWith('/') ? next : `/${next}`;
  return NextResponse.redirect(new URL(target, request.url));
}
