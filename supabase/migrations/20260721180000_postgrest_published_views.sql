-- PostgREST published-read views (ADR-026, repo-651l.3).
-- Stable public-schema names for Supabase Data API over active-release projections only.
-- Does NOT grant anon on bb_canonical, bb_research, or draft tables.
-- security_invoker = true: underlying bb_public RLS remains the fail-closed publish gate.

-- ---------------------------------------------------------------------------
-- public.published_entities — active-release entity projections
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.published_entities
WITH (security_invoker = true) AS
SELECT
  re.release_id,
  re.entity_id,
  re.display_name,
  re.kind,
  re.summary,
  re.location,
  re.geohash,
  re.lat,
  re.lng,
  re.claims,
  re.taxonomy,
  re.related,
  re.primary_image,
  re.projection,
  re.created_at
FROM bb_public.release_entities re
WHERE re.release_id = (
  SELECT ar.release_id
  FROM bb_public.active_release ar
  WHERE ar.id = 'active'
);

COMMENT ON VIEW public.published_entities IS
  'ADR-026 PostgREST surface: entity rows for the active release only. '
  'Resolvability status vocabulary lives in projection/search_index (published|corrected|superseded|deprecated).';

-- ---------------------------------------------------------------------------
-- public.published_search_index — active-release search rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.published_search_index
WITH (security_invoker = true) AS
SELECT
  si.id,
  si.release_id,
  si.entity_id,
  si.name,
  si.name_lower,
  si.aliases,
  si.topics,
  si.kind,
  si.status,
  si.geohash,
  si.related_count,
  si.claim_count,
  si.facets,
  si.created_at
FROM bb_public.search_index si
WHERE si.release_id = (
  SELECT ar.release_id
  FROM bb_public.active_release ar
  WHERE ar.id = 'active'
);

COMMENT ON VIEW public.published_search_index IS
  'ADR-026 PostgREST surface: search index rows for the active release only.';

-- ---------------------------------------------------------------------------
-- Grants: SELECT only; no write paths; no canonical/research widening
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.published_entities TO anon, authenticated;
GRANT SELECT ON public.published_search_index TO anon, authenticated;
