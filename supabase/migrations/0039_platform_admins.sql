-- Platform admin role. Separate from tenant_members because a platform
-- admin is Hey Henry (the company) staff, not a tenant user.
--
-- Bootstrap: Jonathan is seeded below. Add more admins later by INSERTing
-- matching rows via the service role.

CREATE TABLE public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS off intentionally. Reads only happen server-side via the service
-- role (admin client) or via SECURITY DEFINER helpers. No end-user query
-- path touches this table.
ALTER TABLE public.platform_admins DISABLE ROW LEVEL SECURITY;

-- Seed Jonathan as the first platform admin. Looks up the auth user by
-- email so the migration is portable. No-op if the auth user doesn't
-- exist yet (the env can be bootstrapped later).
INSERT INTO public.platform_admins (user_id, email)
SELECT id, email
FROM auth.users
WHERE email = 'jonathan@smartfusion.ca'
  OR email = 'jonathan@heyhenry.io'
  OR email = 'riffninjavideos@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
