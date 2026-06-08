/**
 * Branded auth emails — the HeyHenry replacement for Supabase's default
 * "powered by Supabase ⚡" auth templates.
 *
 * Rendered from the Supabase Send Email Hook payload
 * (`src/app/api/auth/email-hook/route.ts`), so every auth flow — magic link,
 * recovery, signup confirmation, invite, email change, reauthentication —
 * goes out through `renderEmailShell` + Postmark instead of Supabase's
 * hosted SMTP.
 *
 * The hook hands us `token_hash`, `email_action_type`, and `redirect_to`;
 * we build the verification URL ourselves (the same shape Supabase's
 * `{{ .ConfirmationURL }}` produces) pointing at the project's
 * `/auth/v1/verify` endpoint, which validates the token then bounces the
 * user to `redirect_to` (our `/callback`). Reauthentication has no link —
 * the user types the 6-digit `token` back into the app — so that branch
 * renders the code instead of a button.
 */

import { escapeHtml } from '@/lib/email/escape';
import { renderEmailShell } from '@/lib/email/layout';

/** Action types Supabase's send-email hook can emit. */
export type AuthEmailActionType =
  | 'signup'
  | 'magiclink'
  | 'recovery'
  | 'invite'
  | 'email_change'
  | 'email_change_new'
  | 'email_change_current'
  | 'reauthentication';

export type AuthEmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
};

export type RenderedAuthEmail = { subject: string; html: string };

/**
 * Build the Supabase verify URL. Supabase validates `token_hash` server-side,
 * then 302s the browser to `redirect_to` with a session code/fragment that
 * `/callback` already knows how to consume.
 */
function buildVerifyUrl(supabaseUrl: string, data: AuthEmailData): string {
  const redirectTo = data.redirect_to || `${data.site_url}/callback`;
  const u = new URL(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/verify`);
  u.searchParams.set('token', data.token_hash);
  u.searchParams.set('type', data.email_action_type);
  u.searchParams.set('redirect_to', redirectTo);
  return u.toString();
}

const EXPIRY_NOTE = 'This link works once and expires in 1 hour.';

type Copy = { subject: string; heading: string; body: string; cta: string };

function copyFor(actionType: string): Copy {
  switch (actionType) {
    case 'recovery':
      return {
        subject: 'Reset your HeyHenry password',
        heading: 'Reset your password',
        body: `<p style="margin:0 0 16px;">Tap the button below to set a new password for your HeyHenry account.</p>`,
        cta: 'Reset password',
      };
    case 'signup':
      return {
        subject: 'Confirm your email for HeyHenry',
        heading: 'Confirm your email',
        body: `<p style="margin:0 0 16px;">One tap to confirm your email and finish setting up HeyHenry.</p>`,
        cta: 'Confirm email',
      };
    case 'invite':
      return {
        subject: "You've been invited to HeyHenry",
        heading: 'Join your team on HeyHenry',
        body: `<p style="margin:0 0 16px;">You've been invited to HeyHenry. Tap below to accept and set up your account.</p>`,
        cta: 'Accept invite',
      };
    case 'email_change':
    case 'email_change_new':
    case 'email_change_current':
      return {
        subject: 'Confirm your new email for HeyHenry',
        heading: 'Confirm your email change',
        body: `<p style="margin:0 0 16px;">Tap below to confirm the email address on your HeyHenry account.</p>`,
        cta: 'Confirm email change',
      };
    case 'magiclink':
    default:
      return {
        subject: 'Your HeyHenry sign-in link',
        heading: 'Sign in to HeyHenry',
        body: `<p style="margin:0 0 16px;">Tap the button below to sign in. No password needed.</p>`,
        cta: 'Sign in to HeyHenry',
      };
  }
}

export function renderAuthEmail(
  data: AuthEmailData,
  opts: { supabaseUrl: string },
): RenderedAuthEmail {
  // Reauthentication is code-entry, not a link — there's no redirect flow.
  if (data.email_action_type === 'reauthentication') {
    const html = renderEmailShell({
      heading: 'Your verification code',
      body: `<p style="margin:0 0 16px;">Enter this code to confirm it's you:</p>
<p style="margin:0;font-size:28px;font-weight:700;letter-spacing:4px;color:#0a0a0a;">${escapeHtml(data.token)}</p>`,
      signoff: EXPIRY_NOTE,
      footerKey: 'auth',
    });
    return { subject: 'Your HeyHenry verification code', html };
  }

  const copy = copyFor(data.email_action_type);
  const verifyUrl = buildVerifyUrl(opts.supabaseUrl, data);
  const html = renderEmailShell({
    heading: copy.heading,
    body: copy.body,
    cta: { label: copy.cta, href: verifyUrl, variant: 'primary' },
    signoff: `${EXPIRY_NOTE} If you didn't request this, you can safely ignore this email.`,
    footerKey: 'auth',
  });
  return { subject: copy.subject, html };
}
