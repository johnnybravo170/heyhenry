-- 0120_henry_suggestion_notifications.sql
-- Extend the notifications.kind check to allow 'henry_suggestion' rows.
-- Henry's AI trigger layer (src/server/ai/triggers.ts) writes these
-- when a quote is approved, a change order is approved, a photo is
-- uploaded against a task that needs verification, a lead has gone
-- silent, etc. The owner sees them in the morning briefing and on
-- the next chat turn.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_kind_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_kind_check
    CHECK (kind IN (
      'task_assigned',
      'task_done',
      'task_blocked',
      'task_help',
      'task_verified',
      'task_rejected',
      'henry_suggestion'
    ));
