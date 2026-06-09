'use server';

/**
 * Worker signup via invite code.
 *
 * Workers do NOT create a new tenant. They join the tenant that issued the
 * invite. The flow:
 *   1. Validate input
 *   2. Look up invite code (admin client, since user is unauthenticated)
 *   3. If invalid/expired/used/revoked: return error
 *   4. Create auth user via admin client
 *   5. Add to tenant_members with the invite's role and tenant_id
 *   6. Mark invite as used
 *   7. Sign in the new user
 *   8. Return { ok: true }
 */

import { newTenantMemberDefaults } from '@/lib/auth/helpers';
import { findWorkerInviteByCode, markInviteUsed } from '@/lib/db/queries/worker-invites';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { workerSignupSchema } from '@/lib/validators/worker-invite';

/**
 * Create a contacts card for a newly joined worker and link it back to
 * their worker_profile via contact_id. Best-effort — a failure here does
 * not break the join flow. Idempotent: skips if contact_id already set.
 */
async function createContactForWorker(
  admin: ReturnType<typeof createAdminClient>,
  opts: {
    tenantId: string;
    memberId: string;
    name: string | null;
    email: string | null;
    workerType: string;
  },
): Promise<void> {
  const { data: profile } = await admin
    .from('worker_profiles')
    .select('id, contact_id')
    .eq('tenant_member_id', opts.memberId)
    .maybeSingle();

  if (!profile || profile.contact_id) return;

  const displayName = opts.name?.trim() || opts.email?.split('@')[0] || 'Worker';
  const { data: contact, error } = await admin
    .from('contacts')
    .insert({
      tenant_id: opts.tenantId,
      kind: opts.workerType === 'subcontractor' ? 'sub' : 'other',
      name: displayName,
      ...(opts.email ? { email: opts.email } : {}),
    })
    .select('id')
    .single();

  if (error || !contact) return;

  await admin.from('worker_profiles').update({ contact_id: contact.id }).eq('id', profile.id);
}

export type WorkerSignupResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function workerSignupAction(input: {
  name: string;
  email: string;
  password: string;
  inviteCode: string;
}): Promise<WorkerSignupResult> {
  // 1. Validate input.
  const parsed = workerSignupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Invalid signup details.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { name, email, password, inviteCode } = parsed.data;

  // 2. Look up invite code.
  const invite = await findWorkerInviteByCode(inviteCode);

  // 3. If invalid/expired/used/revoked: return error.
  if (!invite) {
    return { ok: false, error: 'This invite link is no longer valid. Contact your employer.' };
  }

  const admin = createAdminClient();

  // 4. Create auth user.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (createErr || !created?.user) {
    const msg = createErr?.message ?? 'Could not create user.';
    return { ok: false, error: msg };
  }

  const userId = created.user.id;

  // 5. Add to tenant_members with the invite's role.
  try {
    const { data: member, error: memberErr } = await admin
      .from('tenant_members')
      .insert({
        tenant_id: invite.tenant_id,
        user_id: userId,
        role: invite.role,
        ...(await newTenantMemberDefaults(admin, userId)),
        // Workers join via vetted invite — skip the email+phone verification
        // gate that owner signups go through.
        phone_verified_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (memberErr || !member) throw new Error(memberErr?.message ?? 'Failed to add member.');

    // Apply pre-set worker prefs if the owner filled them in before invite acceptance.
    if (invite.invite_prefs) {
      const prefs = invite.invite_prefs;
      function triToBool(v: 'inherit' | 'yes' | 'no' | undefined): boolean | null {
        if (!v || v === 'inherit') return null;
        return v === 'yes';
      }
      const profilePatch: Record<string, unknown> = {
        tenant_id: invite.tenant_id,
        tenant_member_id: member.id,
      };
      if (prefs.worker_type) profilePatch.worker_type = prefs.worker_type;
      if (prefs.can_log_expenses) profilePatch.can_log_expenses = triToBool(prefs.can_log_expenses);
      if (prefs.can_invoice) profilePatch.can_invoice = triToBool(prefs.can_invoice);
      if (prefs.default_hourly_rate_cents !== undefined)
        profilePatch.default_hourly_rate_cents = prefs.default_hourly_rate_cents;
      if (prefs.default_charge_rate_cents !== undefined)
        profilePatch.default_charge_rate_cents = prefs.default_charge_rate_cents;
      // Upsert — if profile already exists from a previous session, update it.
      await admin.from('worker_profiles').upsert(profilePatch, { onConflict: 'tenant_member_id' });
    }

    // 6. Mark invite as used.
    await markInviteUsed(invite.id, userId);

    // 7. Create a contact card for this worker (best-effort, non-fatal).
    await createContactForWorker(admin, {
      tenantId: invite.tenant_id,
      memberId: member.id,
      name,
      email,
      workerType: invite.invite_prefs?.worker_type ?? 'employee',
    }).catch(() => {});
  } catch (err) {
    // Roll back the auth user on failure.
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    const msg = err instanceof Error ? err.message : 'Signup failed.';
    return { ok: false, error: msg };
  }

  // 7. Sign in the new user.
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) {
    return { ok: false, error: `Account created but sign-in failed: ${signInErr.message}` };
  }

  // 8. Success.
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Join with existing account (sign in + add to tenant)
// ---------------------------------------------------------------------------

/**
 * Sign in with existing credentials and join the tenant that issued the invite.
 * Handles the case where a worker already has an account under a different tenant
 * or simply forgot they already signed up.
 */
export async function workerLoginAndJoinAction(input: {
  email: string;
  password: string;
  inviteCode: string;
}): Promise<WorkerSignupResult> {
  const invite = await findWorkerInviteByCode(input.inviteCode);
  if (!invite) {
    return { ok: false, error: 'This invite link is no longer valid. Contact your employer.' };
  }

  // Sign in first so we know the credentials are valid and get the user id.
  const supabase = await createClient();
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (signInErr || !signInData.user) {
    return {
      ok: false,
      error: signInErr?.message ?? 'Sign-in failed. Check your email and password.',
    };
  }

  const userId = signInData.user.id;
  const admin = createAdminClient();

  // Check if already a member of this tenant — nothing to do.
  const { data: existing } = await admin
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', invite.tenant_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    // Already on the team — mark invite used and redirect.
    await markInviteUsed(invite.id, userId).catch(() => {});
    return { ok: true };
  }

  // Add to tenant.
  const { data: member, error: memberErr } = await admin
    .from('tenant_members')
    .insert({
      tenant_id: invite.tenant_id,
      user_id: userId,
      role: invite.role,
      ...(await newTenantMemberDefaults(admin, userId)),
    })
    .select('id')
    .single();

  if (memberErr || !member) {
    return { ok: false, error: memberErr?.message ?? 'Failed to join team.' };
  }

  // Apply invite prefs if set.
  if (invite.invite_prefs) {
    const prefs = invite.invite_prefs;
    function triToBool(v: 'inherit' | 'yes' | 'no' | undefined): boolean | null {
      if (!v || v === 'inherit') return null;
      return v === 'yes';
    }
    const patch: Record<string, unknown> = {
      tenant_id: invite.tenant_id,
      tenant_member_id: member.id,
    };
    if (prefs.worker_type) patch.worker_type = prefs.worker_type;
    if (prefs.can_log_expenses) patch.can_log_expenses = triToBool(prefs.can_log_expenses);
    if (prefs.can_invoice) patch.can_invoice = triToBool(prefs.can_invoice);
    if (prefs.default_hourly_rate_cents !== undefined)
      patch.default_hourly_rate_cents = prefs.default_hourly_rate_cents;
    if (prefs.default_charge_rate_cents !== undefined)
      patch.default_charge_rate_cents = prefs.default_charge_rate_cents;
    await admin.from('worker_profiles').upsert(patch, { onConflict: 'tenant_member_id' });
  }

  await markInviteUsed(invite.id, userId).catch(() => {});

  // Create a contact card for this worker (best-effort, non-fatal).
  await createContactForWorker(admin, {
    tenantId: invite.tenant_id,
    memberId: member.id,
    name: (signInData.user.user_metadata?.full_name as string | null) ?? null,
    email: signInData.user.email ?? null,
    workerType: invite.invite_prefs?.worker_type ?? 'employee',
  }).catch(() => {});

  return { ok: true };
}

