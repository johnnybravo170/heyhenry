/**
 * Service layer for ops.scout_policy — the producer-learner policy substrate.
 *
 * The mutable rulebook each scout reads at run-start and the scout-learner
 * proposes updates to. Versioned, status-gated, audit-trailed. See migration
 * 20260529040000_ops_scout_policy.sql + the producer-learner Phase 0 doc in
 * the Ops vault.
 *
 * Identity is `scout_slug` matching `ops.ideas.actor_name` (e.g. 'business-scout') —
 * NOT the legacy tag identifier `getScoutReportCard` filters on. Standardize on
 * actor_name end-to-end.
 *
 * Surfaces exposed today:
 *   - getActiveScoutPolicy(scoutSlug)  — scout reads its active policy
 *   - getScoutPolicyHistory(scoutSlug) — audit view of all versions
 *   - proposeScoutPolicy(...)          — learner writes a new proposed version
 *
 * NOT exposed yet (deliberate, defer with scout-learner V1):
 *   - activation surface: flipping a proposed version to 'active' requires
 *     superseding the prior active in the same transaction. Admin server
 *     action (UI-driven) is the right home, not an MCP tool — Jonathan
 *     activates, agents propose. Until that surface lands, activation
 *     happens by direct SQL: see PHASE-1 notes in the migration.
 */

import { createServiceClient } from '@/lib/supabase';

export type ScoutPolicyStatus = 'proposed' | 'active' | 'superseded' | 'rejected';

export type ScoutPolicyRow = {
  id: string;
  scout_slug: string;
  version: number;
  status: ScoutPolicyStatus;
  policy: Record<string, unknown>;
  proposed_by: string;
  rationale: string | null;
  activated_by: string | null;
  activated_at: string | null;
  superseded_at: string | null;
  actor_type: 'human' | 'agent' | 'system';
  actor_name: string;
  created_at: string;
  updated_at: string;
};

/**
 * Read the currently-active policy for a scout. Returns null if no version
 * has been activated yet — the caller (a scout) should treat that as
 * "no learned policy yet; run the baseline prompt unchanged."
 *
 * Partial unique index `ops_scout_policy_one_active_per_slug` guarantees at
 * most one row matches.
 */
export async function getActiveScoutPolicy(scoutSlug: string): Promise<ScoutPolicyRow | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .schema('ops')
    .from('scout_policy')
    .select(
      'id, scout_slug, version, status, policy, proposed_by, rationale, activated_by, activated_at, superseded_at, actor_type, actor_name, created_at, updated_at',
    )
    .eq('scout_slug', scoutSlug)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(`getActiveScoutPolicy(${scoutSlug}) failed: ${error.message}`);
  return (data ?? null) as ScoutPolicyRow | null;
}

/**
 * Full version history for a scout. Most-recent first. Used by the admin
 * review surface (future) and by audit queries — "what rule was active
 * when ideas-X was filed?".
 */
