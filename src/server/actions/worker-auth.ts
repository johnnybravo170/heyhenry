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

import { findWorkerInviteByCode, markInviteUsed } from '@/lib/db/queries/worker-invites';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { workerSignupSchema } from '@/lib/validators/worker-invite';

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
    const { error: memberErr } = await admin.from('tenant_members').insert({
      tenant_id: invite.tenant_id,
      user_id: userId,
      role: invite.role,
    });
    if (memberErr) throw new Error(memberErr.message);

    // 6. Mark invite as used.
    await markInviteUsed(invite.id, userId);
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
