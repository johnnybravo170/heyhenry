/**
 * `ar_templates` — reusable email/SMS content with Handlebars-style merge tags.
 *
 * DDL source of truth: `supabase/migrations/0040_autoresponder.sql`.
 */

import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from '../tenants';

export const arTemplates = pgTable('ar_templates', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  channel: text('channel').notNull(), // 'email' | 'sms'
  subject: text('subject'),
  bodyHtml: text('body_html'),
  bodyText: text('body_text'),
  fromName: text('from_name'),
  fromEmail: text('from_email'),
  replyTo: text('reply_to'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type ArTemplate = typeof arTemplates.$inferSelect;
export type NewArTemplate = typeof arTemplates.$inferInsert;
