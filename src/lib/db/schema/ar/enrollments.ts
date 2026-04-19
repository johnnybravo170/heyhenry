/**
 * `ar_enrollments` — contact x sequence x version. Drives the cron worker.
 *
 * DDL source of truth: `supabase/migrations/0040_autoresponder.sql`.
 */

import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { arContacts } from './contacts';
import { arSequences } from './sequences';

export const arEnrollments = pgTable('ar_enrollments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  contactId: uuid('contact_id')
    .notNull()
    .references(() => arContacts.id, { onDelete: 'cascade' }),
  sequenceId: uuid('sequence_id')
    .notNull()
    .references(() => arSequences.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  status: text('status').notNull().default('active'), // active | completed | cancelled | errored
  currentPosition: integer('current_position').notNull().default(0),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull().default(sql`now()`),
  lastError: text('last_error'),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().default(sql`now()`),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
});

export type ArEnrollment = typeof arEnrollments.$inferSelect;
export type NewArEnrollment = typeof arEnrollments.$inferInsert;
