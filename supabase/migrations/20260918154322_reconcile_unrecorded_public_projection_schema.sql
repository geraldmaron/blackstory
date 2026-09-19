-- Two schema changes reached production without corresponding migration-history rows:
-- active-release redirects, and generated public projection columns. Converge both
-- fresh installs and restored production without inventing aliases for the old versions.

DO $migration$
DECLARE
  target regclass := to_regclass('published.release_entities');
  target_columns text[] := ARRAY[
    'display_name', 'kind', 'summary', 'location', 'geohash', 'lat', 'lng',
    'claims', 'taxonomy', 'related', 'primary_image'
  ];
  present_count integer;
  generated_count integer;
  ordinary_count integer;
  mismatches text;
BEGIN
  IF target IS NULL THEN
    RAISE EXCEPTION 'Expected published.release_entities after responsibility schema cutover';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE attgenerated = 's'),
    count(*) FILTER (WHERE attgenerated = '')
  INTO present_count, generated_count, ordinary_count
  FROM pg_attribute
  WHERE attrelid = target
    AND attname = ANY (target_columns)
    AND attnum > 0
    AND NOT attisdropped;

  IF present_count <> cardinality(target_columns) THEN
    RAISE EXCEPTION
      'Expected all 11 derived columns on published.release_entities; found %',
      present_count;
  END IF;

  WITH expected(column_name, data_type, not_null) AS (
    VALUES
      ('display_name', 'text', true),
      ('kind', 'text', true),
      ('summary', 'text', false),
      ('location', 'jsonb', false),
      ('geohash', 'text', false),
      ('lat', 'double precision', false),
      ('lng', 'double precision', false),
      ('claims', 'jsonb', true),
      ('taxonomy', 'jsonb', true),
      ('related', 'jsonb', true),
      ('primary_image', 'jsonb', false)
  )
  SELECT string_agg(
    format(
      '%s(type=%s, not_null=%s)',
      e.column_name,
      format_type(a.atttypid, a.atttypmod),
      a.attnotnull
    ),
    ', ' ORDER BY e.column_name
  )
  INTO mismatches
  FROM expected e
  JOIN pg_attribute a
    ON a.attrelid = target
   AND a.attname = e.column_name
   AND a.attnum > 0
   AND NOT a.attisdropped
  WHERE format_type(a.atttypid, a.atttypmod) <> e.data_type
     OR a.attnotnull IS DISTINCT FROM e.not_null;

  IF mismatches IS NOT NULL THEN
    RAISE EXCEPTION
      'Refusing to alter published.release_entities with unexpected column definitions: %',
      mismatches;
  END IF;

  IF generated_count = cardinality(target_columns) THEN
    WITH expected(column_name, generation_expression) AS (
      VALUES
        ('display_name', $expr$(projection ->> 'displayName'::text)$expr$),
        ('kind', $expr$(projection ->> 'kind'::text)$expr$),
        ('summary', $expr$(projection ->> 'summary'::text)$expr$),
        ('location', $expr$(projection -> 'location'::text)$expr$),
        ('geohash', $expr$((projection -> 'location'::text) ->> 'geohash'::text)$expr$),
        ('lat', $expr$(((projection -> 'location'::text) ->> 'lat'::text))::double precision$expr$),
        ('lng', $expr$(((projection -> 'location'::text) ->> 'lng'::text))::double precision$expr$),
        (
          'claims',
          $expr$
CASE
    WHEN (jsonb_typeof((projection -> 'claims'::text)) = 'array'::text) THEN (projection -> 'claims'::text)
    ELSE '[]'::jsonb
END$expr$
        ),
        (
          'related',
          $expr$
CASE
    WHEN (jsonb_typeof((projection -> 'related'::text)) = 'array'::text) THEN (projection -> 'related'::text)
    ELSE '[]'::jsonb
END$expr$
        ),
        ('primary_image', $expr$(projection -> 'primaryImage'::text)$expr$),
        (
          'taxonomy',
          $expr$((jsonb_set(jsonb_set('{}'::jsonb, '{topicIds}'::text[], COALESCE((projection -> 'topicIds'::text), '[]'::jsonb)), '{topicTags}'::text[], COALESCE((projection -> 'topicTags'::text), '[]'::jsonb)) ||
CASE
    WHEN (projection ? 'notabilityLabels'::text) THEN jsonb_set('{}'::jsonb, '{notabilityLabels}'::text[], (projection -> 'notabilityLabels'::text))
    ELSE '{}'::jsonb
END) ||
CASE
    WHEN (jsonb_array_length(COALESCE((projection -> 'campaignIds'::text), '[]'::jsonb)) > 0) THEN jsonb_set('{}'::jsonb, '{campaignIds}'::text[], (projection -> 'campaignIds'::text))
    ELSE '{}'::jsonb
END)$expr$
        )
    )
    SELECT string_agg(e.column_name, ', ' ORDER BY e.column_name)
    INTO mismatches
    FROM expected e
    JOIN pg_attribute a
      ON a.attrelid = target
     AND a.attname = e.column_name
     AND a.attnum > 0
     AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d
      ON d.adrelid = a.attrelid
     AND d.adnum = a.attnum
    WHERE d.adbin IS NULL
       OR regexp_replace(pg_get_expr(d.adbin, d.adrelid), '\s+', ' ', 'g')
       <> regexp_replace(e.generation_expression, '\s+', ' ', 'g');

    IF mismatches IS NOT NULL THEN
      RAISE EXCEPTION
        'Refusing to accept unexpected generated expressions on published.release_entities: %',
        mismatches;
    END IF;
  ELSIF ordinary_count = cardinality(target_columns) THEN
    -- Views depend on the columns and must be removed before the conversion.
    -- Drop the evidence view chain explicitly; CASCADE could erase an unknown consumer.
    EXECUTE 'DROP VIEW IF EXISTS evidence.source_library_unmapped_hosts';
    EXECUTE 'DROP VIEW IF EXISTS evidence.source_library';
    EXECUTE 'DROP VIEW IF EXISTS evidence.published_citations';
    EXECUTE 'DROP VIEW IF EXISTS public.published_entities';
    EXECUTE 'DROP VIEW IF EXISTS ops.coverage_gap_by_county_decade';

    EXECUTE $ddl$
      ALTER TABLE published.release_entities
        DROP COLUMN display_name,
        DROP COLUMN kind,
        DROP COLUMN summary,
        DROP COLUMN location,
        DROP COLUMN geohash,
        DROP COLUMN lat,
        DROP COLUMN lng,
        DROP COLUMN claims,
        DROP COLUMN taxonomy,
        DROP COLUMN related,
        DROP COLUMN primary_image
    $ddl$;

    EXECUTE $ddl$
      ALTER TABLE published.release_entities
        ADD COLUMN display_name text NOT NULL
          GENERATED ALWAYS AS (projection ->> 'displayName') STORED,
        ADD COLUMN kind text NOT NULL
          GENERATED ALWAYS AS (projection ->> 'kind') STORED,
        ADD COLUMN summary text
          GENERATED ALWAYS AS (projection ->> 'summary') STORED,
        ADD COLUMN location jsonb
          GENERATED ALWAYS AS (projection -> 'location') STORED,
        ADD COLUMN geohash text
          GENERATED ALWAYS AS (projection -> 'location' ->> 'geohash') STORED,
        ADD COLUMN lat double precision
          GENERATED ALWAYS AS ((projection -> 'location' ->> 'lat')::double precision) STORED,
        ADD COLUMN lng double precision
          GENERATED ALWAYS AS ((projection -> 'location' ->> 'lng')::double precision) STORED,
        ADD COLUMN claims jsonb NOT NULL
          GENERATED ALWAYS AS (
            CASE WHEN jsonb_typeof(projection -> 'claims') = 'array'
              THEN projection -> 'claims' ELSE '[]'::jsonb END
          ) STORED,
        ADD COLUMN related jsonb NOT NULL
          GENERATED ALWAYS AS (
            CASE WHEN jsonb_typeof(projection -> 'related') = 'array'
              THEN projection -> 'related' ELSE '[]'::jsonb END
          ) STORED,
        ADD COLUMN primary_image jsonb
          GENERATED ALWAYS AS (projection -> 'primaryImage') STORED,
        ADD COLUMN taxonomy jsonb NOT NULL
          GENERATED ALWAYS AS (
            jsonb_set(
              jsonb_set(
                '{}'::jsonb,
                '{topicIds}',
                COALESCE(projection -> 'topicIds', '[]'::jsonb)
              ),
              '{topicTags}',
              COALESCE(projection -> 'topicTags', '[]'::jsonb)
            )
            || CASE
                 WHEN projection ? 'notabilityLabels'
                   THEN jsonb_set('{}'::jsonb, '{notabilityLabels}', projection -> 'notabilityLabels')
                 ELSE '{}'::jsonb
               END
            || CASE
                 WHEN jsonb_array_length(COALESCE(projection -> 'campaignIds', '[]'::jsonb)) > 0
                   THEN jsonb_set('{}'::jsonb, '{campaignIds}', projection -> 'campaignIds')
                 ELSE '{}'::jsonb
               END
          ) STORED
    $ddl$;
  ELSE
    RAISE EXCEPTION
      'Refusing mixed generated/ordinary state on published.release_entities (% generated, % ordinary)',
      generated_count,
      ordinary_count;
  END IF;
