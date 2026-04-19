/**
 * `ar_contacts` / `ar_contact_tags` — AR subscriber records.
 *
 * DDL source of truth: `supabase/migrations/0040_autoresponder.sql`.
 */

import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from '../tenants';

export const arContacts = pgTable('ar_contacts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  email: text('email'),
  phone: text('phone'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  timezone: text('timezone').notNull().default('America/Vancouver'),
  locale: text('locale').notNull().default('en'),
  source: text('source'),
  attributes: jsonb('attributes').notNull().default(sql`'{}'::jsonb`),
  emailSubscribed: boolean('email_subscribed').notNull().default(true),
  smsSubscribed: boolean('sms_subscribed').notNull().default(true),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const arContactTags = pgTable(
  'ar_contact_tags',
  {
    contactId: uuid('contact_id')
      .notNull()
      .references(() => arContacts.id, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
    taggedAt: timestamp('tagged_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [primaryKey({ columns: [table.contactId, table.tag] })],
);

export type ArContact = typeof arContacts.$inferSelect;
export type NewArContact = typeof arContacts.$inferInsert;
export type ArContactTag = typeof arContactTags.$inferSelect;
