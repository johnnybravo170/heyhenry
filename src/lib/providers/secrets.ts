/**
 * Secret resolver.
 *
 * Reads from `provider_credentials` first, falls back to environment
 * variables. Env fallback exists so local dev / staging can keep working
 * without pre-seeding the DB, and so migration is reversible.
 *
 * Env var naming: `{PROVIDER}_{KEY_NAME}` uppercased, dots/dashes to
 * underscores. Example: provider='stripe', key='secret_key' -> STRIPE_SECRET_KEY.
 * Region is not part of env var names today (single region); when a second
 * region lands, env names become `{PROVIDER}_{REGION}_{KEY_NAME}` and the
 * resolver widens to check both.
 */

import { createAdminClient } from '@/lib/supabase/admin';

const inMemoryCache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

function cacheKey(region: string, provider: string, keyName: string): string {
  return `${region}/${provider}/${keyName}`;
}

function envVarName(provider: string, keyName: string): string {
  return `${provider}_${keyName}`.toUpperCase().replace(/[.-]/g, '_');
}

export async function getProviderSecret(
  region: string,
  provider: string,
  keyName: string,
): Promise<string> {
  const key = cacheKey(region, provider, keyName);
  const cached = inMemoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('provider_credentials')
    .select('value')
    .eq('region', region)
    .eq('provider', provider)
    .eq('key_name', keyName)
    .maybeSingle();

  let value: string | undefined;
  if (!error && data?.value) {
    value = data.value;
  } else {
    value = process.env[envVarName(provider, keyName)];
  }

  if (!value) {
    throw new Error(
      `Missing provider credential: region=${region} provider=${provider} key=${keyName}`,
    );
  }

  inMemoryCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
