import { createAdminClient } from '@/lib/supabase/admin';

export type ProjectAssignmentRow = {
  id: string;
  tenant_id: string;
  project_id: string;
  worker_profile_id: string;
  scheduled_date: string | null;
  hourly_rate_cents: number | null;
  charge_rate_cents: number | null;
  notes: string | null;
  created_at: string;
};

const COLUMNS =
  'id, tenant_id, project_id, worker_profile_id, scheduled_date, hourly_rate_cents, charge_rate_cents, notes, created_at';

export async function listAssignmentsForProject(
  tenantId: string,
  projectId: string,
): Promise<ProjectAssignmentRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('project_assignments')
    .select(COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('scheduled_date', { ascending: true, nullsFirst: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectAssignmentRow[];
}

export type WorkerAssignedProject = {
  project_id: string;
  project_name: string;
  customer_name: string | null;
  lifecycle_stage: string;
  target_end_date: string | null;
  next_scheduled_date: string | null;
};

/** Projects this worker is assigned to (ongoing or day-scheduled), active first. */
export async function listProjectsForWorker(
  tenantId: string,
  workerProfileId: string,
): Promise<WorkerAssignedProject[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('project_assignments')
    .select('project_id, scheduled_date')
    .eq('tenant_id', tenantId)
    .eq('worker_profile_id', workerProfileId);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const projectIds = Array.from(new Set(rows.map((r) => r.project_id as string)));

  // Earliest upcoming scheduled_date per project (>= today), or null.
  const nextByProject = new Map<string, string | null>();
  for (const pid of projectIds) nextByProject.set(pid, null);
  for (const r of rows) {
    const d = r.scheduled_date as string | null;
    if (!d || d < today) continue;
    const current = nextByProject.get(r.project_id as string);
    if (!current || d < current) nextByProject.set(r.project_id as string, d);
  }

  // Workers only see projects they can still charge to — hide complete,
  // cancelled, declined, and on_hold. Historical time entries keep their
  // project_id FK so the worker's own timesheet still shows the project
  // name; this filter just scopes the "projects I can log against" list.
  const { data: projects, error: projErr } = await admin
    .from('projects')
    .select('id, name, lifecycle_stage, target_end_date, customers:customer_id (name)')
    .in('id', projectIds)
    .in('lifecycle_stage', ['planning', 'awaiting_approval', 'active'])
    .is('deleted_at', null);
  if (projErr) throw new Error(projErr.message);

  const stageRank: Record<string, number> = {
    active: 0,
    awaiting_approval: 1,
    planning: 2,
  };

  return ((projects ?? []) as unknown as Array<Record<string, unknown>>)
    .map((p) => {
      const customersRaw = p.customers as { name?: string } | { name?: string }[] | null;
      const customer = Array.isArray(customersRaw) ? customersRaw[0] : customersRaw;
      return {
        project_id: p.id as string,
        project_name: p.name as string,
        customer_name: (customer?.name as string | undefined) ?? null,
        lifecycle_stage: p.lifecycle_stage as string,
        target_end_date: (p.target_end_date as string | null) ?? null,
        next_scheduled_date: nextByProject.get(p.id as string) ?? null,
      };
    })
    .sort(
      (a, b) =>
        (stageRank[a.lifecycle_stage] ?? 99) - (stageRank[b.lifecycle_stage] ?? 99) ||
        a.project_name.localeCompare(b.project_name),
    );
}

export async function getAssignment(
  tenantId: string,
  assignmentId: string,
): Promise<ProjectAssignmentRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('project_assignments')
    .select(COLUMNS)
    .eq('id', assignmentId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return (data as ProjectAssignmentRow) ?? null;
}

export async function isWorkerAssignedToProject(
  tenantId: string,
  workerProfileId: string,
  projectId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('project_assignments')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('worker_profile_id', workerProfileId)
    .eq('project_id', projectId)
    .limit(1);
  return (data ?? []).length > 0;
}
