-- 20260529165719_ops_activate_scout_policy.sql
-- Producer-learner Phase 2a — the scout-policy activation transition.
--
-- Activating a proposed policy version is a TWO-row mutation with an invariant:
-- supersede the scout's current active row, then flip the target to active —
-- and ops_scout_policy_one_active_per_slug forbids two active rows for one
-- scout. Done in app code as two sequential UPDATEs, a crash between them
-- leaves the scout with ZERO active policies (its run-start read returns null
-- and it silently drops to baseline). A function is atomic: it can't half-apply.
--
-- This is the correct mutation path; the partial unique index is the backstop.
--
-- Ordering matters and is enforced here: supersede the old active FIRST (now
-- zero active), THEN activate the target (now exactly one). The reverse order
-- would trip the unique index mid-transaction.
--
-- SECURITY INVOKER (default): called via service_role through PostgREST rpc,
-- which bypasses RLS — no SECURITY DEFINER needed. Only service_role may
-- EXECUTE (the app's activateScoutPolicyAction enforces requireAdmin on top).

CREATE OR REPLACE FUNCTION ops.activate_scout_policy(
  p_policy_id uuid,
  p_admin_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_slug   text;
  v_status text;
  v_row    ops.scout_policy;
BEGIN
  -- Lock the target row + resolve its scout.
  SELECT scout_slug, status INTO v_slug, v_status
  FROM ops.scout_policy
  WHERE id = p_policy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'scout_policy % not found', p_policy_id USING ERRCODE = 'no_data_found';
  END IF;

  -- Idempotent: already active → return as-is.
  IF v_status = 'active' THEN
    SELECT * INTO v_row FROM ops.scout_policy WHERE id = p_policy_id;
    RETURN to_jsonb(v_row);
  END IF;

  -- proposed (normal) or superseded (manual rollback to a prior version) are
  -- the only legal sources. A 'rejected' version is terminal — propose anew.
  IF v_status NOT IN ('proposed', 'superseded') THEN
    RAISE EXCEPTION 'cannot activate scout_policy % from status % (expected proposed or superseded)',
      p_policy_id, v_status USING ERRCODE = 'check_violation';
  END IF;

  -- Supersede the scout's current active version FIRST so the partial-unique-
  -- active index is never violated mid-transaction.
  UPDATE ops.scout_policy
  SET status = 'superseded', superseded_at = now(), updated_at = now()
  WHERE scout_slug = v_slug AND status = 'active';

  -- Activate the target.
  UPDATE ops.scout_policy
  SET status = 'active',
      activated_at = now(),
      activated_by = p_admin_user_id,
      updated_at = now()
  WHERE id = p_policy_id
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END
$$;

REVOKE ALL ON FUNCTION ops.activate_scout_policy(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ops.activate_scout_policy(uuid, uuid) TO service_role;

COMMENT ON FUNCTION ops.activate_scout_policy(uuid, uuid) IS
  'Atomically activate a proposed (or superseded) scout_policy version: supersede the scout''s current active row, then flip the target to active. Preserves the one-active-per-scout invariant (ops_scout_policy_one_active_per_slug). Idempotent on an already-active row. Backs activateScoutPolicyAction.';