END;
$migration$;

CREATE INDEX IF NOT EXISTS release_entities_geohash_idx
  ON published.release_entities (release_id, geohash);
CREATE INDEX IF NOT EXISTS release_entities_release_display_name_lower_idx
  ON published.release_entities (release_id, lower(display_name));

CREATE OR REPLACE VIEW public.published_entities
  WITH (security_invoker = true) AS
  SELECT
    release_id,
    entity_id,
    display_name,
    kind,
    summary,
    location,
    geohash,
    lat,
    lng,
    claims,
    taxonomy,
    related,
    primary_image,
    projection,
    created_at
  FROM published.release_entities re
  WHERE release_id = (
    SELECT ar.release_id FROM published.active_release ar WHERE ar.id = 'active'
  );

GRANT SELECT ON public.published_entities TO anon, authenticated;
GRANT ALL ON public.published_entities TO service_role;

COMMENT ON VIEW public.published_entities IS
  'Active-release public read surface for attested PostgREST clients. Every column but projection, '
  'entity_id, release_id and created_at is GENERATED from projection, so this view and the '
  'projection the web and API read paths serve cannot disagree.';

CREATE OR REPLACE VIEW ops.coverage_gap_by_county_decade AS
  WITH county_entity_counts AS (
    SELECT
      COALESCE(
        NULLIF(re.location ->> 'countyFips', ''),
        NULLIF(re.projection -> 'county' ->> 'fipsCode', '')
      ) AS fips5,
      count(*) AS entity_count
    FROM published.release_entities re
    WHERE re.release_id = (
      SELECT ar.release_id FROM published.active_release ar WHERE ar.id = 'active'
    )
    GROUP BY 1
  )
  SELECT
    c.fips5,
    c.decade,
    COALESCE((c.payload ->> 'blackPopulation')::bigint, 0::bigint) AS black_population,
    COALESCE(e.entity_count, 0::bigint) AS entity_count,
    CASE
      WHEN COALESCE((c.payload ->> 'blackPopulation')::bigint, 0::bigint) > 0
        THEN round(COALESCE(e.entity_count, 0::bigint)::numeric / (c.payload ->> 'blackPopulation')::numeric, 9)
      ELSE NULL::numeric
    END AS coverage_ratio,
    c.source,
    c.retrieved_at
  FROM reference.census_county_decades c
  LEFT JOIN county_entity_counts e ON e.fips5 = c.fips5
  WHERE access_control.is_staff() OR (auth.jwt() ->> 'role') = 'service_role';

