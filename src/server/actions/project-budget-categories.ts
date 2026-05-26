'use server';

/**
 * Server actions for project budget category management.
 */

import { revalidatePath } from 'next/cache';
import { draftScopeSummary, type ScopeSummaryLine } from '@/lib/ai/estimate-scope-summary';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { resolveBudgetSectionId } from '@/lib/db/queries/project-budget-categories';
import { createClient } from '@/lib/supabase/server';

export type BudgetCategoryActionResult = { ok: true; id: string } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Section entity CRUD (project_budget_sections)
//
// Sections are a real entity and the single source of truth: categories carry
// `section_id`, and every reader joins the section row. The legacy free-text
// `section` string column + its sync triggers were dropped in the contract
// migration, so there is no denormalized string to maintain here.
// ---------------------------------------------------------------------------

/**
 * Create an empty budget section. The new minimal "Add section" form calls
 * this — an empty section persists (no first-category requirement).
 */
export async function createBudgetSectionAction(input: {
  project_id: string;
  name: string;
  description_md?: string;
}): Promise<BudgetCategoryActionResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return { ok: false, error: 'Not signed in or missing tenant.' };
  }

  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Section name cannot be empty.' };
  if (name.length > 80) return { ok: false, error: 'Section name too long.' };

  const supabase = await createClient();

  const { data: maxRow } = await supabase
    .from('project_budget_sections')
    .select('sort_order')
    .eq('project_id', input.project_id)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = maxRow?.[0] ? (maxRow[0] as { sort_order: number }).sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('project_budget_sections')
    .insert({
      project_id: input.project_id,
      tenant_id: tenant.id,
      name,
      description_md: input.description_md?.trim() || null,
      sort_order: nextOrder,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Failed to create section.' };
  }

  revalidatePath(`/projects/${input.project_id}`);
  return { ok: true, id: data.id };
}

/**
 * Update a section's name and/or description. A rename is a single-row update
 * — every reader joins the section entity, so there is no per-category string
 * to cascade.
 */
export async function updateBudgetSectionAction(input: {
  id: string;
  project_id: string;
  name?: string;
  description_md?: string;
}): Promise<BudgetCategoryActionResult> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) return { ok: false, error: 'Section name cannot be empty.' };
    if (trimmed.length > 80) return { ok: false, error: 'Section name too long.' };
    updates.name = trimmed;
  }
  if (input.description_md !== undefined) {
    updates.description_md = input.description_md.trim() || null;
  }

  const { error } = await supabase
    .from('project_budget_sections')
    .update(updates)
    .eq('id', input.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${input.project_id}`);
  return { ok: true, id: input.id };
}

/**
 * Reorder sections by writing sort_order = array index. Section ordering now
 * lives on project_budget_sections.sort_order.
 */
export async function reorderBudgetSectionsAction(input: {
  project_id: string;
  ordered_ids: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  for (let i = 0; i < input.ordered_ids.length; i++) {
    const { error } = await supabase
      .from('project_budget_sections')
      .update({ sort_order: i, updated_at: now })
      .eq('id', input.ordered_ids[i])
      .eq('project_id', input.project_id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/projects/${input.project_id}`);
  return { ok: true };
}

/**
 * Delete a section. Blocked when it still has categories — the operator must
 * move or remove them first (categories carry spend history).
 */
