'use server';

/**
 * Server actions for project phases (Slice 1 of the Customer Portal build).
 *
 * Phases are the homeowner-facing milestone roadmap. The operator advances
 * / regresses the current phase from the Portal tab. Mutations run through
 * the RLS-aware server client; tenant isolation is enforced by the
 * project_phases RLS policies (no app-side tenant filtering).
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type PhaseActionResult = { ok: true } | { ok: false; error: string };

/**
 * Mark the current `in_progress` phase complete and the next `upcoming`
 * phase `in_progress`. No-op (returns ok) if the project is already on
 * its last phase.
 */
export async function advancePhaseAction(projectId: string): Promise<PhaseActionResult> {
  const supabase = await createClient();

  const { data: phases, error: listErr } = await supabase
    .from('project_phases')
    .select('id, status, display_order')
    .eq('project_id', projectId)
    .order('display_order', { ascending: true });

  if (listErr || !phases) return { ok: false, error: listErr?.message ?? 'Could not load phases.' };

  const currentIdx = phases.findIndex((p) => p.status === 'in_progress');
  // No current phase yet (all upcoming or all complete) — start the first one.
  if (currentIdx === -1) {
    const firstUpcoming = phases.find((p) => p.status === 'upcoming');
    if (!firstUpcoming) return { ok: true }; // all complete; nothing to advance
    const { error } = await supabase
      .from('project_phases')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', firstUpcoming.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  }

  const current = phases[currentIdx];
  const next = phases[currentIdx + 1];

  // Last phase — complete it and stop.
  if (!next) {
    const { error } = await supabase
      .from('project_phases')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', current.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  }

  // Two-step: complete current, start next. Done in two queries because
  // Supabase doesn't support multi-row UPDATE with different values per
  // row in a single call; failure between them is OK because the next
  // advance will recover.
  const now = new Date().toISOString();
  const { error: e1 } = await supabase
    .from('project_phases')
    .update({ status: 'complete', completed_at: now })
    .eq('id', current.id);
  if (e1) return { ok: false, error: e1.message };

  const { error: e2 } = await supabase
    .from('project_phases')
    .update({ status: 'in_progress', started_at: now })
    .eq('id', next.id);
  if (e2) return { ok: false, error: e2.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/**
 * Mark the current `in_progress` phase back to `upcoming` and re-open the
 * previous `complete` phase as `in_progress`. No-op if there is no
 * previous phase or no in-progress phase. Used when the operator
 * accidentally advanced or wants to re-do a stage.
 */
export async function regressPhaseAction(projectId: string): Promise<PhaseActionResult> {
  const supabase = await createClient();

  const { data: phases, error: listErr } = await supabase
    .from('project_phases')
    .select('id, status, display_order')
    .eq('project_id', projectId)
    .order('display_order', { ascending: true });

  if (listErr || !phases) return { ok: false, error: listErr?.message ?? 'Could not load phases.' };

  const currentIdx = phases.findIndex((p) => p.status === 'in_progress');

  // No in-progress phase — last one might be complete; re-open it.
  if (currentIdx === -1) {
    // Find the last complete phase.
    let lastCompleteIdx = -1;
    for (let i = phases.length - 1; i >= 0; i--) {
      if (phases[i].status === 'complete') {
        lastCompleteIdx = i;
        break;
      }
    }
    if (lastCompleteIdx === -1) return { ok: true }; // nothing to regress
    const { error } = await supabase
      .from('project_phases')
      .update({ status: 'in_progress', completed_at: null })
      .eq('id', phases[lastCompleteIdx].id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  }

  const current = phases[currentIdx];
  const prev = phases[currentIdx - 1];

  // First phase — just reset it to upcoming.
  if (!prev) {
    const { error } = await supabase
      .from('project_phases')
      .update({ status: 'upcoming', started_at: null })
      .eq('id', current.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  }

  const { error: e1 } = await supabase
    .from('project_phases')
    .update({ status: 'upcoming', started_at: null })
    .eq('id', current.id);
  if (e1) return { ok: false, error: e1.message };

  const { error: e2 } = await supabase
    .from('project_phases')
    .update({ status: 'in_progress', completed_at: null })
    .eq('id', prev.id);
  if (e2) return { ok: false, error: e2.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
