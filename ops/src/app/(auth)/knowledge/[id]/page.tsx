import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase';
import { DocEditor } from './doc-editor';

export default async function KnowledgeDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = createServiceClient();
  const { data: doc } = await service
    .schema('ops')
    .from('knowledge_docs')
    .select('id, title, body, tags, actor_name, created_at, updated_at, embedding_updated_at')
    .eq('id', id)
    .maybeSingle();
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/knowledge" className="text-xs text-[var(--muted-foreground)] hover:underline">
        ← Knowledge
      </Link>
      <DocEditor
        id={id}
        initialTitle={doc.title as string}
        initialBody={doc.body as string}
        initialTags={((doc.tags as string[]) ?? []).join(', ')}
        meta={{
          actorName: doc.actor_name as string,
          updatedAt: doc.updated_at as string,
          embeddingUpdatedAt: (doc.embedding_updated_at as string | null) ?? null,
        }}
      />
    </div>
  );
}
