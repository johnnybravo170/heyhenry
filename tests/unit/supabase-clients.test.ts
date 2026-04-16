import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Sanity test: the Supabase client modules import cleanly and each factory
 * returns a client instance when env vars are set. This is a smoke test
 * only — it doesn't exercise any network calls.
 */

describe('supabase clients', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://yaknrsbzdbayzyfjjdtb.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_test_key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_test_key');
  });

  it('browser client imports and builds', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const client = createClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it('admin client imports and builds', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const client = createAdminClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it('server client module imports', async () => {
    // The server client uses next/headers which is not available in jsdom,
    // so we only verify the module imports and exports the factory. Full
    // integration happens in Playwright E2E.
    const mod = await import('@/lib/supabase/server');
    expect(typeof mod.createClient).toBe('function');
  });
});
