-- Perf: drop 7 redundant duplicate indexes. Each of these plain indexes sits on
-- the EXACT same column list as an existing UNIQUE-constraint index on the same
-- table, so it serves zero reads the unique index doesn't already serve — it only
-- adds per-insert/update write-amplification. Safe to drop at any scale; the
-- UNIQUE index (…_key) stays and continues to back both uniqueness and lookups.
--
-- Confirmed via pg_index (same indrelid + identical indkey, partial-predicate-free).
-- The kept UNIQUE index is named in each comment.

DROP INDEX IF EXISTS public.ar_steps_seq_idx;                          -- keep ar_steps_sequence_id_version_position_key
DROP INDEX IF EXISTS public.idx_change_orders_approval_code;           -- keep change_orders_approval_code_key
DROP INDEX IF EXISTS public.idx_pss_project_version;                   -- keep pss_unique_version
DROP INDEX IF EXISTS public.idx_referral_codes_code;                   -- keep referral_codes_code_key
DROP INDEX IF EXISTS public.idx_widget_configs_token;                  -- keep widget_configs_token_key
DROP INDEX IF EXISTS public.worker_invites_code_idx;                   -- keep worker_invites_code_key
DROP INDEX IF EXISTS public.idx_worker_unavailability_worker_date;     -- keep worker_unavailability_worker_profile_id_unavailable_date_key
