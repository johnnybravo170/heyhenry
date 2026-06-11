/**
 * Tenant-memory query layer — Cascading Preferences substrate.
 *
 * Generic key/value store for tenant-level preferences. Document-label
 * overrides are the first consumer. See kanban card 168b30c0.
 *
 * Slot registry (DOCUMENT_LABEL_SLOTS) is the source of truth for
 * valid label keys + defaults — provides compile-time typo safety and
 * server-side validation without a DB enum migration for each new slot.
 */

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Slot registry — label namespace
// ---------------------------------------------------------------------------

export const DOCUMENT_LABEL_SLOTS = {
  'invoice.total': { default: 'Total', label: 'Invoice total line' },
  'estimate.total': { default: 'Total', label: 'Estimate total line' },
} as const;

export type DocumentLabelSlot = keyof typeof DOCUMENT_LABEL_SLOTS;

export const DOCUMENT_LABEL_MAX_LENGTH = 40;

// ---------------------------------------------------------------------------
// Row type
// ---------------------------------------------------------------------------

export type TenantMemoryRow = {
  id: string;
  tenant_id: string;
  key: string;
  value: unknown; // jsonb
  kind: 'preference' | 'voice' | 'rule' | 'observation';
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/** Batch-load all keys matching an optional prefix for a given tenant. */
async function listTenantMemoryUncached(
  tenantId: string,
  prefix?: string,
): Promise<TenantMemoryRow[]> {
  const admin = createAdminClient();
  let query = admin.from('tenant_memory').select('*').eq('tenant_id', tenantId);
  if (prefix) query = query.like('key', `${prefix}%`);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list tenant_memory: ${error.message}`);
  return (data ?? []) as TenantMemoryRow[];
}

export const listTenantMemory = cache(listTenantMemoryUncached);

/** Build a label-key → string map from a batch-loaded row set. */
export function buildLabelMap(rows: TenantMemoryRow[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (typeof row.value === 'string' && row.value.length > 0) {
      map[row.key] = row.value;
    } else if (
      row.value !== null &&
      typeof row.value === 'object' &&
      !Array.isArray(row.value) &&
      typeof (row.value as Record<string, unknown>).v === 'string'
    ) {
      // Future-proof: support {v: "..."} jsonb wrapper if ever stored that way.
      const v = (row.value as Record<string, unknown>).v as string;
      if (v.length > 0) map[row.key] = v;
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Resolver — pure, no DB call; caller batch-loads and passes the map
// ---------------------------------------------------------------------------

/**
 * Resolve a document label from the batch-loaded label map.
 * Falls back to the slot default when the tenant has no override.
 *
 * Signature carries a projectOverride slot so per-project UI can land later
 * without rework. V1 always passes undefined for projectOverride.
 */
export function resolveDocumentLabel(
  slot: DocumentLabelSlot,
  labelMap: Record<string, string>,
  projectOverride?: string,
): string {
  return projectOverride ?? labelMap[`label.${slot}`] ?? DOCUMENT_LABEL_SLOTS[slot].default;
}

// ---------------------------------------------------------------------------
// Write helpers (admin-client; callers must have already verified auth)
// ---------------------------------------------------------------------------

/**
 * Upsert a tenant-memory value.
 *
 * Empty string → DELETE (absence-of-row is the only "unset" state so
 * the `?? default` resolver chain stays correct).
 */
export async function setTenantMemory(
  tenantId: string,
  key: string,
  value: string,
  opts?: { kind?: TenantMemoryRow['kind']; updatedBy?: string },
): Promise<void> {
  const admin = createAdminClient();
  const trimmed = value.trim();

  if (trimmed === '') {
    // Delete = tenant is clearing the override; resolver returns default.
    await admin.from('tenant_memory').delete().eq('tenant_id', tenantId).eq('key', key);
    return;
  }

  const { error } = await admin.from('tenant_memory').upsert(
    {
      tenant_id: tenantId,
      key,
      value: trimmed, // stored as jsonb; Supabase accepts a plain string
      kind: opts?.kind ?? 'preference',
      updated_by: opts?.updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,key' },
  );

  if (error) throw new Error(`Failed to set tenant_memory[${key}]: ${error.message}`);
}