GRANT SELECT ON ops.coverage_gap_by_county_decade TO authenticated;
GRANT ALL ON ops.coverage_gap_by_county_decade TO service_role;

-- Restore the source-library view chain after an ordinary-column conversion.
-- CREATE OR REPLACE also verifies the expected definitions on an existing generated schema.
CREATE OR REPLACE VIEW evidence.published_citations
WITH (security_invoker = true) AS
WITH claim_rows AS (
  SELECT
    re.release_id,
    re.entity_id,
    re.kind                          AS entity_kind,
    re.display_name                  AS entity_display_name,
    c.claim ->> 'id'                 AS claim_id,
    c.claim ->> 'claimRole'          AS claim_role,
    c.claim ->> 'citationHref'       AS citation_href,
    c.claim ->> 'citationSource'     AS citation_source,
    c.claim ->> 'citationLabel'      AS citation_label,
    c.claim ->> 'confidenceLevel'    AS confidence_level,
    evidence.citation_host(c.claim ->> 'citationHref') AS host
  FROM published.active_release ar
  JOIN published.release_entities re ON re.release_id = ar.release_id
  CROSS JOIN LATERAL jsonb_array_elements(re.claims) AS c (claim)
  WHERE ar.id = 'active'
    AND (current_user <> 'authenticated' OR access_control.is_staff())
),
distinct_hosts AS (
  SELECT DISTINCT cr.host, string_to_array(cr.host, '.') AS parts
  FROM claim_rows cr
  WHERE cr.host IS NOT NULL
),
host_suffixes AS (
  SELECT dh.host, s.i, array_to_string(dh.parts[s.i:], '.') AS suffix
  FROM distinct_hosts dh
  CROSS JOIN LATERAL generate_series(1, cardinality(dh.parts)) AS s (i)
),
best_domain AS (
  SELECT DISTINCT ON (hs.host)
    hs.host,
    d.organization_id
  FROM host_suffixes hs
  JOIN evidence.source_domains d
    ON regexp_replace(lower(d.hostname), '^www\.', '') = hs.suffix
  ORDER BY hs.host, hs.i, (lower(d.hostname) LIKE 'www.%'), d.organization_id
),
host_organizations AS (
  SELECT
    bd.host,
    evidence.resolve_source_organization_root(bd.organization_id) AS organization_id
  FROM best_domain bd
)
SELECT
  cr.release_id,
  cr.entity_id,
  cr.entity_kind,
  cr.entity_display_name,
  cr.claim_id,
  cr.claim_role,
  cr.citation_href,
  cr.citation_source,
  cr.citation_label,
  cr.confidence_level,
  cr.host,
  ho.organization_id
