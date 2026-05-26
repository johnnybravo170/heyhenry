/**
 * `agreement_acceptances` — append-only ledger of signed agreement
 * acceptances (typed-name e-signature + IP + UA), one row per
 * (tenant, agreement_type, version) event.
 *
 * Generic by design: founding_member today, base ToS / Privacy / DPA later —
 * same table, no per-document columns. Distinct from the lightweight clickwrap
 * booleans on `tenant_members` (tos_version/tos_accepted_at).
 *
 * DDL lives in `supabase/migrations/20260526163958_agreement_acceptances.sql`
 * — keep the two in sync by hand.
 */

import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const agreementAcceptances = pgTable('agreement_acceptances', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull(),
  userId: uuid('user_id').notNull(),
  agreementType: text('agreement_type').notNull(),
  agreementVersion: text('agreement_version').notNull(),
  signatureName: text('signature_name').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).default(sql`now()`).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
});

export type AgreementAcceptance = typeof agreementAcceptances.$inferSelect;
export type NewAgreementAcceptance = typeof agreementAcceptances.$inferInsert;
