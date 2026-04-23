import { type NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase';

const LIST_CAP = 50;
const STALE_DAYS = 7;

/**
 * GET /api/ops/review-queue — read-only aggregator that returns the four
 * stacks Jonathan reviews each day:
 *   - social_drafts pending approval
 *   - open / triaging incidents
 *   - competitor cards not checked in 7+ days
 *   - docs created in the last 7 days
 *
 * Each list is capped at 50. Single round trip for the dashboard / agent
 * to use as a "what needs me?" prompt.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'read:review_queue' });
  if (!auth.ok) return auth.response;

  const service = createServiceClient();
  const sevenDaysAgo = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [socialRes, incidentsRes, competitorsRes, docsRes] = await Promise.all([
    service
      .schema('ops')
      .from('social_drafts')
      .select('id, topic, channel, draft_body, status, actor_name, created_at, updated_at')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(LIST_CAP),
    service
      .schema('ops')
      .from('incidents')
      .select(
        'id, source, severity, status, title, assigned_agent, sms_escalated_at, actor_name, created_at, updated_at',
      )
      .in('status', ['open', 'triaging'])
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(LIST_CAP),
    service
      .schema('ops')
      .from('competitors')
      .select('id, name, url, last_checked_at, edge_notes, updated_at')
      .or(`last_checked_at.is.null,last_checked_at.lt.${sevenDaysAgo}`)
      .order('last_checked_at', { ascending: true, nullsFirst: true })
      .limit(LIST_CAP),
    service
      .schema('ops')
      .from('docs')
      .select('id, commit_range, module, summary_md, file_paths, actor_name, created_at')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(LIST_CAP),
  ]);

  const url = new URL(req.url);
  await logAuditSuccess(
    auth.key.id,
    'GET',
    url.pathname + url.search,
    200,
    auth.key.ip,
    req.headers.get('user-agent'),
    auth.bodySha,
    auth.reason,
  );

  return NextResponse.json({
    social_drafts: socialRes.data ?? [],
    incidents_open: incidentsRes.data ?? [],
    competitors_stale: competitorsRes.data ?? [],
    docs_recent: docsRes.data ?? [],
  });
}
