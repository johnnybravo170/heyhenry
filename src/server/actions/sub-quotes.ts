'use server';

/**
 * Sub quote server actions — the "committed" layer of cost control.
 *
 * Phase 1 of SUB_QUOTES_PLAN.md. No AI upload yet; operator enters the
 * quote manually (or uploads an attachment that we just store; parsing
 * lands in Phase 2).
 *
 * Invariant enforced at the action layer (not DB): sum of allocations
 * must equal total_cents before a quote can transition to `accepted`.
 * See PATTERNS.md §5 for the { ok, error } action shape.
 */

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const ATTACHMENTS_BUCKET = 'sub-quotes';
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB

export type SubQuoteResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const allocationInput = z.object({
  bucket_id: z.string().uuid(),
  allocated_cents: z.coerce.number().int().min(0),
  notes: z.string().trim().max(500).nullable().optional(),
});

const subQuoteCreateSchema = z.object({
  project_id: z.string().uuid(),
  vendor_name: z.string().trim().min(1, { message: 'Vendor name is required.' }).max(200),
  vendor_email: z.string().trim().email().optional().or(z.literal('')),
  vendor_phone: z.string().trim().max(40).optional().or(z.literal('')),
  total_cents: z.coerce.number().int().min(0),
  scope_description: z.string().trim().max(5000).optional().or(z.literal('')),
  notes: z.string().trim().max(5000).optional().or(z.literal('')),
  quote_date: z.string().optional().or(z.literal('')),
  valid_until: z.string().optional().or(z.literal('')),
  allocations: z.array(allocationInput).optional().default([]),
});

function extFromContentType(contentType: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/heic' || contentType === 'image/heif') return 'heic';
  if (contentType === 'application/pdf') return 'pdf';
  return 'jpg';
}

/**
 * Create a new sub quote with its allocations. Takes a FormData so we
 * can receive the attachment file alongside the JSON fields. Allocations
 * are passed as a JSON string in `allocations`.
 *
 * Quote starts as `pending_review` regardless of whether allocations
 * balance — acceptance is a separate step that enforces the invariant.
 */
export async function createSubQuoteAction(formData: FormData): Promise<SubQuoteResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };

  const rawAllocations = formData.get('allocations');
  let parsedAllocations: unknown[] = [];
  if (typeof rawAllocations === 'string' && rawAllocations.length > 0) {
    try {
      parsedAllocations = JSON.parse(rawAllocations);
    } catch {
      return { ok: false, error: 'Invalid allocations payload.' };
    }
  }

  const parsed = subQuoteCreateSchema.safeParse({
    project_id: String(formData.get('project_id') ?? ''),
    vendor_name: String(formData.get('vendor_name') ?? ''),
    vendor_email: String(formData.get('vendor_email') ?? ''),
    vendor_phone: String(formData.get('vendor_phone') ?? ''),
    total_cents: Number(formData.get('total_cents') ?? 0),
    scope_description: String(formData.get('scope_description') ?? ''),
    notes: String(formData.get('notes') ?? ''),
    quote_date: String(formData.get('quote_date') ?? ''),
    valid_until: String(formData.get('valid_until') ?? ''),
    allocations: parsedAllocations,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the errors below.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const admin = createAdminClient();

  // Optional attachment upload. Path convention: {tenant_id}/{quote_id}.{ext}.
  const attachment = formData.get('attachment');
  let attachmentPath: string | null = null;
  if (attachment && attachment instanceof File && attachment.size > 0) {
    if (attachment.size > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: 'Attachment is larger than 10MB.' };
    }
    const ext = extFromContentType(attachment.type);
    // Pre-generate the quote id so the storage path and DB row line up.
    const quoteId = randomUUID();
    const path = `${tenant.id}/${quoteId}.${ext}`;
    const { error: upErr } = await admin.storage.from(ATTACHMENTS_BUCKET).upload(path, attachment, {
      contentType: attachment.type || 'application/pdf',
      upsert: false,
    });
    if (upErr) return { ok: false, error: `Attachment upload failed: ${upErr.message}` };
    attachmentPath = path;

    return insertQuote({
      quoteId,
      tenantId: tenant.id,
      createdBy: tenant.member.id,
      parsed: parsed.data,
      attachmentPath,
    });
  }

  return insertQuote({
    quoteId: randomUUID(),
    tenantId: tenant.id,
    createdBy: tenant.member.id,
    parsed: parsed.data,
    attachmentPath: null,
  });
}

