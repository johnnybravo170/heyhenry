/**
 * Supabase Auth — Send Email Hook.
 *
 * Supabase POSTs here for every auth email (magic link, recovery, signup
 * confirmation, invite, email change, reauthentication) instead of sending
 * its own default "powered by Supabase ⚡" template. We render the HeyHenry
 * branded equivalent (`renderAuthEmail`) and ship it through Postmark's
 * transactional stream via `sendEmail`, so auth mail lands on our warmed
 * sender reputation and gets logged to `email_send_log` like everything else.
 *
 * Security: the payload is signed with Standard Webhooks. We verify against
 * `AUTH_EMAIL_HOOK_SECRET` before doing anything. An unsigned/forged request
 * could trigger arbitrary auth emails, so a missing secret hard-fails (500)
 * rather than sending unverified.
 *
 * Configuration:
 *   - Local: `[auth.hook.send_email]` in `supabase/config.toml`.
 *   - Prod:  enable the Send Email Hook in the Supabase dashboard (Auth →
 *     Hooks) pointing at `https://app.heyhenry.io/api/auth/email-hook`, and
 *     set `AUTH_EMAIL_HOOK_SECRET` (the `v1,whsec_...` value Supabase shows)
 *     in the Vercel env.
 */

import { sendEmail } from '@/lib/email/send';
import { type AuthEmailData, renderAuthEmail } from '@/lib/email/templates/auth';
import { verifyStandardWebhook } from '@/lib/webhooks/standard-webhook';

export const runtime = 'nodejs';

type SendEmailHookPayload = {
  user: { id?: string; email?: string };
  email_data: AuthEmailData;
};

export async function POST(request: Request) {
  const secret = process.env.AUTH_EMAIL_HOOK_SECRET;
  if (!secret) {
    // Never send an auth email we couldn't authenticate. Fail loud so the
    // misconfiguration surfaces instead of silently leaking unsigned sends.
    console.error('AUTH_EMAIL_HOOK_SECRET is not set — refusing to process auth email hook');
    return new Response('hook not configured', { status: 500 });
  }

  const body = await request.text();
  const verified = verifyStandardWebhook({
    secret,
    body,
    headers: {
      id: request.headers.get('webhook-id'),
      timestamp: request.headers.get('webhook-timestamp'),
      signature: request.headers.get('webhook-signature'),
    },
  });
  if (!verified) {
    return new Response('invalid signature', { status: 401 });
  }

  let payload: SendEmailHookPayload;
  try {
    payload = JSON.parse(body) as SendEmailHookPayload;
  } catch {
    return new Response('invalid payload', { status: 400 });
  }

  const to = payload.user?.email;
  const data = payload.email_data;
  if (!to || !data?.email_action_type || !data?.token_hash) {
    return new Response('missing fields', { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('NEXT_PUBLIC_SUPABASE_URL is not set — cannot build auth verify URL');
    return new Response('server misconfigured', { status: 500 });
  }

  const { subject, html } = renderAuthEmail(data, { supabaseUrl });

  const result = await sendEmail({
    to,
    subject,
    html,
    caslCategory: 'transactional',
    relatedType: 'auth',
    caslEvidence: { kind: 'auth_email', action: data.email_action_type, userId: payload.user?.id },
  });

  if (!result.ok) {
    // Surface a 500 so Supabase shows the hook failure (and the user can
    // retry) rather than silently swallowing a dropped sign-in email.
    console.error('Auth email send failed:', result.error);
    return new Response('send failed', { status: 500 });
  }

  return new Response(null, { status: 204 });
}
