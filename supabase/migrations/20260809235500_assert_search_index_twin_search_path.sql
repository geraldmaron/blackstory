-- Pin the search_path on bb_public.assert_search_index_twin (Supabase security advisor
-- 0011_function_search_path_mutable).
--
-- This trigger function guards the release_entities/search_index parity invariant, so it runs on
-- the publish write path under whatever search_path the calling role happens to have. With a
-- role-mutable search_path, a role that puts its own schema ahead of bb_public could shadow the
-- objects the function resolves and change what the guard sees.
--
-- The body already fully qualifies bb_public.search_index, so an empty search_path needs no other
-- change. Its sibling in 20260808020846_release_catalog_publish_watermark.sql
-- (bb_ops.mark_release_catalog_dirty) was already written this way; this one was the oversight.
--
-- Function body is otherwise byte-identical to the deployed definition.
create or replace function bb_public.assert_search_index_twin()
returns trigger
language plpgsql
set search_path = ''
as $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM bb_public.search_index si
    WHERE si.release_id = NEW.release_id
      AND si.entity_id = NEW.entity_id
  ) THEN
    RAISE EXCEPTION
      'release_entities row (release_id=%, entity_id=%) has no bb_public.search_index twin; '
      'publish both in the same transaction (see publish-release-entities-incremental.ts)',
      NEW.release_id, NEW.entity_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$function$;

-- bb_public.release_catalog_publish_watermark intentionally has RLS enabled with NO policies
-- (advisor 0008_rls_enabled_no_policy). That is fail-closed by design and is documented at
-- 20260808020846_release_catalog_publish_watermark.sql:31 — it is internal publisher state
-- reached only by RLS-bypassing roles (postgres / service_role). Recording it here so the
-- recurring advisor notice is not "fixed" later by adding a policy that would only widen access.
comment on table bb_public.release_catalog_publish_watermark is
  'Internal release-catalog publisher state. RLS enabled with no policies ON PURPOSE: only '
  'RLS-bypass roles (postgres/service_role) may read or write it. Do not add a policy to '
  'silence advisor 0008.';