FROM claim_rows cr
LEFT JOIN host_organizations ho ON ho.host = cr.host;

COMMENT ON VIEW evidence.published_citations IS
  'Staff-only. One row per published claim in the active release with its citation host and '
  'resolved library organization (NULL when no source_domains entry matches). Host resolution '
  'is set-based here and must agree with evidence.resolve_citation_host_organization.';

CREATE OR REPLACE VIEW evidence.source_library
WITH (security_invoker = true) AS
WITH org_roots AS (
  SELECT
    o.id AS organization_id,
    evidence.resolve_source_organization_root(o.id) AS root_id
  FROM evidence.source_organizations o
),
published_counts AS (
  SELECT
    pc.organization_id AS root_id,
    count(DISTINCT pc.entity_id)::int AS published_entities,
    count(*)::int                     AS published_claims
  FROM evidence.published_citations pc
  WHERE pc.organization_id IS NOT NULL
  GROUP BY pc.organization_id
),
hosts AS (
  SELECT
    r.root_id,
    array_agg(DISTINCT d.hostname ORDER BY d.hostname) AS hosts
  FROM org_roots r
  JOIN evidence.source_domains d ON d.organization_id = r.organization_id
  GROUP BY r.root_id
),
sources AS (
  SELECT
    r.root_id,
    count(DISTINCT es.id)::int AS evidence_sources,
    count(DISTINCT si.id)::int AS source_items
  FROM org_roots r
  JOIN evidence.evidence_sources es ON es.organization_id = r.organization_id
  LEFT JOIN evidence.source_items si ON si.source_id = es.id
  GROUP BY r.root_id
),
canonical_counts AS (
  SELECT
    r.root_id,
    count(DISTINCT cl.entity_id)::int AS canonical_entities
  FROM org_roots r
  JOIN evidence.evidence_sources es ON es.organization_id = r.organization_id
  JOIN evidence.source_items si ON si.source_id = es.id
  JOIN evidence.evidence_records er ON er.source_item_id = si.id
  JOIN canonical.claim_evidence_links cel ON cel.evidence_id = er.id
  JOIN canonical.claims cl ON cl.id = cel.claim_id
  GROUP BY r.root_id
),
merged AS (
  SELECT
    r.root_id,
    array_agg(r.organization_id ORDER BY r.organization_id) AS merged_organization_ids
  FROM org_roots r
  WHERE r.organization_id <> r.root_id
  GROUP BY r.root_id
)
SELECT
  o.id AS organization_id,
  o.name,
  o.homepage,
  o.parent_organization_id,
  o.publisher_kind,
  o.tier,
  o.summary,
  o.relevance,
  o.limitations,
  o.profile_sources,
  o.profile_reviewed_at,
  o.profile_reviewed_by,
  COALESCE(h.hosts, '{}'::text[])                    AS hosts,
  COALESCE(p.published_entities, 0)                  AS published_entities,
  COALESCE(p.published_claims, 0)                    AS published_claims,
  COALESCE(c.canonical_entities, 0)                  AS canonical_entities,
  COALESCE(s.evidence_sources, 0)                    AS evidence_sources,
  COALESCE(s.source_items, 0)                        AS source_items,
  COALESCE(m.merged_organization_ids, '{}'::text[]) AS merged_organization_ids
