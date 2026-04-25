/**
 * Project phase queries.
 *
 * Phases are the homeowner-facing milestone roadmap (NOT a Gantt). Auto-
 * seeded via DB trigger on project insert. Tenant isolation runs through
 * `current_tenant_id()` in the `project_phases` RLS policies; application
 * code never filters on `tenant_id`.
 */

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type ProjectPhaseStatus = 'upcoming' | 'in_progress' | 'complete';

export type ProjectPhase = {
  id: string;
  project_id: string;
  name: string;
  display_order: number;
  status: ProjectPhaseStatus;
  started_at: string | null;
  completed_at: string | null;
};

/**
 * RLS-aware list. Used by the operator's Portal tab.
 */
export const listPhasesForProject = cache(async (projectId: string): Promise<ProjectPhase[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('project_phases')
    .select('id, project_id, name, display_order, status, started_at, completed_at')
    .eq('project_id', projectId)
    .order('display_order', { ascending: true });
  return (data ?? []) as ProjectPhase[];
});
