import { type NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase';

/** GET /api/ops/ideas/:id — fetch one idea plus its comments + followups. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req, { requiredScope: 'read:ideas' });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const service = createServiceClient();

  const [ideaRes, commentsRes, followupsRes] = await Promise.all([
    service
      .schema('ops')
      .from('ideas')
      .select(
        'id, actor_type, actor_name, title, body, status, rating, assignee, tags, created_at, updated_at, archived_at',
      )
      .eq('id', id)
      .maybeSingle(),
    service
      .schema('ops')
      .from('idea_comments')
      .select('id, actor_type, actor_name, body, created_at')
      .eq('idea_id', id)
      .order('created_at'),
    service
      .schema('ops')
      .from('idea_followups')
      .select('id, kind, payload, resolved_at, resolved_by_system, created_at')
      .eq('idea_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (!ideaRes.data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

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
    idea: ideaRes.data,
    comments: commentsRes.data ?? [],
    followups: followupsRes.data ?? [],
  });
}
