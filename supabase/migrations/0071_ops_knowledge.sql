-- 0071_ops_knowledge.sql
-- Knowledge vault. Markdown docs, semantic search via pgvector embeddings.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ops.knowledge_docs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  tags          TEXT[] NOT NULL DEFAULT '{}',
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  actor_name    TEXT NOT NULL,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  key_id        UUID REFERENCES ops.api_keys(id) ON DELETE SET NULL,
  archived_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  embedding_updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ops_knowledge_docs_updated_idx
  ON ops.knowledge_docs (updated_at DESC) WHERE archived_at IS NULL;

-- Embeddings are stored in a sibling table so a row-update doesn't have to
-- re-embed if only the title changed. Dimensions = 768 to match
-- Gemini text-embedding-004 (default). Swap at your own peril — changing
-- dimensions requires re-embedding every row.
CREATE TABLE IF NOT EXISTS ops.knowledge_embeddings (
  doc_id        UUID PRIMARY KEY REFERENCES ops.knowledge_docs(id) ON DELETE CASCADE,
  embedding     vector(768) NOT NULL,
  content_hash  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_knowledge_embeddings_vec_idx
  ON ops.knowledge_embeddings USING hnsw (embedding vector_cosine_ops);

ALTER TABLE ops.knowledge_docs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.knowledge_embeddings  ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON ops.knowledge_docs, ops.knowledge_embeddings
  TO service_role;

-- Similarity search RPC. Exposed through PostgREST via .rpc('ops_knowledge_search').
CREATE OR REPLACE FUNCTION ops.knowledge_search(
  query_embedding vector(768),
  match_limit INT DEFAULT 10,
  min_similarity FLOAT DEFAULT 0.4
)
RETURNS TABLE (
  doc_id UUID,
  title TEXT,
  body TEXT,
  tags TEXT[],
  similarity FLOAT,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = ops, public
AS $$
  SELECT
    d.id,
    d.title,
    d.body,
    d.tags,
    1 - (e.embedding <=> query_embedding) AS similarity,
    d.updated_at
  FROM ops.knowledge_embeddings e
  JOIN ops.knowledge_docs d ON d.id = e.doc_id
  WHERE d.archived_at IS NULL
    AND (1 - (e.embedding <=> query_embedding)) >= min_similarity
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_limit;
$$;

GRANT EXECUTE ON FUNCTION ops.knowledge_search TO service_role;