/**
 * Join the tenant that issued the invite using the currently signed-in session.
 * Used when a worker opens an invite link while already logged in.
 */
export async function joinTenantWithSessionAction(inviteCode: string): Promise<WorkerSignupResult> {
  const invite = await findWorkerInviteByCode(inviteCode);
  if (!invite) {
    return { ok: false, error: 'This invite link is no longer valid. Contact your employer.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Not signed in.' };
  }

  const admin = createAdminClient();

  // Already a member — nothing to do.
  const { data: existing } = await admin
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', invite.tenant_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await markInviteUsed(invite.id, user.id).catch(() => {});
    return { ok: true };
  }

  const { data: member, error: memberErr } = await admin
    .from('tenant_members')
    .insert({
      tenant_id: invite.tenant_id,
      user_id: user.id,
      role: invite.role,
      ...(await newTenantMemberDefaults(admin, user.id)),
    })
    .select('id')
    .single();

  if (memberErr || !member) {
    return { ok: false, error: memberErr?.message ?? 'Failed to join team.' };
  }

  if (invite.invite_prefs) {
    const prefs = invite.invite_prefs;
    function triToBool(v: 'inherit' | 'yes' | 'no' | undefined): boolean | null {
      if (!v || v === 'inherit') return null;
      return v === 'yes';
    }
    const patch: Record<string, unknown> = {
      tenant_id: invite.tenant_id,
      tenant_member_id: member.id,
    };
    if (prefs.worker_type) patch.worker_type = prefs.worker_type;
    if (prefs.can_log_expenses) patch.can_log_expenses = triToBool(prefs.can_log_expenses);
    if (prefs.can_invoice) patch.can_invoice = triToBool(prefs.can_invoice);
    if (prefs.default_hourly_rate_cents !== undefined)
      patch.default_hourly_rate_cents = prefs.default_hourly_rate_cents;
    if (prefs.default_charge_rate_cents !== undefined)
      patch.default_charge_rate_cents = prefs.default_charge_rate_cents;
    await admin.from('worker_profiles').upsert(patch, { onConflict: 'tenant_member_id' });
  }

  await markInviteUsed(invite.id, user.id).catch(() => {});

  // Create a contact card for this worker (best-effort, non-fatal).
  await createContactForWorker(admin, {
    tenantId: invite.tenant_id,
    memberId: member.id,
    name: (user.user_metadata?.full_name as string | null) ?? null,
    email: user.email ?? null,
    workerType: invite.invite_prefs?.worker_type ?? 'employee',
  }).catch(() => {});

  return { ok: true };
}
