'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/ops-gate';
import { createServiceClient } from '@/lib/supabase';
import { commentCard, createCard, moveCard, updateCard } from '@/server/ops-services/kanban';

export type ActionResult = { ok: true } | { ok: false; error: string };

type BundleOption = { key?: string; label?: string; blast_radius?: string; recommended?: boolean };

type Bundle = {
  id: string;
  bucket: string;
  status: string;
  question: string;
  recommendation: string | null;
  why_today: string | null;
  options: BundleOption[] | null;
  card_id: string | null;
};

async function loadBundle(id: string): Promise<Bundle | null> {
  const service = createServiceClient();
  const { data } = await service
    .schema('ops')
    .from('decision_bundles')
    .select('id, bucket, status, question, recommendation, why_today, options, card_id')
    .eq('id', id)
    .maybeSingle();
  return (data as Bundle) ?? null;
}

function settled(status: string): boolean {
  return status === 'resolved' || status === 'archived';
}

type AdminCtx = { actorType: 'human'; actorName: string; keyId: null; adminUserId: string };

// Low-blast-radius work can auto-ship (PR, never merge) per the autonomy
// boundary (knowledge 57e7d23d). Anything touching $/schema/auth/the MCP
// surface / shared design tokens — or with no blast info — is review-gated.
const LOW_BLAST = new Set(['none', 'low', 'ui', 'copy', 'presentational', 'component', 'isolated']);

function routeTagFor(option: BundleOption | undefined): 'cc:autoship' | 'cc:review' {
  const blast = (option?.blast_radius ?? '').toLowerCase().trim();
  return LOW_BLAST.has(blast) ? 'cc:autoship' : 'cc:review';
}

/**
 * Dispatch a resolved decision so the work actually moves — not just logged.
 * Card-linked: comment the call, unblock (→ todo), tag the execution route
 * (cc:autoship for low-blast → the dispatch routine opens a PR; cc:review for
 * gated work). Card-less (manual/research act): create a tracked task assigned
 * to Jonathan. Best-effort — callers must not let a dispatch failure fail the
 * resolve (the decision log is the source of truth).
 */
async function dispatchResolution(
  ctx: AdminCtx,
  bundle: Bundle,
  choice: string,
  decisionId: string,
): Promise<void> {
  const option = (bundle.options ?? []).find((o) => (o.key ?? o.label ?? '').toString() === choice);
  const routeTag = routeTagFor(option);
  const chosenLabel = option?.label ?? option?.key ?? choice;
  const recLine = bundle.recommendation ? `\n\n${bundle.recommendation}` : '';

  if (bundle.card_id) {
    const service = createServiceClient();
    const { data: card } = await service
      .schema('ops')
      .from('kanban_cards')
      .select('tags')
      .eq('id', bundle.card_id)
      .maybeSingle();
    const tags = Array.from(
      new Set([...((card?.tags as string[] | null) ?? []), 'from-command-center', routeTag]),
    );
    const routeNote =
      routeTag === 'cc:autoship'
        ? 'auto-ship (low blast → PR for you to review)'
        : 'review-gated (higher blast → human/PR review before build)';
    await commentCard(
      ctx,
      bundle.card_id,
      `Command Center decision — Jonathan chose: ${chosenLabel}.${recLine}\n\nRouted: ${routeNote}.`,
    );
    await moveCard(ctx, bundle.card_id, 'todo');
    await updateCard(ctx, bundle.card_id, { tags });
    return;
  }

  // No linked card — a manual/personal act. Track it as a card assigned to Jonathan.
  await createCard(ctx, {
    boardSlug: 'ops',
    title: bundle.question.slice(0, 200),
    column: 'todo',
    body: `From the Command Center — Jonathan chose: ${chosenLabel}.${recLine}`,
    assignee: ctx.actorName,
    tags: ['cc:task', 'from-command-center'],
    related_type: 'decision',
    related_id: decisionId,
  });
}

/**
 * Resolve a bundle by accepting it: a chosen option (decision/go_nogo) or
 * "do it" (research/grooming). Logs the call into ops.decisions and links it.
 */