export async function getScoutPolicyHistory(
  scoutSlug: string,
  limit = 50,
): Promise<ScoutPolicyRow[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .schema('ops')
    .from('scout_policy')
    .select(
      'id, scout_slug, version, status, policy, proposed_by, rationale, activated_by, activated_at, superseded_at, actor_type, actor_name, created_at, updated_at',
    )
    .eq('scout_slug', scoutSlug)
    .order('version', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getScoutPolicyHistory(${scoutSlug}) failed: ${error.message}`);
  return (data ?? []) as ScoutPolicyRow[];
}

const POLICY_COLS =
  'id, scout_slug, version, status, policy, proposed_by, rationale, activated_by, activated_at, superseded_at, actor_type, actor_name, created_at, updated_at';

export type ScoutPolicyReviewState = {
  /** status='proposed', oldest-first (drain in proposal order). */
  proposed: ScoutPolicyRow[];
  /** status='active', one per scout, keyed by scout_slug for side-by-side context. */
  activeBySlug: Record<string, ScoutPolicyRow>;
};

/**
 * Everything the /admin/scout-policy review page needs in one call: the
 * proposed versions awaiting a human call, plus the currently-active version
 * per scout so the reviewer can eyeball the change.
 */
export async function getScoutPolicyReviewState(): Promise<ScoutPolicyReviewState> {
  const service = createServiceClient();
  const [proposedRes, activeRes] = await Promise.all([
    service
      .schema('ops')
      .from('scout_policy')
      .select(POLICY_COLS)
      .eq('status', 'proposed')
      .order('created_at', { ascending: true }),
    service
      .schema('ops')
      .from('scout_policy')
      .select(POLICY_COLS)
      .eq('status', 'active')
      .order('scout_slug', { ascending: true }),
  ]);
  if (proposedRes.error)
    throw new Error(`scout_policy proposed query failed: ${proposedRes.error.message}`);
  if (activeRes.error)
    throw new Error(`scout_policy active query failed: ${activeRes.error.message}`);

  const activeBySlug: Record<string, ScoutPolicyRow> = {};
  for (const row of (activeRes.data ?? []) as ScoutPolicyRow[]) {
    activeBySlug[row.scout_slug] = row;
  }
  return {
    proposed: (proposedRes.data ?? []) as ScoutPolicyRow[],
    activeBySlug,
  };
}

export type ProposeScoutPolicyInput = {
  scoutSlug: string;
  /**
   * The actual policy. Shape evolves; today the convention is
   * { dont_file_categories?: string[], prioritize?: string[],
   *   dedup_rules?: string[], notes?: string }
   * but the column is JSONB so nothing is rejected at the schema level.
   * The caller is responsible for staying within whatever shape the scout
   * prompt knows how to apply.
   */
  policy: Record<string, unknown>;
  /**
   * Required short rationale + the 3 example idea ids (or other evidence)
   * that motivated this proposal. Per the scout-learner card:
   * "each proposed rule includes the 3 example ideas that motivated it
   * (auditable)" — this is the audit trail.
   */
  rationale?: string | null;
  /**
   * Who proposed this — 'scout-learner-v1' for the learner, 'jonathan' for
   * hand-written baselines.
   */
  proposedBy: string;
  actor: {
    actorType: 'human' | 'agent' | 'system';
    actorName: string;
    keyId?: string | null;
    adminUserId?: string | null;
  };
};

/**
 * Insert a new proposed policy version for a scout. NEVER auto-activates —
 * a proposed row sits until an admin server action (future) flips it to
 * 'active' and supersedes the previous active row in the same transaction.
 *
 * Version is picked atomically as max(version)+1 for the scout. Race-safe
 * via the (scout_slug, version) UNIQUE constraint — concurrent inserts
 * collide and one retries.
 */
export async function proposeScoutPolicy(input: ProposeScoutPolicyInput): Promise<ScoutPolicyRow> {
  const service = createServiceClient();

  // Pick next version number. The UNIQUE (scout_slug, version) constraint
  // is the actual race-safety mechanism; this query just gets us a starting
  // guess. Retry once on collision.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: latest, error: latestErr } = await service
      .schema('ops')
      .from('scout_policy')
      .select('version')
      .eq('scout_slug', input.scoutSlug)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestErr)
      throw new Error(`proposeScoutPolicy version lookup failed: ${latestErr.message}`);

    const nextVersion = (latest?.version ?? 0) + 1;
    const { data, error } = await service
      .schema('ops')
      .from('scout_policy')
      .insert({
        scout_slug: input.scoutSlug,
        version: nextVersion,
        status: 'proposed',
        policy: input.policy,
        proposed_by: input.proposedBy,
        rationale: input.rationale ?? null,
        actor_type: input.actor.actorType,
        actor_name: input.actor.actorName,
        key_id: input.actor.keyId ?? null,
        admin_user_id: input.actor.adminUserId ?? null,
      })
      .select(
        'id, scout_slug, version, status, policy, proposed_by, rationale, activated_by, activated_at, superseded_at, actor_type, actor_name, created_at, updated_at',
      )
      .single();
    if (!error && data) return data as ScoutPolicyRow;

    // 23505 = unique_violation. Almost certainly a concurrent insert grabbed
    // our version number — retry once with a fresh max() read.
    if (error?.code === '23505' && attempt === 0) continue;
    throw new Error(`proposeScoutPolicy insert failed: ${error?.message ?? 'unknown'}`);
  }
  // Unreachable — the loop either returns or throws.
  throw new Error('proposeScoutPolicy: exhausted retries');
}
