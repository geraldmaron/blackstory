-- Least-privilege identities for the deployed consumers (repo-mzvhp).
--
-- Until now every deployed consumer connected as `postgres`: the public web pool, the admin
-- pool, and the GitHub Actions catalog/egress jobs. `postgres` bypasses RLS, reads all data, runs
-- DDL and manages roles, so a SQL-injection or credential leak in the public path was a full
-- database compromise. This migration adds one capability role per consumer, following the
-- `research_worker` pattern (NOLOGIN, refuses to exist with excess attributes), and a LOGIN role
-- that inherits each. Passwords are never in this file: they are set out-of-band as SCRAM
-- verifiers and held in 1Password. Local operator tooling keeps `postgres`.
--
--   web_public  -> blackstory_web    public site + api-public (DATABASE_URL)
--   admin_app   -> blackstory_admin  /admin console (ADMIN_DATABASE_URL)
--   ops_ci      -> blackstory_ci     catalog publish + egress monitor workflows (HOSTED_DATABASE_URL)
BEGIN;

DO $$
DECLARE
  capability text;
BEGIN
  FOREACH capability IN ARRAY ARRAY['web_public', 'ops_ci'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = capability) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', capability);
    ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = capability
      AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
      RAISE EXCEPTION '% exceeds its capability boundary', capability;
    END IF;
  END LOOP;

  -- The console reads and corrects every product row, so it keeps RLS bypass; what it loses is
  -- DDL, role management, and the platform schemas (auth, storage, vault, ...).
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_app') THEN
    CREATE ROLE admin_app NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
  ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_app'
    AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
    RAISE EXCEPTION 'admin_app exceeds its capability boundary';
  END IF;
END $$;

-- ── web_public: exactly what an anonymous reader may see, plus the corrections intake ─────────
-- Inheriting `anon` gives the public pool the same RLS-filtered view of published/reference data
-- the data API serves, instead of postgres's view of every release.
GRANT anon TO web_public;
GRANT USAGE ON SCHEMA ops, submissions TO web_public;

GRANT SELECT ON ops.kill_switches TO web_public;
CREATE POLICY web_public_read_kill_switches ON ops.kill_switches
  FOR SELECT TO web_public USING (true);

-- corrections-store.ts: INSERT a quarantined row, read it back by id or receipt digest, and
-- rewrite its payload (appeals). No other column is writable, and nothing can be deleted.
GRANT INSERT (id, status, created_by, kind, payload, source_url, receipt_digest, created_at)
  ON submissions.intake_items TO web_public;
GRANT SELECT (id, payload, receipt_digest) ON submissions.intake_items TO web_public;
GRANT UPDATE (payload) ON submissions.intake_items TO web_public;
CREATE POLICY web_public_insert_quarantined ON submissions.intake_items
  FOR INSERT TO web_public WITH CHECK (status = 'quarantined');
CREATE POLICY web_public_read_intake ON submissions.intake_items
  FOR SELECT TO web_public USING (true);
CREATE POLICY web_public_update_intake_payload ON submissions.intake_items
  FOR UPDATE TO web_public USING (true) WITH CHECK (true);

-- ── ops_ci: catalog artifact publish + public-read egress monitor ─────────────────────────────
GRANT anon TO ops_ci;
GRANT USAGE ON SCHEMA ops TO ops_ci;

-- The egress monitor matches other roles' statement text in pg_stat_statements, which needs
-- pg_read_all_stats, and `postgres` holds that without the ADMIN option. This definer function
-- returns only the totals the monitor already computed, so the CI identity never sees query text.
CREATE OR REPLACE FUNCTION ops.public_read_statement_totals(fingerprint text)
RETURNS TABLE (calls bigint, rows bigint, statements bigint, stats_since timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, extensions
AS $fn$
  SELECT sum(s.calls)::bigint, sum(s.rows)::bigint, count(*)::bigint, i.stats_reset
    FROM extensions.pg_stat_statements s
    CROSS JOIN extensions.pg_stat_statements_info i
   WHERE s.query LIKE fingerprint
   GROUP BY i.stats_reset
$fn$;
REVOKE ALL ON FUNCTION ops.public_read_statement_totals(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ops.public_read_statement_totals(text) TO ops_ci;

GRANT SELECT ON published.release_catalog_publish_watermark TO ops_ci;
GRANT UPDATE (published_entities_hash, published_search_index_hash, published_at)
  ON published.release_catalog_publish_watermark TO ops_ci;
CREATE POLICY ops_ci_catalog_watermark ON published.release_catalog_publish_watermark
  FOR ALL TO ops_ci USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON ops.public_read_egress_watermark TO ops_ci;
CREATE POLICY ops_ci_egress_watermark ON ops.public_read_egress_watermark
  FOR ALL TO ops_ci USING (true) WITH CHECK (true);

-- ── admin_app: DML on the product schemas, nothing else ───────────────────────────────────────
DO $$
DECLARE
  product_schema text;
BEGIN
  FOREACH product_schema IN ARRAY ARRAY[
    'canonical', 'published', 'reference', 'research', 'evidence', 'submissions', 'ops', 'audit',
    'access_control'
  ] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = product_schema);
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO admin_app', product_schema);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO admin_app', product_schema);
    EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA %I TO admin_app', product_schema);
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO admin_app', product_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO admin_app', product_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO admin_app', product_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT EXECUTE ON FUNCTIONS TO admin_app', product_schema);
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA extensions TO admin_app;

-- ── Login identities (password set out-of-band as a SCRAM verifier) ───────────────────────────
-- Privileges inherit through membership; role attributes do not. BYPASSRLS therefore has to sit
-- on blackstory_admin itself, and admin_app carries it only to document the boundary.
DO $$
DECLARE
  spec text[];
  bypass text;
BEGIN
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    ARRAY['blackstory_web', 'web_public', 'NOBYPASSRLS'],
    ARRAY['blackstory_admin', 'admin_app', 'BYPASSRLS'],
    ARRAY['blackstory_ci', 'ops_ci', 'NOBYPASSRLS']
  ] LOOP
    bypass := spec[3];
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = spec[1]) THEN
      EXECUTE format('CREATE ROLE %I LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION %s', spec[1], bypass);
    ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = spec[1]
      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication
        OR (rolbypassrls AND bypass = 'NOBYPASSRLS'))) THEN
      RAISE EXCEPTION '% exceeds its login boundary', spec[1];
    END IF;
    EXECUTE format('GRANT %I TO %I WITH INHERIT TRUE', spec[2], spec[1]);
  END LOOP;
END $$;

COMMENT ON ROLE web_public IS 'Public site and api-public: anon-equivalent reads, kill switches, quarantined corrections intake.';
COMMENT ON ROLE admin_app IS 'Admin console: DML on product schemas with RLS bypass. No DDL, roles, or platform schemas.';
COMMENT ON ROLE ops_ci IS 'CI catalog publish and egress monitor: anon reads, statement totals, two watermarks.';

COMMIT;
