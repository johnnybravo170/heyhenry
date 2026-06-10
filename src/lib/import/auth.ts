import { timingSafeEqual } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export function isValidImportToken(authHeader: string | null): boolean {
  const expected = process.env.HEYHENRY_IMPORT_TOKEN;
  if (!expected) return false;
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader ?? '');
  const provided = match?.[1];
  if (!provided) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export type AuthedContext = {
  admin: ReturnType<typeof createAdminClient>;
  tenantId: string;
};

/**
 * Validates the bearer token, parses the JSON body, and checks that
 * `body.tenant_id` is present. Returns a typed context or a NextResponse
 * error the caller can return directly.
 */
export async function guardImportRequest(
  req: NextRequest,
): Promise<
  { ok: true; ctx: AuthedContext; body: Record<string, unknown> } | { ok: false; res: NextResponse }
> {
  if (!isValidImportToken(req.headers.get('authorization'))) {
    return { ok: false, res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, res: NextResponse.json({ error: 'invalid_json' }, { status: 400 }) };
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('tenant_id' in body) ||
    typeof (body as Record<string, unknown>).tenant_id !== 'string'
  ) {
    return {
      ok: false,
      res: NextResponse.json(
        {
          error: 'validation',
          issues: [{ message: 'tenant_id (uuid) is required', path: ['tenant_id'] }],
        },
        { status: 422 },
      ),
    };
  }

  return {
    ok: true,
    ctx: {
      admin: createAdminClient(),
      tenantId: (body as Record<string, unknown>).tenant_id as string,
    },
    body: body as Record<string, unknown>,
  };
}

/**
 * Verifies that the project exists and belongs to the given tenant.
 * Returns the project row or a NextResponse error.
 */
export async function resolveProject(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  projectId: string,
): Promise<{ ok: true; projectId: string } | { ok: false; res: NextResponse }> {
  const { data } = await admin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data) {
    return { ok: false, res: NextResponse.json({ error: 'project_not_found' }, { status: 404 }) };
  }
  return { ok: true, projectId: data.id };
}
