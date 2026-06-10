/**
 * Service-role endpoint for importing fully-budgeted projects from structured
 * JSON. Designed for Claude (laptop) to seed projects parsed from PDFs or
 * spreadsheets without going through the intake draft pipeline.
 *
 * Auth: Bearer token via HEYHENRY_IMPORT_TOKEN env var (1Password: api-key-heyhenry-import).
 * All writes use the service-role admin client — no user session required, RLS bypassed.
 *
 * Calls applyScopeToProject directly, the same primitive as intake + AI scaffold.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { applyScopeToProject } from '@/lib/db/queries/project-budget-categories';
import { isValidImportToken } from '@/lib/import/auth';
import { FORBIDDEN_LINE_LABEL } from '@/lib/import/helpers';
import { normalizePhone } from '@/lib/phone';
import { createAdminClient } from '@/lib/supabase/admin';

const LineSchema = z.object({
  label: z.string().min(1),
  estimated_amount_cents: z.number().int().min(0),
});

const CategorySchema = z.object({
  name: z.string().min(1),
  lines: z.array(LineSchema).optional().default([]),
});

const SectionSchema = z.object({
  name: z.string().min(1),
  categories: z.array(CategorySchema),
});

const ImportProjectSchema = z.object({
  tenant_id: z.string().uuid(),
  contact: z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    kind: z.enum(['customer', 'lead']).default('customer'),
    type: z.enum(['residential', 'commercial']).optional(),
    address_line1: z.string().optional(),
  }),
  project: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    lifecycle_stage: z
      .enum(['planning', 'in_progress', 'complete', 'cancelled'])
      .default('planning'),
    is_cost_plus: z.boolean().default(false),
    management_fee_rate: z.number().min(0).max(1).optional(),
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    site_address_line1: z.string().optional(),
    site_city: z.string().optional(),
    site_postal: z.string().optional(),
  }),
  budget: z
    .object({
      sections: z.array(SectionSchema).optional().default([]),
    })
    .optional(),
  options: z
    .object({
      skip_dedup: z.boolean().default(false),
      dry_run: z.boolean().default(false),
    })
    .optional(),
});

type ImportProjectInput = z.infer<typeof ImportProjectSchema>;

/** Dedup check scoped to tenant using the admin client. */
async function findExistingContact(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  contact: ImportProjectInput['contact'],
): Promise<{ id: string; name: string } | null> {
  const phone = normalizePhone(contact.phone);
  const email = contact.email?.trim().toLowerCase() || null;
  const name = contact.name.trim().toLowerCase();

  // Phone match (last-7 digits, scoped to tenant)
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    const last7 = digits.slice(-7);
    const { data } = await admin
      .from('contacts')
      .select('id, name, phone')
      .eq('tenant_id', tenantId)
      .ilike('phone', `%${last7}%`)
      .is('deleted_at', null)
      .limit(5);
    const hit = (data ?? []).find((r) => {
      const rowDigits = (r.phone ?? '').replace(/\D/g, '');
      return rowDigits.slice(-7) === last7;
    });
    if (hit) return { id: hit.id, name: hit.name };
  }

  // Email match (exact, case-insensitive)
  if (email) {
    const { data } = await admin
      .from('contacts')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (data) return { id: data.id, name: data.name };
  }

  // Name match (exact, case-insensitive)
  const { data } = await admin
    .from('contacts')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .ilike('name', name)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (data) return { id: data.id, name: data.name };

  return null;
}

