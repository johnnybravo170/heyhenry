/**
 * POST /api/import/project/:id/labour
 * Batch-append historical time entries to an already-imported project.
 *
 * Auth: Bearer HEYHENRY_IMPORT_TOKEN, service-role admin client.
 * Worker resolution: matches existing worker_profiles by display_name or
 * tenant_member first+last name. Unmatched workers are flagged in the response
 * and the raw name is stored in notes — worker_profile_id stays null until the
 * ghost-worker feature lands and they can be retroactively linked.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardImportRequest, resolveProject } from '@/lib/import/auth';
import { dryRunEnvelope, FORBIDDEN_LINE_LABEL, zodErrorResponse } from '@/lib/import/helpers';
import { resolveWorker } from '@/lib/import/members';

const EntrySchema = z.object({
  source_row_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  team_member: z.string().optional(),
  scope: z.string().optional(),
  hours: z.number().positive(),
  hourly_cost_cents: z.number().int().min(0),
  bill_out_rate_cents: z.number().int().min(0).optional(),
  budget_category_id: z.string().uuid().optional(),
});

const BodySchema = z.object({
  tenant_id: z.string().uuid(),
  entries: z.array(EntrySchema).min(1),
  options: z.object({ dry_run: z.boolean().default(false) }).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardImportRequest(req);
  if (!guard.ok) return guard.res;
  const { admin, tenantId } = guard.ctx;

  const { id: projectId } = await params;
  const projectCheck = await resolveProject(admin, tenantId, projectId);
  if (!projectCheck.ok) return projectCheck.res;

  const parsed = BodySchema.safeParse(guard.body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { entries, options } = parsed.data;
  const dryRun = options?.dry_run ?? false;

  // Validate all entries up-front; reject any with FORBIDDEN_LINE_LABEL in scope.
  for (const e of entries) {
    if (e.scope && FORBIDDEN_LINE_LABEL.test(e.scope)) {
      return NextResponse.json(
        {
          error: 'validation',
          issues: [
            {
              message: `scope "${e.scope}" looks like a fee/tax — use budget_category_id instead`,
              path: 'scope',
            },
          ],
        },
        { status: 422 },
      );
    }
  }

  if (dryRun) {
    return NextResponse.json(dryRunEnvelope('labour', entries, entries.length));
  }

  const unmatched: string[] = [];

  const rows = await Promise.all(
    entries.map(async (e) => {
      let workerProfileId: string | null = null;
      let noteSuffix = '';

      if (e.team_member) {
        const resolution = await resolveWorker(admin, tenantId, e.team_member);
        if (resolution.kind === 'matched') {
          workerProfileId = resolution.workerProfileId;
        } else {
          unmatched.push(e.team_member);
          noteSuffix = ` [imported worker: ${e.team_member}]`;
        }
      }

      return {
        tenant_id: tenantId,
        project_id: projectId,
        worker_profile_id: workerProfileId,
        hours: e.hours,
        hourly_rate_cents: e.hourly_cost_cents,
        charge_rate_cents: e.bill_out_rate_cents ?? null,
        notes: e.scope ? `${e.scope}${noteSuffix}` : noteSuffix || null,
        entry_date: e.date,
        budget_category_id: e.budget_category_id ?? null,
        import_source_row_id: e.source_row_id,
        // user_id is nullable (foundation migration) — no session on this path
        user_id: null as string | null,
      };
    }),
  );

  // Upsert: on conflict (same tenant + source_row_id), update in place.
  const { data, error } = await admin
    .from('time_entries')
    .upsert(rows, { onConflict: 'tenant_id,import_source_row_id', ignoreDuplicates: false })
    .select('id');

  if (error) {
    return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
  }

  await admin.from('worklog_entries').insert({
    tenant_id: tenantId,
    entry_type: 'system',
    title: 'Labour imported',
    body: `${data?.length ?? 0} time ${data?.length === 1 ? 'entry' : 'entries'} imported for project.`,
    related_type: 'project',
    related_id: projectId,
  });

  return NextResponse.json({
    ok: true,
    count: data?.length ?? 0,
    unmatched_workers: [...new Set(unmatched)],
  });
}
