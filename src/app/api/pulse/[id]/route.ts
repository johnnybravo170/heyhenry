/**
 * GET /api/pulse/[id] — fetch a draft Pulse update for the inline editor.
 *
 * Owner-scoped: relies on `pulse_updates` RLS (only owners/admins of the
 * tenant can read).
 */

import { NextResponse } from 'next/server';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await getCurrentTenant();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pulse_updates')
    .select('id, title, body_md, payload')
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(data);
}
