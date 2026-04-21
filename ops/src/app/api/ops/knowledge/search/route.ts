import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { embedText } from '@/lib/embed';
import { createServiceClient } from '@/lib/supabase';

const schema = z.object({
  query: z.string().trim().min(1).max(2000),
  limit: z.number().int().min(1).max(50).optional().default(10),
  min_similarity: z.number().min(0).max(1).optional().default(0.4),
});

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'read:knowledge' });
  if (!auth.ok) return auth.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  try {
    const vector = await embedText(parsed.data.query);
    const { data, error } = await service.schema('ops').rpc('knowledge_search', {
      query_embedding: vector,
      match_limit: parsed.data.limit,
      min_similarity: parsed.data.min_similarity,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const url = new URL(req.url);
    await logAuditSuccess(
      auth.key.id,
      'POST',
      url.pathname + url.search,
      200,
      auth.key.ip,
      req.headers.get('user-agent'),
      auth.bodySha,
      auth.reason,
    );

    return NextResponse.json({ hits: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
