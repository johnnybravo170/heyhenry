/**
 * `ar_sequences` / `ar_steps` — workflow definition and versioned steps.
 *
 * DDL source of truth: `supabase/migrations/0040_autoresponder.sql`.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from '../tenants';
import { arTemplates } from './templates';

export const arSequences = pgTable('ar_sequences', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('draft'), // draft | active | paused | archived
  version: integer('version').notNull().default(1),
  triggerType: text('trigger_type').notNull().default('manual'), // manual | tag_added | event | signup
  triggerConfig: jsonb('trigger_config').notNull().default(sql`'{}'::jsonb`),
  allowReenrollment: boolean('allow_reenrollment').notNull().default(false),
  emailQuietStart: smallint('email_quiet_start'),
  emailQuietEnd: smallint('email_quiet_end'),
  smsQuietStart: smallint('sms_quiet_start'),
  smsQuietEnd: smallint('sms_quiet_end'),
  emailDaysOfWeek: smallint('email_days_of_week').array(),
  smsDaysOfWeek: smallint('sms_days_of_week').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const arSteps = pgTable(
  'ar_steps',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    sequenceId: uuid('sequence_id')
      .notNull()
      .references(() => arSequences.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    position: integer('position').notNull(),
    type: text('type').notNull(), // email | sms | wait | branch | tag | exit
    delayMinutes: integer('delay_minutes').notNull().default(0),
    templateId: uuid('template_id').references(() => arTemplates.id, { onDelete: 'restrict' }),
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [unique().on(table.sequenceId, table.version, table.position)],
);

export type ArSequence = typeof arSequences.$inferSelect;
export type NewArSequence = typeof arSequences.$inferInsert;
export type ArStep = typeof arSteps.$inferSelect;
export type NewArStep = typeof arSteps.$inferInsert;
