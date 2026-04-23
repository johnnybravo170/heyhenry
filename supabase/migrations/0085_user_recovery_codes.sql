-- MFA recovery codes. Supabase handles TOTP factor storage in auth.mfa_factors
-- but does not issue recovery codes. We generate 10 single-use codes at
-- enrollment, store only sha256 hashes here, and consume them on use.
--
-- RLS is enabled with no policies: all access goes through the service-role
-- admin client in server actions. Clients (anon/authenticated) cannot read,
-- insert, or mutate rows. This prevents leaking hashes to the browser and
-- keeps consumption atomic on the server.

CREATE TABLE public.user_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_recovery_codes_user_id_idx ON public.user_recovery_codes(user_id);
CREATE INDEX user_recovery_codes_user_unconsumed_idx
  ON public.user_recovery_codes(user_id)
  WHERE consumed_at IS NULL;

ALTER TABLE public.user_recovery_codes ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies. Service role bypasses RLS; no other role has access.
