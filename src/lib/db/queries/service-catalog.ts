/**
 * Service catalog queries for the quoting engine.
 *
 * The service_catalog table stores per-tenant surface types and pricing.
 * RLS handles tenant scoping.
 */

import { createClient } from '@/lib/supabase/server';

export type CatalogEntryRow = {
  id: string;
  tenant_id: string;
  surface_type: string;
  label: string;
  price_per_sqft_cents: number;
  min_charge_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const CATALOG_COLUMNS =
  'id, tenant_id, surface_type, label, price_per_sqft_cents, min_charge_cents, is_active, created_at, updated_at';

export async function listCatalogEntries(is_activeOnly = true): Promise<CatalogEntryRow[]> {
  const supabase = await createClient();
  let query = supabase.from('service_catalog').select(CATALOG_COLUMNS);

  if (is_activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.order('label', { ascending: true });

  if (error) {
    throw new Error(`Failed to list catalog entries: ${error.message}`);
  }
  return (data ?? []) as CatalogEntryRow[];
}

export async function getCatalogEntry(id: string): Promise<CatalogEntryRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_catalog')
    .select(CATALOG_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to load catalog entry: ${error.message}`);
  }
  return (data as CatalogEntryRow | null) ?? null;
}
