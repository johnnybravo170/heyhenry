/**
 * Integration test for the `tenants` table via the Drizzle client.
 *
 * Uses a direct Postgres connection (DATABASE_URL) which means it bypasses
 * RLS — we're exercising the schema + Drizzle mapping, not the security layer.
 * RLS tests live separately in supabase/tests/ (pgTAP) — see Task 1.5.
 *
 * TODO: Jonathan, fill in DATABASE_URL in .env.local once the Supabase DB
 * password is retrieved. Until then this test is skipped. In CI we will wire
 * DATABASE_URL via a repo secret.
 */

import { eq } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, tenants } from '@/lib/db/client';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('tenants table (integration)', () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    if (!hasDb || createdIds.length === 0) return;
    const db = getDb();
    for (const id of createdIds) {
      await db.delete(tenants).where(eq(tenants.id, id));
    }
    createdIds.length = 0;
  });

  afterAll(async () => {
    await closeDb();
  });

  it('inserts and reads back a tenant with defaults', async () => {
    const db = getDb();

    const [inserted] = await db
      .insert(tenants)
      .values({
        name: 'Integration Test Co',
        slug: `itest-${Date.now()}`,
        province: 'BC',
      })
      .returning();

    expect(inserted).toBeDefined();
    expect(inserted.id).toMatch(/^[0-9a-f-]{36}$/);
    createdIds.push(inserted.id);

    const rows = await db.select().from(tenants).where(eq(tenants.id, inserted.id));
    expect(rows).toHaveLength(1);

    const row = rows[0];
    expect(row.name).toBe('Integration Test Co');
    expect(row.province).toBe('BC');
    expect(row.currency).toBe('CAD');
    expect(row.timezone).toBe('America/Vancouver');
    // numeric() comes back as a string in postgres-js. Compare loosely.
    expect(Number(row.gstRate)).toBeCloseTo(0.05);
    expect(Number(row.pstRate)).toBeCloseTo(0);
    expect(row.deletedAt).toBeNull();
    expect(row.createdAt).toBeInstanceOf(Date);
  });
});