export async function deleteBudgetSectionAction(input: {
  id: string;
  project_id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { count } = await supabase
    .from('project_budget_categories')
    .select('id', { count: 'exact', head: true })
    .eq('section_id', input.id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: 'This section still has categories. Move or remove them before deleting it.',
    };
  }

  const { error } = await supabase.from('project_budget_sections').delete().eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${input.project_id}`);
  return { ok: true };
}

/**
 * ✦ Draft a section's description with Henry from its own scope. The
 * per-section twin of the project-level estimate scope summary: gathers ONLY
 * client-safe material (this section's category names + cost-line
 * labels/notes) and reuses the margin-safe `draftScopeSummary` helper —
 * NEVER prices, totals, markup, margin, or supplier. Returns a paragraph the
 * operator edits + saves via updateBudgetSectionAction; never persists itself.
 */
export async function draftBudgetSectionDescriptionAction(input: {
  section_id: string;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };
  if (!input?.section_id) return { ok: false, error: 'Invalid section.' };

  const supabase = await createClient();

  // Section row (RLS-scoped to the tenant) + its project name for context.
  const { data: section } = await supabase
    .from('project_budget_sections')
    .select('name, project:projects!project_id(name)')
    .eq('id', input.section_id)
    .maybeSingle();
  if (!section) return { ok: false, error: 'Section not found.' };

  const { data: categories } = await supabase
    .from('project_budget_categories')
    .select('id, name')
    .eq('section_id', input.section_id);

  const catNameById = new Map<string, string>();
  for (const c of categories ?? []) catNameById.set(c.id as string, (c.name as string) ?? '');
  const catIds = Array.from(catNameById.keys());

  const sectionName = section.name as string;
  let scopeLines: ScopeSummaryLine[] = [];

  if (catIds.length > 0) {
    // Client-safe columns ONLY — no unit_price_cents / line_price_cents.
    const { data: lineRows } = await supabase
      .from('project_cost_lines')
      .select('label, notes, budget_category_id')
      .in('budget_category_id', catIds)
      .order('created_at', { ascending: true });

    scopeLines = (lineRows ?? []).map((l) => ({
      label: (l.label as string | null) ?? '',
      notes: (l.notes as string | null) ?? null,
      categoryName: catNameById.get(l.budget_category_id as string) ?? null,
      section: sectionName,
    }));

    // A section can have categories but no priced lines yet — still give the
    // model the category names so the draft has something to describe.
    if (scopeLines.length === 0) {
      scopeLines = (categories ?? []).map((c) => ({
        label: (c.name as string) ?? '',
        categoryName: (c.name as string) ?? null,
        section: sectionName,
      }));
    }
  }

  const projectName =
    (section.project as unknown as { name: string } | null)?.name ?? 'this project';

  const text = await draftScopeSummary({
    projectName,
    description: `Section: ${sectionName}`,
    lines: scopeLines,
  });

  if (!text) {
    return {
      ok: false,
      error:
        'Henry couldn’t draft a description — add a few line items to this section or write one yourself.',
    };
  }
  return { ok: true, text };
}

// Section resolution (find-or-create by name) lives in the query lib as
// `resolveBudgetSectionId` so every writer across the app shares one
// implementation. `resolveSectionId` is the local alias kept for the callers
// below.
const resolveSectionId = resolveBudgetSectionId;

export async function updateBudgetCategoryAction(input: {
  id: string;
  project_id: string;
  name?: string;
  estimate_cents?: number;
  description?: string;
  is_visible_in_report?: boolean;
}): Promise<BudgetCategoryActionResult> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) return { ok: false, error: 'Name cannot be empty.' };
    updates.name = trimmed;
  }
  if (input.estimate_cents !== undefined) {
    // Single-source-of-truth guard: when the bucket has priced cost
    // lines, the lines sum drives the displayed estimate (see
    // project-budget-categories.ts query). Letting the operator edit
    // the envelope here would silently no-op in the UI — a confusing
    // dead control. Force them to edit lines instead.
    const { count: pricedCount } = await supabase
      .from('project_cost_lines')
      .select('id', { count: 'exact', head: true })
      .eq('budget_category_id', input.id)
      .gt('line_price_cents', 0);
    if ((pricedCount ?? 0) > 0) {
      return {
        ok: false,
        error:
          'This category has priced cost lines, so the estimate is the sum of those lines. Edit individual line prices to change it.',
      };
    }
    updates.estimate_cents = input.estimate_cents;
  }
  if (input.description !== undefined) updates.description = input.description || null;
  if (input.is_visible_in_report !== undefined)
    updates.is_visible_in_report = input.is_visible_in_report;

  const { error } = await supabase
    .from('project_budget_categories')
    .update(updates)
    .eq('id', input.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/projects/${input.project_id}`);
  return { ok: true, id: input.id };
}

export async function addBudgetCategoryAction(input: {
  project_id: string;
  name: string;
  section: string;
  description?: string;
  estimate_cents?: number;
}): Promise<BudgetCategoryActionResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return { ok: false, error: 'Not signed in or missing tenant.' };
  }

  const supabase = await createClient();

  // Resolve (or create) the section entity, then set section_id. There is no
  // legacy `section` string column to write — readers join the section entity.
  const sectionName = input.section.trim();
  if (!sectionName) return { ok: false, error: 'Section is required.' };
  const resolved = await resolveSectionId(supabase, tenant.id, input.project_id, sectionName);
  if ('error' in resolved) return { ok: false, error: resolved.error };

  // Determine next display_order
  const { data: existing } = await supabase
    .from('project_budget_categories')
    .select('display_order')
    .eq('project_id', input.project_id)
    .order('display_order', { ascending: false })
    .limit(1);

  const nextOrder = existing?.[0]
    ? (existing[0] as { display_order: number }).display_order + 1
    : 0;

  const { data, error } = await supabase
    .from('project_budget_categories')
    .insert({
      project_id: input.project_id,
      tenant_id: tenant.id,
      name: input.name,
      section_id: resolved.id,
      description: input.description || null,
      estimate_cents: input.estimate_cents ?? 0,
      display_order: nextOrder,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Failed to add category.' };
  }

  revalidatePath(`/projects/${input.project_id}`);
  return { ok: true, id: data.id };
}

