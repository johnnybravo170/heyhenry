/**
 * Tenant prefs — namespaced JSONB storage for correction learning.
 *
 * Every AI-adjacent module has a namespace it reads on inference and writes
 * to when the user overrides Henry. Pattern keeps personalization simple:
 * the pref shape is owned by the module, this file is just storage.
 *
 * Known namespaces so far:
 *   - photos: { tagVocabulary?, captionStyle?, silentApplyThreshold? }
 *   - email_voice (future)
 *   - social (future)
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type PrefsNamespace = 'photos' | 'email_voice' | 'social' | 'invoicing';

export async function getPrefs<T extends Record<string, unknown> = Record<string, unknown>>(
  tenantId: string,
  namespace: PrefsNamespace,
): Promise<T> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('tenant_prefs')
    .select('data')
    .eq('tenant_id', tenantId)
    .eq('namespace', namespace)
    .maybeSingle();
  if (error) {
    throw new Error(`getPrefs(${namespace}): ${error.message}`);
  }
  return ((data?.data ?? {}) as T) || ({} as T);
}

/**
 * Merge-patch prefs. Deep-merges `patch` into the existing data (one level);
 * keys set to null in `patch` are deleted.
 */
export async function updatePrefs(
  tenantId: string,
  namespace: PrefsNamespace,
  patch: Record<string, unknown>,
): Promise<void> {
  const admin = createAdminClient();
  const current = await getPrefs(tenantId, namespace);
  const next: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete next[k];
    else next[k] = v;
  }
  const { error } = await admin.from('tenant_prefs').upsert(
    {
      tenant_id: tenantId,
      namespace,
      data: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,namespace' },
  );
  if (error) {
    throw new Error(`updatePrefs(${namespace}): ${error.message}`);
  }
}
