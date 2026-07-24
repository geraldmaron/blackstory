-- 20260724000003_coverage_gap_view: Geographic Gap Scanner staff surface.
--
-- bb_ops.coverage_gap_by_county_decade joins decennial census Black population
-- (bb_reference.census_county_decades, payload keys are camelCase from the
-- Firestore migration: blackPopulation / totalPopulation) to a per-county count
-- of published entities in the ACTIVE release (bb_public.release_entities).
--
-- Invariants (ADR-009 / ADR-020):
--   * READ-ONLY research-targeting surface. It never writes to, and nothing here
--     grants write access to, bb_public or bb_publication. Research cannot publish.
--   * Staff-only. Views cannot carry RLS policies, so the staff gate is enforced
--     twice: (1) an in-view bb_auth.is_staff() predicate, and (2) grants — SELECT
--     for authenticated (staff-filtered by the predicate) and service_role only.
--     NO anon grant, NO anon policy, nothing exposed via the public API schema.
--   * SECURITY DEFINER semantics: security_invoker = false (explicit), so the
--     view reads its base tables with owner rights. That is required because
--     authenticated staff have no direct bb_public.release_entities row access
--     outside the active release and no bb_reference grants are widened here.
--   * bb_ops has NO default SELECT privileges for authenticated (see
--     20260720220002_schemas_roles.sql), so granting schema USAGE below exposes
--     exactly this one view and nothing else in bb_ops.
--
-- Coverage ratio semantics: coverage_ratio = entity_count / black_population.
-- A low ratio is a research-prioritization signal only — it never asserts that
-- history is absent. Rows with black_population = 0 yield NULL (undefined), not
-- an "infinite gap". Consumers: packages/domain/src/discovery/geographic-gap-scanner.ts
-- (pure functions; this view is the intended row source).

-- County attribution today rides on the countyFips carried in the published
-- location/projection JSON (map-source raw docs carry county.fipsCode). The
-- EXACT SQL for the real spatial join — once Census TIGER county polygons land
-- in bb_reference.jurisdictions (kind = 'county', location geography(Polygon,4326),
-- fips5 = state_fips || county_fips) — replaces the county_entity_counts CTE with:
--
--   SELECT
--     (j.state_fips || j.county_fips) AS fips5,
--     count(re.entity_id)::bigint     AS entity_count
--   FROM bb_public.release_entities re
--   JOIN bb_reference.jurisdictions j
--     ON j.kind = 'county'
--    AND j.location IS NOT NULL
--    AND ST_Covers(
--          j.location,
--          ST_SetSRID(ST_MakePoint(re.lng, re.lat), 4326)::geography
--        )
--   WHERE re.release_id = (
--           SELECT ar.release_id FROM bb_public.active_release ar WHERE ar.id = 'active'
--         )
--     AND re.lat IS NOT NULL
--     AND re.lng IS NOT NULL
--   GROUP BY 1;

CREATE OR REPLACE VIEW bb_ops.coverage_gap_by_county_decade
WITH (security_invoker = false) AS
WITH county_entity_counts AS (
  SELECT
    COALESCE(
      NULLIF(re.location ->> 'countyFips', ''),
      NULLIF(re.projection -> 'county' ->> 'fipsCode', '')
    ) AS fips5,
    count(*)::bigint AS entity_count
  FROM bb_public.release_entities re
  WHERE re.release_id = (
    SELECT ar.release_id FROM bb_public.active_release ar WHERE ar.id = 'active'
  )
  GROUP BY 1
)
SELECT
  c.fips5,
  c.decade,
  COALESCE((c.payload ->> 'blackPopulation')::bigint, 0) AS black_population,
  COALESCE(e.entity_count, 0)                            AS entity_count,
  CASE
    WHEN COALESCE((c.payload ->> 'blackPopulation')::bigint, 0) > 0
      THEN round(
        COALESCE(e.entity_count, 0)::numeric
          / (c.payload ->> 'blackPopulation')::numeric,
        9
      )
    ELSE NULL
  END AS coverage_ratio,
  c.source,
  c.retrieved_at
FROM bb_reference.census_county_decades c
LEFT JOIN county_entity_counts e ON e.fips5 = c.fips5
-- Staff-only gate inside the definer view (views cannot carry RLS policies).
WHERE bb_auth.is_staff() OR (auth.jwt() ->> 'role') = 'service_role';

COMMENT ON VIEW bb_ops.coverage_gap_by_county_decade IS
  'Geographic Gap Scanner (geographic-gap.v1): published entity count vs census '
  'Black population per county x decade. Staff-only, read-only research-targeting '
  'signal. Low coverage_ratio means the catalog is thin there, not that history is '
  'absent. Never a publication surface (ADR-009).';

-- Grants: staff read via PostgREST/authenticated (in-view is_staff() filters rows),
-- service_role for operator tooling. NO anon access of any kind.
REVOKE ALL ON bb_ops.coverage_gap_by_county_decade FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA bb_ops TO authenticated; -- exposes only explicitly granted relations
GRANT SELECT ON bb_ops.coverage_gap_by_county_decade TO authenticated, service_role;