/**
 * Move a section up or down by swapping its sort_order with the adjacent
 * section. Section ordering now lives on project_budget_sections.sort_order,
 * so this swaps two section rows — no category rewrites.
 *
 * No-ops gracefully when the section is already at the edge or doesn't exist.
 */
export async function moveSectionAction(input: {
  project_id: string;
  section: string;
  direction: 'up' | 'down';
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from('project_budget_sections')
    .select('id, name, sort_order')
    .eq('project_id', input.project_id)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) return { ok: false, error: error.message };

  const sections = (rows ?? []) as { id: string; name: string; sort_order: number }[];
  const idx = sections.findIndex((s) => s.name === input.section);
  if (idx === -1) return { ok: false, error: 'Section not found.' };

  const swapWith = input.direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= sections.length) {
    return { ok: true }; // already at the edge — no-op
  }

  // Renumber all section rows by their swapped position, so sort_order stays
  // dense even if the stored values had gaps.
  const reordered = [...sections];
  [reordered[idx], reordered[swapWith]] = [reordered[swapWith], reordered[idx]];

  const now = new Date().toISOString();
  for (let i = 0; i < reordered.length; i++) {
    if (reordered[i].sort_order === i) continue;
    const { error: upErr } = await supabase
      .from('project_budget_sections')
      .update({ sort_order: i, updated_at: now })
      .eq('id', reordered[i].id);
    if (upErr) return { ok: false, error: upErr.message };
  }

  revalidatePath(`/projects/${input.project_id}`);
  return { ok: true };
}

/**
 * Rename a section. Sections are a real entity now, so this is a single-row
 * update of the section row's name; member categories reference it by
 * section_id, and readers join the entity. Signature is kept so existing
 * callers (the budget table) keep working — the row is looked up by
 * (project_id, old_name).
 *
 * Idempotent on no-op (old === new) and on a section that doesn't exist yet.
 */