async function insertQuote(args: {
  quoteId: string;
  tenantId: string;
  createdBy: string;
  parsed: z.infer<typeof subQuoteCreateSchema>;
  attachmentPath: string | null;
}): Promise<SubQuoteResult> {
  const { quoteId, tenantId, createdBy, parsed, attachmentPath } = args;

  const supabase = await createClient();

  const { error: insertErr } = await supabase.from('project_sub_quotes').insert({
    id: quoteId,
    tenant_id: tenantId,
    project_id: parsed.project_id,
    vendor_name: parsed.vendor_name.trim(),
    vendor_email: parsed.vendor_email?.trim() || null,
    vendor_phone: parsed.vendor_phone?.trim() || null,
    total_cents: parsed.total_cents,
    scope_description: parsed.scope_description?.trim() || null,
    notes: parsed.notes?.trim() || null,
    quote_date: parsed.quote_date || null,
    valid_until: parsed.valid_until || null,
    attachment_storage_path: attachmentPath,
    source: attachmentPath ? 'upload' : 'manual',
    created_by: createdBy,
  });
  if (insertErr) return { ok: false, error: insertErr.message };

  // Allocations — bulk insert. Zero-count is OK; balance is checked only
  // on accept, not on create.
  if (parsed.allocations.length > 0) {
    const rows = parsed.allocations.map((a) => ({
      sub_quote_id: quoteId,
      bucket_id: a.bucket_id,
      allocated_cents: a.allocated_cents,
      notes: a.notes?.trim() || null,
    }));
    const { error: allocErr } = await supabase.from('project_sub_quote_allocations').insert(rows);
    if (allocErr) {
      // Roll back the quote row so we don't leave a dangling parent.
      await supabase.from('project_sub_quotes').delete().eq('id', quoteId);
      return { ok: false, error: `Allocation insert failed: ${allocErr.message}` };
    }
  }

  revalidatePath(`/projects/${parsed.project_id}`);
  return { ok: true, id: quoteId };
}

// ---------------------------------------------------------------------------
// Update / status transitions
// ---------------------------------------------------------------------------

/**
 * Replace a sub quote's allocation set. Used when the operator edits
 * allocations in the editor. Takes the full new set; we wipe+reinsert
 * because the math is clearer than diffing. Doesn't change quote status.
 */
export async function setSubQuoteAllocationsAction(input: {
  subQuoteId: string;
  projectId: string;
  allocations: Array<{ bucket_id: string; allocated_cents: number; notes?: string | null }>;
}): Promise<SubQuoteResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };

  const schema = z.object({
    subQuoteId: z.string().uuid(),
    projectId: z.string().uuid(),
    allocations: z.array(allocationInput),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };

  const supabase = await createClient();
  const { error: delErr } = await supabase
    .from('project_sub_quote_allocations')
    .delete()
    .eq('sub_quote_id', parsed.data.subQuoteId);
  if (delErr) return { ok: false, error: delErr.message };

  if (parsed.data.allocations.length > 0) {
    const rows = parsed.data.allocations.map((a) => ({
      sub_quote_id: parsed.data.subQuoteId,
      bucket_id: a.bucket_id,
      allocated_cents: a.allocated_cents,
      notes: a.notes?.trim() || null,
    }));
    const { error: insErr } = await supabase.from('project_sub_quote_allocations').insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  await supabase
    .from('project_sub_quotes')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', parsed.data.subQuoteId);

  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { ok: true, id: parsed.data.subQuoteId };
}

/**
 * Accept a sub quote. Enforces the invariant: sum of allocations must
 * equal total_cents. If a prior accepted quote from the same vendor
 * exists on this project AND shares a bucket, that prior quote is
 * superseded (its status flips, `superseded_by_id` points at this one).
 *
 * `replaceExisting`:
 *   - `'auto'` — apply supersede if bucket-overlap, else leave in place
 *   - `'yes'`  — force supersede every accepted quote from this vendor
 *   - `'no'`   — leave any existing accepted quotes alone
 */
export async function acceptSubQuoteAction(input: {
  subQuoteId: string;
  projectId: string;
  replaceExisting?: 'auto' | 'yes' | 'no';
}): Promise<SubQuoteResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };

  const supabase = await createClient();

  // Load the quote + allocations so we can check the balance invariant.
  const { data: quote, error: qErr } = await supabase
    .from('project_sub_quotes')
    .select('id, vendor_name, total_cents, status, project_id')
    .eq('id', input.subQuoteId)
    .single();
  if (qErr || !quote) return { ok: false, error: 'Sub quote not found.' };

  const { data: allocations, error: aErr } = await supabase
    .from('project_sub_quote_allocations')
    .select('bucket_id, allocated_cents')
    .eq('sub_quote_id', input.subQuoteId);
  if (aErr) return { ok: false, error: aErr.message };

  const allocSum = (allocations ?? []).reduce(
    (s, a) => s + ((a.allocated_cents as number) ?? 0),
    0,
  );
  if (allocSum !== (quote.total_cents as number)) {
    return {
      ok: false,
      error: `Allocations total $${(allocSum / 100).toFixed(2)}, but the quote total is $${((quote.total_cents as number) / 100).toFixed(2)}. Balance them before accepting.`,
    };
  }
  if ((quote.total_cents as number) === 0) {
    return { ok: false, error: 'Cannot accept a zero-dollar quote.' };
  }

  // Existing accepted quotes from the same vendor on the same project.
  const { data: priorAccepted } = await supabase
    .from('project_sub_quotes')
    .select('id, total_cents')
    .eq('project_id', quote.project_id as string)
    .eq('vendor_name', quote.vendor_name as string)
    .eq('status', 'accepted')
    .neq('id', input.subQuoteId);

  const replaceMode = input.replaceExisting ?? 'auto';
  const toSupersede: string[] = [];
  if (replaceMode === 'yes') {
    toSupersede.push(...(priorAccepted ?? []).map((p) => p.id as string));
  } else if (replaceMode === 'auto' && priorAccepted?.length) {
    // Supersede only when bucket overlap exists — different buckets =
    // genuinely separate scopes (tile kitchen vs tile bathroom).
    const ourBuckets = new Set((allocations ?? []).map((a) => a.bucket_id as string));
    for (const prior of priorAccepted) {
      const { data: priorAllocs } = await supabase
        .from('project_sub_quote_allocations')
        .select('bucket_id')
        .eq('sub_quote_id', prior.id as string);
      const overlap = (priorAllocs ?? []).some((pa) => ourBuckets.has(pa.bucket_id as string));
      if (overlap) toSupersede.push(prior.id as string);
    }
  }

  if (toSupersede.length) {
    await supabase
      .from('project_sub_quotes')
      .update({
        status: 'superseded',
        superseded_by_id: input.subQuoteId,
        updated_at: new Date().toISOString(),
      })
      .in('id', toSupersede);
  }

  const { error: updErr } = await supabase
    .from('project_sub_quotes')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', input.subQuoteId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/projects/${input.projectId}`);
  return { ok: true, id: input.subQuoteId };
}

