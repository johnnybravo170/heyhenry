/**
 * `user_recovery_codes` — single-use backup codes for MFA.
 *
 * Supabase stores TOTP factors in `auth.mfa_factors` but does not issue
 * recovery codes. We generate 10 codes at enrollment, store only sha256
 * hashes here, and mark them `consumed_at` on use.
 *
 * RLS: enabled with no policies. All reads/writes go through the admin
 * (service-role) client in server actions. See migration
 * `0085_user_recovery_codes.sql`.
 */

import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const userRecoveryCodes = pgTable(
  'user_recovery_codes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').notNull(),
    codeHash: text('code_hash').notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
  },
  (table) => [index('user_recovery_codes_user_id_idx').on(table.userId)],
);

export type UserRecoveryCode = typeof userRecoveryCodes.$inferSelect;
export type NewUserRecoveryCode = typeof userRecoveryCodes.$inferInsert;
