-- Message Lab. Synthetic customer-archetype focus group for testing
-- marketing copy. Lives in ops; same posture as the board (service-role
-- only, no tenant_id).
--
-- Method (Justin Brooke / "predictive wear", validated 85-92% vs. real
-- focus groups): embody a panel of high-quality customer archetypes, run
-- a piece of copy past all of them in parallel, collect a buy/no-buy
-- signal + reasons. The score IS the purchase split; the reasons feed the
-- writing agent.
--
-- Topology (one eval run):
--   message_evals (1) -> message_eval_reactions (N, one per archetype)
--
-- Archetypes are grouped by `vertical` so we can build a distinct panel
-- per market (general_contractor first; guitar/etc. later) without a
-- schema change. The ~1,400-word dossier body lives in ops.knowledge_docs,
-- exactly like advisor skills do.

-- Archetypes (the synthetic panel) -------------------------------------

CREATE TABLE IF NOT EXISTS ops.archetypes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT UNIQUE NOT NULL,
  vertical           TEXT NOT NULL DEFAULT 'general_contractor',
  name               TEXT NOT NULL,
  tagline            TEXT NOT NULL DEFAULT '',
  emoji              TEXT NOT NULL DEFAULT '🧱',
  -- 'observed' = grounded in real data; 'inferred' = triangulated from
  -- indirect signal (the underrepresented-online segments). Carried so the
  -- panel can be read with appropriate confidence.
  evidence_basis     TEXT NOT NULL DEFAULT 'observed'
                     CHECK (evidence_basis IN ('observed', 'inferred', 'mixed')),
  confidence         TEXT NOT NULL DEFAULT 'medium',
  prevalence_note    TEXT NOT NULL DEFAULT '',
  -- Lower = more attractive target for this vertical (rank 1 = best fit).
  -- Used only as display context; does NOT gate the buy/no-buy vote.
  attractiveness_rank INT,
  knowledge_id       UUID REFERENCES ops.knowledge_docs(id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  sort_order         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_archetypes_vertical_idx
  ON ops.archetypes (vertical, status, sort_order) WHERE status = 'active';

-- Evals (one run of one piece of copy against a panel) -----------------

CREATE TABLE IF NOT EXISTS ops.message_evals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical        TEXT NOT NULL DEFAULT 'general_contractor',
  -- What kind of artifact this is — shifts the reading lens (a 5-second
  -- ad scan vs. reading a full sales page).
  message_type    TEXT NOT NULL DEFAULT 'other'
                  CHECK (message_type IN ('ad', 'email', 'landing_page',
                                          'sales_page', 'sms', 'headline',
                                          'social_post', 'other')),
  goal            TEXT NOT NULL DEFAULT '',
  input_text      TEXT,                  -- pasted copy (or extracted from URL)
  input_url       TEXT,                  -- source URL when fetched
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'done', 'failed')),
  archetype_ids   UUID[] NOT NULL DEFAULT '{}',
  model_override  TEXT,                  -- provider:model, null = engine default
  provider_override TEXT,
  buy_count       INT NOT NULL DEFAULT 0,
  no_buy_count    INT NOT NULL DEFAULT 0,
  objections      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- collated themes across no_buy
  budget_cents    INT NOT NULL DEFAULT 50,
  spent_cents     NUMERIC(10,2) NOT NULL DEFAULT 0,
  error_message   TEXT,
  created_by_admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_key_id        UUID REFERENCES ops.api_keys(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ops_message_evals_created_idx
  ON ops.message_evals (created_at DESC);
CREATE INDEX IF NOT EXISTS ops_message_evals_vertical_idx
  ON ops.message_evals (vertical, created_at DESC);

-- Reactions (one archetype's verdict on the copy) ----------------------

CREATE TABLE IF NOT EXISTS ops.message_eval_reactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_id         UUID NOT NULL REFERENCES ops.message_evals(id) ON DELETE CASCADE,
  archetype_id    UUID NOT NULL REFERENCES ops.archetypes(id),
  decision        TEXT NOT NULL CHECK (decision IN ('buy', 'no_buy')),
  reason          TEXT NOT NULL DEFAULT '',
  -- { relates, appeals, turns_off, would_make_buy } — the focus-group
  -- question set, lightly structured so the writing agent can parse it.
  comments        JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_text        TEXT,                  -- full model output, for audit/recovery
  provider        TEXT,
  model           TEXT,
  prompt_tokens   INT,
  completion_tokens INT,
  cost_cents      NUMERIC(10,2),
  latency_ms      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (eval_id, archetype_id)
);

CREATE INDEX IF NOT EXISTS ops_message_eval_reactions_eval_idx
  ON ops.message_eval_reactions (eval_id);

-- updated_at trigger (ops.touch_updated_at defined in 0179_ops_board) ---

DROP TRIGGER IF EXISTS ops_archetypes_touch ON ops.archetypes;
CREATE TRIGGER ops_archetypes_touch
  BEFORE UPDATE ON ops.archetypes
  FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();

-- RLS + grants (service-role only, same as rest of ops.*) --------------

ALTER TABLE ops.archetypes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.message_evals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.message_eval_reactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ops.archetypes, ops.message_evals, ops.message_eval_reactions
  TO service_role;

-- New scopes for ops.api_keys (validated against the array column in
-- keys.ts, no table change required):
--   read:message_lab, write:message_lab
