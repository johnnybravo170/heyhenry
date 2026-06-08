-- 20260524015042_home_record_henry_summary.sql
--
-- Home Record closeout summary — the one new Henry touchpoint on the
-- handoff. Henry drafts a warm one-paragraph project summary from the
-- snapshot; the operator edits + approves it before it becomes part of
-- the record. The approved prose renders at the top of the public
-- artifact (as plain prose — Henry is invisible client-side).
--
-- Two columns, ADDITIVE + NON-DESTRUCTIVE:
--   henry_summary           the operator-approved prose (NULL = none kept yet)
--   henry_summary_approved  TRUE once the operator clicks "Keep"
--
-- Why on the row (not only in the snapshot JSONB): regenerating the
-- snapshot upserts in place and rebuilds the JSONB from live tables —
-- which would otherwise blow away the operator's edited summary. The
-- row columns survive a regenerate, so generateHomeRecordAction copies
-- the approved summary back into the fresh snapshot. The snapshot field
-- (HomeRecordSnapshotV1.summary) is what the public page reads — it's
-- frozen + client-safe by construction; the row columns are the durable
-- store the operator edits against.
--
-- No RLS change: the existing home_records policies already gate reads
-- (operator: tenant-scoped; public: by-slug via the admin client on the
-- server-only route). These columns ride along under the same policies.

ALTER TABLE public.home_records
  ADD COLUMN IF NOT EXISTS henry_summary           TEXT,
  ADD COLUMN IF NOT EXISTS henry_summary_approved  BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.home_records.henry_summary IS
  'Operator-approved Henry closeout-summary prose. Copied into the snapshot JSONB on generate so it freezes with the record and survives regeneration.';
COMMENT ON COLUMN public.home_records.henry_summary_approved IS
  'TRUE once the operator approves ("Keep") the Henry draft. Only an approved summary enters the public artifact.';
