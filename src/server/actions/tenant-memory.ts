'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentTenant } from '@/lib/auth/helpers';
import {
  DOCUMENT_LABEL_MAX_LENGTH,
  DOCUMENT_LABEL_SLOTS,
  type DocumentLabelSlot,
  setTenantMemory,
} from '@/lib/db/queries/tenant-memory';
import { createClient } from '@/lib/supabase/server';

const UNSAFE_PATTERN = /[<>&"']/;

export async function setDocumentLabelAction(
  slot: DocumentLabelSlot,
  value: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };
  if (!['owner', 'admin'].includes(tenant.member.role)) {
    return { ok: false, error: 'Only owners and admins can change document labels.' };
  }

  if (!(slot in DOCUMENT_LABEL_SLOTS)) {
    return { ok: false, error: 'Unknown label slot.' };
  }

  const trimmed = value.trim();

  if (trimmed.length > DOCUMENT_LABEL_MAX_LENGTH) {
    return {
      ok: false,
      error: `Label must be ${DOCUMENT_LABEL_MAX_LENGTH} characters or fewer.`,
    };
  }

  if (UNSAFE_PATTERN.test(trimmed)) {
    return { ok: false, error: 'Label must be plain text — no HTML or special characters.' };
  }

  // Resolve the user id for audit trail
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await setTenantMemory(tenant.id, `label.${slot}`, trimmed, {
    kind: 'preference',
    updatedBy: user?.id,
  });

  revalidatePath('/settings/document-labels');

  return { ok: true };
}
