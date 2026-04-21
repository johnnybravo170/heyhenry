'use server';

import { revalidatePath } from 'next/cache';
import { contentHash, embedText } from '@/lib/embed';
import { requireAdmin } from '@/lib/ops-gate';
import { createServiceClient } from '@/lib/supabase';

export type ActionResult<T = unknown> =
  | { ok: true; id?: string; hits?: T }
  | { ok: false; error: string };

type Hit = {
  doc_id: string;
  title: string;
  body: string;
  tags: string[];
  similarity: number;
};

export async function createKnowledgeDocAction(input: {
  title: string;
  body: string;
  tags: string[];
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!input.title.trim()) return { ok: false, error: 'Title required.' };
  if (!input.body.trim()) return { ok: false, error: 'Body required.' };

  const service = createServiceClient();
  const { data, error } = await service
    .schema('ops')
    .from('knowledge_docs')
    .insert({
      actor_type: 'human',
      actor_name: admin.email,
      admin_user_id: admin.userId,
      title: input.title.trim(),
      body: input.body,
      tags: input.tags,
    })
    .select('id, title, body')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Insert failed.' };

  try {
    const textForEmbed = `${data.title}\n\n${data.body}`;
    const [vector, hash] = await Promise.all([embedText(textForEmbed), contentHash(textForEmbed)]);
    await service.schema('ops').from('knowledge_embeddings').insert({
      doc_id: data.id,
      embedding: vector,
      content_hash: hash,
    });
    await service
      .schema('ops')
      .from('knowledge_docs')
      .update({ embedding_updated_at: new Date().toISOString() })
      .eq('id', data.id);
  } catch (e) {
    // Doc is saved, embedding failed — user can retry from the detail page.
    return {
      ok: false,
      error: `Doc saved but embedding failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  revalidatePath('/knowledge');
  return { ok: true, id: data.id as string };
}

export async function updateKnowledgeDocAction(input: {
  id: string;
  title: string;
  body: string;
  tags: string[];
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!input.title.trim() || !input.body.trim())
    return { ok: false, error: 'Title + body required.' };

  const service = createServiceClient();
  const { error } = await service
    .schema('ops')
    .from('knowledge_docs')
    .update({
      title: input.title.trim(),
      body: input.body,
      tags: input.tags,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  // Re-embed only if content actually changed.
  const textForEmbed = `${input.title}\n\n${input.body}`;
  const hash = await contentHash(textForEmbed);
  const { data: cur } = await service
    .schema('ops')
    .from('knowledge_embeddings')
    .select('content_hash')
    .eq('doc_id', input.id)
    .maybeSingle();

  if (!cur || cur.content_hash !== hash) {
    try {
      const vector = await embedText(textForEmbed);
      if (cur) {
        await service
          .schema('ops')
          .from('knowledge_embeddings')
          .update({
            embedding: vector,
            content_hash: hash,
            updated_at: new Date().toISOString(),
          })
          .eq('doc_id', input.id);
      } else {
        await service.schema('ops').from('knowledge_embeddings').insert({
          doc_id: input.id,
          embedding: vector,
          content_hash: hash,
        });
      }
      await service
        .schema('ops')
        .from('knowledge_docs')
        .update({ embedding_updated_at: new Date().toISOString() })
        .eq('id', input.id);
    } catch (e) {
      return {
        ok: false,
        error: `Saved, but re-embedding failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  // Actor name used by RLS policy audit is admin.email; logged implicitly.
  void admin;
  revalidatePath(`/knowledge/${input.id}`);
  revalidatePath('/knowledge');
  return { ok: true };
}

export async function searchKnowledgeAction(
  query: string,
): Promise<{ ok: true; hits: Hit[] } | { ok: false; error: string }> {
  await requireAdmin();
  if (!query.trim()) return { ok: false, error: 'Query required.' };

  const service = createServiceClient();
  try {
    const vector = await embedText(query.trim());
    const { data, error } = await service.schema('ops').rpc('knowledge_search', {
      query_embedding: vector,
      match_limit: 10,
      min_similarity: 0.4,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, hits: (data ?? []) as Hit[] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function archiveKnowledgeDocAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const service = createServiceClient();
  const { error } = await service
    .schema('ops')
    .from('knowledge_docs')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/knowledge');
  return { ok: true };
}