export async function POST(req: NextRequest) {
  if (!isValidImportToken(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = ImportProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation', issues: parsed.error.issues }, { status: 422 });
  }

  const body = parsed.data;

  // Reject lines that belong as project settings, not line items.
  for (const section of body.budget?.sections ?? []) {
    for (const cat of section.categories) {
      for (const line of cat.lines) {
        if (FORBIDDEN_LINE_LABEL.test(line.label)) {
          return NextResponse.json(
            {
              error: 'validation',
              issues: [
                {
                  message: `Line label "${line.label}" looks like a tax or fee total — set it as a project option (management_fee_rate) instead.`,
                  path: ['budget', 'sections', section.name, cat.name, line.label],
                },
              ],
            },
            { status: 422 },
          );
        }
      }
    }
  }

  if (body.options?.dry_run) {
    return NextResponse.json({ ok: true, dry_run: true, parsed: body });
  }

  const admin = createAdminClient();

  // 1. Contact — dedup then create
  let contactId: string;

  if (!body.options?.skip_dedup) {
    const existing = await findExistingContact(admin, body.tenant_id, body.contact);
    if (existing) {
      return NextResponse.json(
        {
          error: 'contact_exists',
          contact_id: existing.id,
          contact_name: existing.name,
          hint: 'Pass options.skip_dedup=true to create a new contact anyway.',
        },
        { status: 409 },
      );
    }
  }

  const phone = normalizePhone(body.contact.phone) ?? body.contact.phone?.trim() ?? null;

  const { data: newContact, error: contactErr } = await admin
    .from('contacts')
    .insert({
      tenant_id: body.tenant_id,
      kind: body.contact.kind,
      type: body.contact.type ?? 'residential',
      name: body.contact.name.trim(),
      email: body.contact.email?.trim().toLowerCase() || null,
      phone,
      address_line1: body.contact.address_line1?.trim() || null,
    })
    .select('id')
    .single();

  if (contactErr || !newContact) {
    return NextResponse.json(
      { error: 'contact_create_failed', detail: contactErr?.message },
      { status: 500 },
    );
  }
  contactId = newContact.id;

  // 2. Project
  const projectName = body.project.name.trim();
  const { data: project, error: projectErr } = await admin
    .from('projects')
    .insert({
      tenant_id: body.tenant_id,
      contact_id: contactId,
      name: projectName,
      description: body.project.description?.trim() || null,
      lifecycle_stage: body.project.lifecycle_stage,
      is_cost_plus: body.project.is_cost_plus,
      management_fee_rate: body.project.management_fee_rate ?? null,
      start_date: body.project.start_date ?? null,
      target_end_date: body.project.end_date ?? null,
      site_address_line1: body.project.site_address_line1?.trim() || null,
      site_city: body.project.site_city?.trim() || null,
      site_postal: body.project.site_postal?.trim() || null,
      intake_source: 'import',
      intake_signals: { importer: 'claude-laptop' },
    })
    .select('id')
    .single();

  if (projectErr || !project) {
    return NextResponse.json(
      { error: 'project_create_failed', detail: projectErr?.message },
      { status: 500 },
    );
  }

  // 3. Budget — sections → categories → cost lines via the shared primitive
  const sections = body.budget?.sections ?? [];
  if (sections.length > 0) {
    const categories = sections.flatMap((section) =>
      section.categories.map((cat) => ({
        name: cat.name,
        section: section.name,
        lines: cat.lines.map((line) => ({
          label: line.label,
          qty: 1,
          unit: 'lot',
          unit_price_cents: line.estimated_amount_cents,
        })),
      })),
    );

    const applied = await applyScopeToProject(admin, {
      tenantId: body.tenant_id,
      projectId: project.id,
      categories,
    });

    if (!applied.ok) {
      return NextResponse.json(
        { error: 'budget_apply_failed', detail: applied.error },
        { status: 500 },
      );
    }
  }

  // 4. Worklog
  await admin
    .from('worklog_entries')
    .insert({
      tenant_id: body.tenant_id,
      entry_type: 'system',
      title: 'Project imported',
      body: `Project "${projectName}" created via import (Claude laptop).`,
      related_type: 'project',
      related_id: project.id,
    })
    .then(() => {});

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.heyhenry.io').replace(/\/$/, '');

  return NextResponse.json({
    ok: true,
    project_id: project.id,
    contact_id: contactId,
    project_url: `${appUrl}/projects/${project.id}`,
  });
}
