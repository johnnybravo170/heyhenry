/**
 * `ar_send_log` — every send attempt + engagement tracking.
 * `ar_events` — event bus for trigger-based enrollment.
 * `ar_suppression_list` — global unsubscribes / hard bounces.
 *
 * DDL source of truth: `supabase/migrations/0040_autoresponder.sql`.
 */

import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from '../tenants';
import { arContacts } from './contacts';
import { arEnrollments } from './enrollments';
import { arSteps } from './sequences';

export const arSendLog = pgTable('ar_send_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id')
    .notNull()
    .references(() => arContacts.id, { onDelete: 'cascade' }),
  enrollmentId: uuid('enrollment_id').references(() => arEnrollments.id, { onDelete: 'set null' }),
  stepId: uuid('step_id').references(() => arSteps.id, { onDelete: 'set null' }),
  broadcastId: uuid('broadcast_id'),
  channel: text('channel').notNull(), // email | sms
  toAddress: text('to_address').notNull(),
  subject: text('subject'),
  providerId: text('provider_id'),
  status: text('status').notNull().default('queued'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  clickedAt: timestamp('clicked_at', { withTimezone: true }),
  bouncedAt: timestamp('bounced_at', { withTimezone: true }),
  complainedAt: timestamp('complained_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const arEvents = pgTable('ar_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => arContacts.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});

export const arSuppressionList = pgTable('ar_suppression_list', {
  address: text('address').primaryKey(),
  channel: text('channel').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  notes: text('notes'),
});

export type ArSendLog = typeof arSendLog.$inferSelect;
export type NewArSendLog = typeof arSendLog.$inferInsert;
export type ArEvent = typeof arEvents.$inferSelect;
export type NewArEvent = typeof arEvents.$inferInsert;
export type ArSuppression = typeof arSuppressionList.$inferSelect;