export async function resolveBundleAction(input: {
  id: string;
  choice: string;
  note?: string;
  rating?: number;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const bundle = await loadBundle(input.id);
  if (!bundle) return { ok: false, error: 'Bundle not found.' };
  if (settled(bundle.status)) return { ok: false, error: 'Already resolved.' };
  if (!input.choice.trim()) return { ok: false, error: 'A choice is required.' };

  const service = createServiceClient();

  const hypothesisParts = [bundle.recommendation, bundle.why_today, input.note?.trim()].filter(
    (s): s is string => Boolean(s && s.trim()),
  );
  const { data: decision, error: decisionErr } = await service
    .schema('ops')
    .from('decisions')
    .insert({
      actor_type: 'human',
      actor_name: admin.email,
      admin_user_id: admin.userId,
      title: bundle.question.slice(0, 500),
      hypothesis: hypothesisParts.join('\n\n') || bundle.question,
      action: `Command Center: ${input.choice}`,
      tags: ['from-command-center', bundle.bucket],
    })
    .select('id')
    .single();
  if (decisionErr || !decision) {
    return { ok: false, error: decisionErr?.message ?? 'Failed to log decision.' };
  }

  const { error } = await service
    .schema('ops')
    .from('decision_bundles')
    .update({
      status: 'resolved',
      choice: input.choice,
      rating: input.rating ?? null,
      resolution_note: input.note?.trim() || null,
      decision_id: decision.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  // Dispatch the decided work so it actually moves. Best-effort: a failure
  // here must not fail the resolve — the decision is already logged + the
  // bundle settled.
  try {
    await dispatchResolution(
      { actorType: 'human', actorName: admin.email, keyId: null, adminUserId: admin.userId },
      bundle,
      input.choice,
      decision.id,
    );
  } catch {
    // swallow — dispatch is a side-effect, not the source of truth
  }

  revalidatePath('/admin/queue');
  return { ok: true };
}

/**
 * Park a good-but-premature item with a resurface trigger. Not a delete —
 * the Routine wakes it back into triage when the now-context stage advances.
 */
export async function parkBundleAction(input: {
  id: string;
  resurface_trigger: string;
  note?: string;
  rating?: number;
}): Promise<ActionResult> {
  await requireAdmin();
  const bundle = await loadBundle(input.id);
  if (!bundle) return { ok: false, error: 'Bundle not found.' };
  if (settled(bundle.status)) return { ok: false, error: 'Already resolved.' };
  if (!input.resurface_trigger.trim()) {
    return { ok: false, error: 'A resurface trigger is required (e.g. resurface:v1).' };
  }

  const service = createServiceClient();
  const { error } = await service
    .schema('ops')
    .from('decision_bundles')
    .update({
      status: 'parked',
      choice: 'not_now',
      resurface_trigger: input.resurface_trigger.trim(),
      rating: input.rating ?? null,
      resolution_note: input.note?.trim() || null,
    })
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/queue');
  return { ok: true };
}

/**
 * Leave a note / question on a bundle WITHOUT resolving it. Appends to the
 * bundle's feedback thread (the morning routine reads it) and, when the bundle
 * is linked to a kanban card, posts the same note as a comment on that card so
 * it's actionable where the work lives.
 */
export async function noteBundleAction(input: { id: string; note: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const note = input.note.trim();
  if (!note) return { ok: false, error: 'A note is required.' };

  const service = createServiceClient();
  const { data: bundle } = await service
    .schema('ops')
    .from('decision_bundles')
    .select('id, card_id, related_type, feedback')
    .eq('id', input.id)
    .maybeSingle();
  if (!bundle) return { ok: false, error: 'Bundle not found.' };

  const entry = `[${new Date().toISOString()}] ${admin.email}: ${note}`;
  const nextFeedback = bundle.feedback ? `${bundle.feedback}\n${entry}` : entry;

  const { error } = await service
    .schema('ops')
    .from('decision_bundles')
    .update({ feedback: nextFeedback })
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  // Mirror onto the linked kanban card so a stale/already-handled card gets
  // flagged where the work lives. Non-fatal — the note is saved regardless.
  if (bundle.related_type === 'kanban' && bundle.card_id) {
    try {
      await commentCard(
        { actorType: 'human', actorName: admin.email, keyId: null, adminUserId: admin.userId },
        bundle.card_id,
        `From the Command Center queue: ${note}`,
      );
    } catch {
      // swallow — kanban comment is best-effort
    }
  }

  revalidatePath('/admin/queue');
  return { ok: true };
}

/** Dismiss an item for good ("never"), with a one-line reason. */
export async function archiveBundleAction(input: {
  id: string;
  note?: string;
  rating?: number;
}): Promise<ActionResult> {
  await requireAdmin();
  const bundle = await loadBundle(input.id);
  if (!bundle) return { ok: false, error: 'Bundle not found.' };
  if (settled(bundle.status)) return { ok: false, error: 'Already resolved.' };

  const service = createServiceClient();
  const { error } = await service
    .schema('ops')
    .from('decision_bundles')
    .update({
      status: 'archived',
      choice: 'never',
      rating: input.rating ?? null,
      resolution_note: input.note?.trim() || null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/queue');
  return { ok: true };
}
