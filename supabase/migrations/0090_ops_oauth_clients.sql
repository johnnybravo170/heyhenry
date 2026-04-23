-- 0088_ops_oauth_clients.sql
-- Dynamic Client Registration (RFC 7591) for the ops OAuth 2.1 provider.
--
-- Anthropic's Routines connector registers itself via POST /register before
-- the authorize step. We persist the metadata so /authorize and /token can
-- validate redirect_uris and (optionally) client_secret.

CREATE TABLE IF NOT EXISTS ops.oauth_clients (
  client_id                  TEXT PRIMARY KEY,
  client_secret_hash         TEXT,                                               -- nullable for public PKCE clients
  client_name                TEXT,
  redirect_uris              TEXT[] NOT NULL,
  grant_types                TEXT[] NOT NULL DEFAULT ARRAY['authorization_code','refresh_token'],
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
  scope                      TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ops.oauth_clients ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only.