FROM evidence.source_organizations o
LEFT JOIN published_counts p ON p.root_id = o.id
LEFT JOIN hosts h            ON h.root_id = o.id
LEFT JOIN sources s          ON s.root_id = o.id
LEFT JOIN canonical_counts c ON c.root_id = o.id
LEFT JOIN merged m           ON m.root_id = o.id
WHERE o.merged_into_organization_id IS NULL;

COMMENT ON VIEW evidence.source_library IS
  'Staff-only. One row per surviving source organization with its profile and live counts: '
  'published entities and claims in the active release, canonical entities reached through the '
  'evidence chain, evidence sources and source items. Merged organizations roll into the survivor.';

CREATE OR REPLACE VIEW evidence.source_library_unmapped_hosts
WITH (security_invoker = true) AS
SELECT
  pc.host,
  count(DISTINCT pc.entity_id)::int AS published_entities,
  count(*)::int                     AS published_claims,
  min(pc.citation_href)             AS sample_href
FROM evidence.published_citations pc
WHERE pc.organization_id IS NULL
GROUP BY pc.host;

COMMENT ON VIEW evidence.source_library_unmapped_hosts IS
  'Staff-only. Citation hosts in the active release that resolve to no library organization, '
  'the add-a-domain work queue. A NULL host groups citations whose href is not an absolute URL.';

REVOKE ALL ON evidence.published_citations FROM PUBLIC, anon;
REVOKE ALL ON evidence.source_library FROM PUBLIC, anon;
REVOKE ALL ON evidence.source_library_unmapped_hosts FROM PUBLIC, anon;
GRANT SELECT ON evidence.published_citations TO authenticated, service_role;
GRANT SELECT ON evidence.source_library TO authenticated, service_role;
GRANT SELECT ON evidence.source_library_unmapped_hosts TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS published.release_entity_redirects (
  release_id text NOT NULL REFERENCES publication.releases (id),
  from_entity_id text NOT NULL,
  to_entity_id text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, from_entity_id),
  CONSTRAINT release_entity_redirects_no_self_redirect CHECK (from_entity_id <> to_entity_id)
);

CREATE INDEX IF NOT EXISTS release_entity_redirects_target_idx
  ON published.release_entity_redirects (release_id, to_entity_id);

ALTER TABLE published.release_entity_redirects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS release_entity_redirects_select_active
  ON published.release_entity_redirects;
CREATE POLICY release_entity_redirects_select_active
  ON published.release_entity_redirects
  FOR SELECT TO anon, authenticated
  USING (
    release_id = (SELECT release_id FROM published.active_release WHERE id = 'active')
  );

GRANT SELECT ON published.release_entity_redirects TO anon, authenticated, service_role;
GRANT ALL ON published.release_entity_redirects TO service_role;
REVOKE INSERT, UPDATE, DELETE ON published.release_entity_redirects
  FROM PUBLIC, anon, authenticated;
