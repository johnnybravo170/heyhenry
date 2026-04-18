/**
 * POST /api/henry/tool
 *
 * Executes a tool call on behalf of the client's Gemini Live session.
 *
 * Why server-side: Gemini Live runs in the browser, but tool handlers need to
 * run under the authenticated user's Supabase session so RLS applies. The
 * client forwards function calls here; we dispatch through the same
 * `executeToolCall` the Claude chat route uses.
 */

import { executeToolCall, setToolTimezone } from '@/lib/ai/tools';
import { getCurrentTenant } from '@/lib/auth/helpers';

export async function POST(request: Request) {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { name?: unknown; args?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.name !== 'string' || !body.name) {
    return Response.json({ error: 'Missing or invalid name' }, { status: 400 });
  }

  const args =
    body.args && typeof body.args === 'object' && !Array.isArray(body.args)
      ? (body.args as Record<string, unknown>)
      : {};

  setToolTimezone(tenant.timezone);
  const result = await executeToolCall(body.name, args);

  return Response.json({ result });
}
