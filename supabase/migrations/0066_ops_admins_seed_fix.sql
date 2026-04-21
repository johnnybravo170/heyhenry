-- 0066_ops_admins_seed_fix.sql
-- Admin-row seed fix. Migration 0064 hard-coded an email that doesn't match
-- Jonathan's actual Supabase auth.users row, so the INSERT was a no-op and
-- every ops.heyhenry.io page returned 404 via requireAdmin's `notFound()`.
-- Widen the seed to catch both likely emails.

INSERT INTO ops.admins (user_id, granted_at)
SELECT id, now() FROM auth.users
WHERE email IN ('jonathan@smartfusion.ca', 'riffninjavideos@gmail.com')
ON CONFLICT (user_id) DO NOTHING;
