'use server';

/**
 * Server actions for the homeowner decision queue. Slice 3 of the
 * Customer Portal build.
 *
 * The operator creates and dismisses decisions through the RLS-aware
 * client. Homeowner-side actions (decide, ask) go through the admin
 * client because the public `/decide/<code>` page is unauthenticated;
 * the approval_code on the decision row is the auth.
 */

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type DecisionActionResult = { ok: true } | { ok: false; error: string };

/**
 * Generate a URL-safe approval code. 12 random bytes → ~16 base64url
 * chars. Matches the magnitude of `change_orders.approval_code` and
 * the existing `pulse_updates.public_code`.
 */
function generateApprovalCode(): string {
  return randomBytes(12).toString('base64url');
}

export async function createDecisionAction(input: {
  projectId: string;
  label: string;
  description?: string | null;
  dueDate?: string | null;
  photoRefs?: Array<{ photo_id: string; storage_path: string; caption?: string | null }>;
}): Promise<DecisionActionResult> {
  const label = input.label.trim();
  if (!label) return { ok: false, error: 'Label is required.' };

  const supabase = await createClient();

  // Need tenant_id to satisfy NOT NULL — read it off the project row.
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('tenant_id')
    .eq('id', input.projectId)
    .single();
  if (projErr || !project) {
    return { ok: false, error: projErr?.message ?? 'Project not found.' };
  }

  const { error } = await supabase.from('project_decisions').insert({
    tenant_id: (project as Record<string, unknown>).tenant_id,
    project_id: input.projectId,
    label,
    description: input.description?.trim() || null,
    due_date: input.dueDate || null,
    status: 'pending',
    photo_refs: input.photoRefs ?? [],
    approval_code: generateApprovalCode(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${input.projectId}`);
  return { ok: true };
}

export async function dismissDecisionAction(
  decisionId: string,
  projectId: string,
): Promise<DecisionActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('project_decisions')
    .update({ status: 'dismissed' })
    .eq('id', decisionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/**
 * Public endpoint — homeowner makes a decision. Called from both the
 * inline portal panel and the dedicated /decide/<code> page. Uses the
 * admin client because the homeowner is unauthenticated; the
 * approval_code is the auth token.
 *
 * `value` is what they picked (e.g. "Approved", "Declined", or the
 * actual selected option for V2 multi-option decisions). For V1
 * approve/decline we pass 'approved' or 'declined' as the value.
 */
export async function decideByCodeAction(input: {
  code: string;
  value: 'approved' | 'declined';
  customerName: string;
}): Promise<DecisionActionResult> {
  const customerName = input.customerName.trim();
  if (!customerName) return { ok: false, error: 'Please enter your name.' };

  const admin = createAdminClient();

  // Look up the decision and verify it's still pending. Admin client
  // bypasses RLS — the approval_code lookup is the auth.
  const { data: decision, error: lookupErr } = await admin
    .from('project_decisions')
    .select('id, project_id, status')
    .eq('approval_code', input.code)
    .single();
  if (lookupErr || !decision) {
    return { ok: false, error: 'Decision not found or link expired.' };
  }
  if ((decision as Record<string, unknown>).status !== 'pending') {
    return { ok: false, error: 'This decision has already been answered.' };
  }

  const { error } = await admin
    .from('project_decisions')
    .update({
      status: 'decided',
      decided_value: input.value,
      decided_at: new Date().toISOString(),
      decided_by_customer: customerName,
    })
    .eq('id', (decision as Record<string, unknown>).id as string);
  if (error) return { ok: false, error: error.message };

  // Surface the answer in the project's portal updates feed and worklog
  // so the operator sees it the same way they see CO approvals.
  const projectId = (decision as Record<string, unknown>).project_id as string;
  await admin.from('project_portal_updates').insert({
    project_id: projectId,
    tenant_id: (await admin.from('projects').select('tenant_id').eq('id', projectId).single()).data
      ?.tenant_id,
    type: 'message',
    title: input.value === 'approved' ? 'Decision approved' : 'Decision declined',
    body: `${customerName} ${input.value} a decision request.`,
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/**
 * "Ask a question" — homeowner submits a clarifying question instead
 * of approve/decline. Lands as a portal update so the operator sees
 * it; doesn't change the decision status (still pending).
 */
export async function askDecisionByCodeAction(input: {
  code: string;
  customerName: string;
  question: string;
}): Promise<DecisionActionResult> {
  const customerName = input.customerName.trim();
  const question = input.question.trim();
  if (!customerName) return { ok: false, error: 'Please enter your name.' };
  if (!question) return { ok: false, error: 'Please enter a question.' };

  const admin = createAdminClient();
  const { data: decision } = await admin
    .from('project_decisions')
    .select('id, project_id, label, tenant_id')
    .eq('approval_code', input.code)
    .single();
  if (!decision) return { ok: false, error: 'Decision not found or link expired.' };

  const d = decision as Record<string, unknown>;
  await admin.from('project_portal_updates').insert({
    project_id: d.project_id,
    tenant_id: d.tenant_id,
    type: 'message',
    title: `Question on: ${d.label}`,
    body: `${customerName}: ${question}`,
  });

  revalidatePath(`/projects/${d.project_id as string}`);
  return { ok: true };
}
