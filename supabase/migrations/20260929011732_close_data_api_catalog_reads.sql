-- Close the Supabase data API to catalog reads (repo-4wb0e).
--
-- Observed 2026-09-29: anyone holding the public anon key (it ships in the site bundle) could pull
-- the whole published catalog straight from PostgREST, 7.1 MB per 1,000-row page in ~3.3 s, with
-- no cache or rate limit in front and no Cloudflare in the path. No application code reads the
-- catalog this way: web, api-public and mobile all read through server-side Postgres pools. The
-- browser still uses Supabase Auth and Storage, which do not go through PostgREST.
BEGIN;

-- PostgREST needs at least one schema. `public` stays exposed with nothing readable in it;
-- `published` and `graphql_public` (the GraphQL endpoint) are no longer served.
ALTER ROLE authenticator SET pgrst.db_schemas TO 'public';

-- The two views were created for PostgREST and have no remaining consumer. Server-side pools
-- read published.* directly, and web_public inherits anon's grants on those tables, not these.
REVOKE ALL ON public.published_entities, public.published_search_index FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
