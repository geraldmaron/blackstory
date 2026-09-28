-- Close the write paths a self-registered account could reach through the data API (repo-t8h9z).
--
-- Observed 2026-09-28: Auth sign-up was open, `submissions` was an exposed PostgREST schema, and
-- `authenticated` held USAGE on it plus INSERT/SELECT on intake_items under a policy that let any
-- signed-in account insert quarantined rows. No application code uses that path: every intake
-- write goes through a server-side Postgres connection. Sign-up itself is closed in the Auth
-- config (supabase/config.toml `[auth] enable_signup = false`, applied through the management
-- API), which this migration cannot do.
BEGIN;

-- Exposed schemas: `published` stays (anon reads approved projections under RLS). `submissions`
-- goes; nothing reads or writes it over the data API.
ALTER ROLE authenticator SET pgrst.db_schemas TO 'public,published';

DROP POLICY IF EXISTS intake_insert_quarantined ON submissions.intake_items;
DROP POLICY IF EXISTS intake_select_own_or_staff ON submissions.intake_items;
REVOKE ALL ON ALL TABLES IN SCHEMA submissions FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA submissions FROM anon, authenticated;
REVOKE ALL ON SCHEMA submissions FROM anon, authenticated;

-- The ledger picked up anon SELECT from the `published` default privileges and never had RLS.
-- Nothing in the application reads it; lock it to server-side connections.
ALTER TABLE published.tts_usage_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON published.tts_usage_ledger FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
