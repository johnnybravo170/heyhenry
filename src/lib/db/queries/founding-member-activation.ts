/**
 * Founding-member activation read-out — operator-only, cross-tenant.
 *
 * Backs the /admin/activation view. Calls the single-shot RPC
 * `get_founding_member_activation()` via the service-role admin client
 * (the RPC is locked to service_role and reads across all tenants). One
 * round-trip, no N+1. NEVER expose this to operator-facing routes — it is
 * platform-admin surface only, like the other queries in admin.ts.
 *
 * Read-only: no writes, no scheduled send. Pull, not push.
 */

import { createAdminClient } from '@/lib/supabase/admin';

/** The seven sacred-path rungs, in order. */
export const SACRED_PATH_STAGES = [
  'lead',
  'estimate',
  'approval',
  'project',
  'invoice',
  'payment',
  'qbo',
] as const;

export type SacredPathStage = (typeof SACRED_PATH_STAGES)[number];

export type ActivationFlag = 'green' | 'amber' | 'red';

export type FoundingMemberActivation = {
  tenant_id: string;
  name: string;
  vertical: string | null;
  /** coalesce(onboarding_completed_at, created_at) — the activation-window anchor. */
  access_at: string;
  /** Furthest-right lit rung. */
  current_stage: SacredPathStage;
  /** Which arrows are lit (may be non-contiguous). */
  stages: Record<SacredPathStage, boolean>;
  /** Days since the last sacred-path movement. Null if no movement ever. Headline number. */
  days_stalled: number | null;
  last_movement_at: string | null;
  first_estimate_sent: string | null;
  last_henry_at: string | null;
  /** "First estimate sent within 7 days of access": green / amber / red. */
  activation: ActivationFlag;
};

/**
 * All founding members (tenants.founding_member = true), stalest first.
 * Drives off the flag, not hardcoded IDs — new founders appear automatically
 * once flagged.
 */
export async function getFoundingMemberActivation(): Promise<FoundingMemberActivation[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('get_founding_member_activation');
  if (error) {
    throw new Error(`Failed to load founding-member activation: ${error.message}`);
  }
  return (data ?? []) as FoundingMemberActivation[];
}