export async function renameSectionAction(input: {
  project_id: string;
  old_name: string;
  new_name: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const oldName = input.old_name.trim();
  const newName = input.new_name.trim();
  if (!oldName) return { ok: false, error: 'Missing existing section name.' };
  if (!newName) return { ok: false, error: 'Section name cannot be empty.' };
  if (newName.length > 80) return { ok: false, error: 'Section name too long.' };
  if (oldName === newName) return { ok: true };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from('project_budget_sections')
    .select('id')
    .eq('project_id', input.project_id)
    .eq('name', oldName)
    .maybeSingle();

  if (!row) return { ok: true }; // section doesn't exist (yet) — nothing to rename

  const { error } = await supabase
    .from('project_budget_sections')
    .update({ name: newName, updated_at: new Date().toISOString() })
    .eq('id', (row as { id: string }).id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${input.project_id}`);
  return { ok: true };
}

/**
 * Bulk reorder + cross-section move for categories on a project. The client
 * sends the new ordered list of (id, section-name) tuples.
 *
 * Section ordering now lives on project_budget_sections.sort_order; category
 * ordering stays display_order. So this:
 *   - resolves each section name to its section row id (creating it if the
 *     drag introduced a brand-new section name — defensive; the UI uses
 *     existing names),
 *   - sets each category's section_id to the target section (drag-between-
 *     sections), and
 *   - writes display_order via the `section_idx * 1000 + within` scheme so
 *     within-section order survives. Section_idx here is the order the
 *     sections first appear in the dragged list, which mirrors their
 *     sort_order on screen.
 */
export async function reorderBudgetCategoriesAction(input: {
  project_id: string;
  ordered: { id: string; section: string }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in or missing tenant.' };
  const supabase = await createClient();

  const sectionsInOrder: string[] = [];
  for (const row of input.ordered) {
    const s = row.section.trim();
    if (!s) return { ok: false, error: 'Section cannot be empty.' };
    if (!sectionsInOrder.includes(s)) sectionsInOrder.push(s);
  }

  // Resolve each distinct section name to its row id once.
  const sectionIdByName = new Map<string, string>();
  for (const name of sectionsInOrder) {
    const resolved = await resolveSectionId(supabase, tenant.id, input.project_id, name);
    if ('error' in resolved) return { ok: false, error: resolved.error };
    sectionIdByName.set(name, resolved.id);
  }

  const withinCounters = new Map<string, number>();
  const updates: { id: string; section_id: string; display_order: number }[] = [];
  for (const row of input.ordered) {
    const s = row.section.trim();
    const sectionIdx = sectionsInOrder.indexOf(s);
    const within = withinCounters.get(s) ?? 0;
    withinCounters.set(s, within + 1);
    updates.push({
      id: row.id,
      // biome-ignore lint/style/noNonNullAssertion: every name is resolved above
      section_id: sectionIdByName.get(s)!,
      display_order: sectionIdx * 1000 + within,
    });
  }

  const now = new Date().toISOString();
  for (const u of updates) {
    // Set section_id; display_order keeps within-section ordering.
    const { error } = await supabase
      .from('project_budget_categories')
      .update({ section_id: u.section_id, display_order: u.display_order, updated_at: now })
      .eq('id', u.id)
      .eq('project_id', input.project_id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/projects/${input.project_id}`);
  return { ok: true };
}

export async function removeBudgetCategoryAction(input: {
  id: string;
  project_id: string;
}): Promise<BudgetCategoryActionResult> {
  const supabase = await createClient();

  // Check for linked time entries or expenses
  const { count: timeCount } = await supabase
    .from('time_entries')
    .select('id', { count: 'exact', head: true })
    .eq('budget_category_id', input.id);

  const { count: expenseCount } = await supabase
    .from('project_costs')
    .select('id', { count: 'exact', head: true })
    .eq('budget_category_id', input.id)
    .eq('status', 'active');

  if ((timeCount ?? 0) > 0 || (expenseCount ?? 0) > 0) {
    return {
      ok: false,
      error:
        'Cannot remove category with linked time entries or project costs. Reassign them first.',
    };
  }

  // Delete the category's estimate lines first. The FK is ON DELETE SET NULL,
  // so without this the lines survive with budget_category_id = NULL and
  // resurface under the "Other work" header on the customer-facing estimate
  // (customer-view-line-items.ts) — i.e. deleted scope reappears on a sent
  // document. Removing the category must remove the scope it held.
  const { error: linesError } = await supabase
    .from('project_cost_lines')
    .delete()
    .eq('budget_category_id', input.id);

  if (linesError) {
    return { ok: false, error: linesError.message };
  }

  const { error } = await supabase.from('project_budget_categories').delete().eq('id', input.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/projects/${input.project_id}`);
  return { ok: true, id: input.id };
}

/**
 * Seed a project with default budget categories. Used when creating a project
 * from the AI or when manually resetting categories.
 */
export async function seedBudgetCategoriesFromTemplateAction(input: {
  project_id: string;
}): Promise<BudgetCategoryActionResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return { ok: false, error: 'Not signed in or missing tenant.' };
  }

  const INTERIOR = [
    'Demo',
    'Disposal',
    'Framing',
    'Plumbing',
    'Plumbing Fixtures',
    'HVAC',
    'Insulation',
    'Drywall',
    'Flooring',
    'Doors & Mouldings',
    'Windows & Doors',
    'Railings',
    'Electrical',
    'Painting',
    'Kitchen',
    'Contingency',
  ];
  const EXTERIOR = [
    'Demo',
    'Disposal',
    'Framing',
    'Siding',
    'Sheathing',
    'Painting',
    'Gutters',
    'Front Garden',
    'Front Door',
    'Rot Repair',
    'Garage Doors',
    'Contingency',
  ];

  const supabase = await createClient();

  // Resolve the two section rows up front and set section_id on each category.
  const interiorSection = await resolveBudgetSectionId(
    supabase,
    tenant.id,
    input.project_id,
    'interior',
  );
  if ('error' in interiorSection) return { ok: false, error: interiorSection.error };
  const exteriorSection = await resolveBudgetSectionId(
    supabase,
    tenant.id,
    input.project_id,
    'exterior',
  );
  if ('error' in exteriorSection) return { ok: false, error: exteriorSection.error };

  const rows = [
    ...INTERIOR.map((name, i) => ({
      project_id: input.project_id,
      tenant_id: tenant.id,
      name,
      section_id: interiorSection.id,
      display_order: i,
    })),
    ...EXTERIOR.map((name, i) => ({
      project_id: input.project_id,
      tenant_id: tenant.id,
      name,
      section_id: exteriorSection.id,
      display_order: INTERIOR.length + i,
    })),
  ];

  const { error } = await supabase.from('project_budget_categories').insert(rows);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/projects/${input.project_id}`);
  return { ok: true, id: input.project_id };
}
