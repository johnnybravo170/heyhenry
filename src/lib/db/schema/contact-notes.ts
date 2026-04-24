/**
 * `contact_notes` — threaded notes feed per contact.
 *
 * Replaces the single-field `customers.notes` text blob. Every note is
 * authored (by the operator, a worker, Henry, the customer, or the
 * system during migration/automation) and timestamped. The app writes
 * here; the legacy `customers.notes` column is read-compatibility only
 * and will be dropped by a follow-up migration.
 *
 * DDL source of truth: `supabase/migrations/0111_contacts_kind_and_notes.sql`.
 */

import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { customers } from './customers';
import { tenants } from './tenants';

export const contactNotes = pgTable(
  'contact_notes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    authorType: text('author_type').notNull(),
    /** tenant_members.id when authorType='operator'; null otherwise. */
    authorId: uuid('author_id'),
    body: text('body').notNull(),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`now()`).notNull(),
  },
  (table) => [
    check(
      'contact_notes_author_type_check',
      sql`${table.authorType} IN ('operator', 'worker', 'henry', 'customer', 'system')`,
    ),
    index('idx_contact_notes_contact').on(table.contactId, table.createdAt),
    index('idx_contact_notes_tenant').on(table.tenantId),
  ],
);

export type ContactNote = typeof contactNotes.$inferSelect;
export type NewContactNote = typeof contactNotes.$inferInsert;
