/**
 * POST /api/ops/feedback — in-app "report a problem / share an idea" intake.
 *
 * Called by the HeyHenry app's floating feedback button. Creates a kanban
 * card on the dev board, tagged so the scheduled triage agent picks it up
 * and annotates it with code-side context.
 *
 * Required scope: write:feedback (narrow — does NOT grant arbitrary card
 * creation). Reuses the standard HMAC auth flow.
 *
 * Body:
 *   message: required, the user's text
 *   submitter: required, identifier shown on the card (email or "Jonathan")
 *   url: optional, the page they were on
 *   user_agent: optional, browser UA
 *   tenant_id: optional, HeyHenry tenant they belong to
 *   screenshot_url: optional, signed Supabase storage URL (added later)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createCard } from '@/server/ops-services/kanban';

const bodySchema = z.object({
  message: z.string().trim().min(1).max(8000),
  submitter: z.string().trim().min(1).max(200),
  url: z.string().trim().max(500).optional(),
  user_agent: z.string().trim().max(500).optional(),
  tenant_id: z.string().trim().max(100).optional(),
  screenshot_url: z.string().url().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'write:feedback' });
  if (!auth.ok) return auth.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { message, submitter, url, user_agent, tenant_id, screenshot_url } = parsed.data;

  const title = truncateTitle(message);
  const body = renderBody({ message, submitter, url, user_agent, tenant_id, screenshot_url });

  const card = await createCard(
    {
      actorType: 'agent',
      actorName: `feedback-intake (key:${auth.key.id.slice(0, 8)})`,
      keyId: auth.key.id,
      adminUserId: null,
    },
    {
      boardSlug: 'dev',
      title,
      body,
      tags: ['triage:claude', 'inbox-from-app'],
    },
  );

  const reqUrl = new URL(req.url);
  await logAuditSuccess(
    auth.key.id,
    'POST',
    reqUrl.pathname + reqUrl.search,
    200,
    auth.key.ip,
    req.headers.get('user-agent'),
    auth.bodySha,
    auth.reason,
  );

  return NextResponse.json({ ok: true, card_id: card.id });
}

function truncateTitle(message: string): string {
  const oneLine = message.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= 80) return oneLine;
  return `${oneLine.slice(0, 77)}…`;
}

function renderBody(input: {
  message: string;
  submitter: string;
  url?: string;
  user_agent?: string;
  tenant_id?: string;
  screenshot_url?: string;
}): string {
  const lines = [
    `**From in-app feedback button**`,
    '',
    `> ${input.message.replace(/\n/g, '\n> ')}`,
    '',
    `**Submitter:** ${input.submitter}`,
  ];
  if (input.url) lines.push(`**URL:** ${input.url}`);
  if (input.tenant_id) lines.push(`**Tenant:** ${input.tenant_id}`);
  if (input.user_agent) lines.push(`**User agent:** ${input.user_agent}`);
  if (input.screenshot_url) lines.push(`**Screenshot:** ${input.screenshot_url}`);
  lines.push('', `_Logged ${new Date().toISOString()}_`);
  return lines.join('\n');
}
