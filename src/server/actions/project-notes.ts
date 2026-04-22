'use server';

/**
 * Server actions for project notes — plain text notes the operator
 * types on the project Notes tab. Audio memos stay in project_memos.
 */

import { revalidatePath } from 'next/cache';
import { getCurrentTenant, getCurrentUser } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';

export type NoteResult = { ok: true; id: string } | { ok: false; error: string };

export async function addProjectNoteAction(input: {
  projectId: string;
  body: string;
}): Promise<NoteResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not authenticated.' };

  const body = input.body.trim();
  if (!body) return { ok: false, error: 'Note is empty.' };
  if (body.length > 4000) return { ok: false, error: 'Note too long (max 4000 chars).' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('project_notes')
    .insert({
      project_id: input.projectId,
      tenant_id: tenant.id,
      user_id: user.id,
      body,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Failed to add note.' };

  revalidatePath(`/projects/${input.projectId}`);
  return { ok: true, id: data.id };
}

export async function deleteProjectNoteAction(input: {
  noteId: string;
  projectId: string;
}): Promise<NoteResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('project_notes')
    .delete()
    .eq('id', input.noteId)
    .eq('tenant_id', tenant.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${input.projectId}`);
  return { ok: true, id: input.noteId };
}