export async function rejectSubQuoteAction(input: {
  subQuoteId: string;
  projectId: string;
}): Promise<SubQuoteResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('project_sub_quotes')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', input.subQuoteId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${input.projectId}`);
  return { ok: true, id: input.subQuoteId };
}

export async function deleteSubQuoteAction(input: {
  subQuoteId: string;
  projectId: string;
}): Promise<SubQuoteResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };

  const supabase = await createClient();
  const { error } = await supabase.from('project_sub_quotes').delete().eq('id', input.subQuoteId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${input.projectId}`);
  return { ok: true, id: input.subQuoteId };
}

// ---------------------------------------------------------------------------
// Inline bucket creation (from the allocation editor)
// ---------------------------------------------------------------------------

const bucketSectionSchema = z.enum(['interior', 'exterior', 'general']);

/**
 * Create a new cost bucket on a project from inside the allocation
 * editor. Returns the new bucket so the caller can append it to the
 * in-memory bucket list and select it in a fresh allocation row.
 */
export async function createProjectBucketAction(input: {
  projectId: string;
  name: string;
  section: 'interior' | 'exterior' | 'general';
}): Promise<
  | { ok: true; bucket: { id: string; name: string; section: 'interior' | 'exterior' | 'general' } }
  | { ok: false; error: string }
> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };

  const parsed = z
    .object({
      projectId: z.string().uuid(),
      name: z.string().trim().min(1).max(120),
      section: bucketSectionSchema,
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };

  const supabase = await createClient();

  // Next display_order = max(existing) + 10 so the new bucket lands at
  // the end of the list without clashing.
  const { data: existing } = await supabase
    .from('project_cost_buckets')
    .select('display_order')
    .eq('project_id', parsed.data.projectId)
    .order('display_order', { ascending: false })
    .limit(1);
  const nextOrder = ((existing?.[0]?.display_order as number | undefined) ?? 0) + 10;

  const { data, error } = await supabase
    .from('project_cost_buckets')
    .insert({
      tenant_id: tenant.id,
      project_id: parsed.data.projectId,
      name: parsed.data.name.trim(),
      section: parsed.data.section,
      display_order: nextOrder,
    })
    .select('id, name, section')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create bucket.' };

  revalidatePath(`/projects/${parsed.data.projectId}`);
  return {
    ok: true,
    bucket: {
      id: data.id as string,
      name: data.name as string,
      section: data.section as 'interior' | 'exterior' | 'general',
    },
  };
}
