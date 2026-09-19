-- 20260914120000_source_library: a living source library over bb_evidence.
--
-- Counts are never stored. Every number below is computed at read time from what
-- the ACTIVE release publishes (bb_public.active_release id = 'active' ->
-- bb_public.release_entities.claims) and from the canonical evidence chain.
--
-- What this adds:
--   1. Curated profile columns on bb_evidence.source_organizations (publisher kind,
--      tier, summary, relevance, limitations, provenance of the profile) plus a
--      parent link and a non-destructive merge tombstone for deduplication.
--   2. bb_evidence.source_policies.organization_id, so a publisher policy and its
--      per-evidence-use fitness rows attach to a library organization.
--   3. Host resolution: bb_evidence.citation_host(href) parses a citation URL,
--      bb_evidence.resolve_citation_host_organization(host) maps a host to an
--      organization by longest domain suffix, then follows merges to the survivor.
--   4. Views: published_citations, source_library, source_library_unmapped_hosts,
--      source_library_fitness.
--
-- Access (docs/decisions-carryover.md, "Research and discovery cannot publish"):
--   * Staff and service_role only. Never anon. anon has no USAGE on bb_evidence, and
--     every object here also revokes anon and PUBLIC explicitly.
--   * Views use security_invoker = true, so base-table RLS applies to the caller
--     (bb_evidence and bb_canonical rows are staff-gated by bb_auth.has_any_role).
--     published_citations reads bb_public.release_entities, which any authenticated
--     user can read for the active release, so each view that starts from it also
--     carries an in-view predicate: a caller running as `authenticated` must be staff
--     (bb_auth.is_staff() reads the JWT). Other roles that can reach the view at all
--     (service_role, and the direct Postgres connection the admin app and operator scripts
--     use, which carries no JWT) are already trusted by their grants, so the predicate
--     does not filter them. Gating on auth.role() instead would hide every row from those
--     direct connections.
--
-- Invariant the views keep: sum(source_library.published_claims) plus
-- sum(source_library_unmapped_hosts.published_claims) equals the active release's
-- total claim count. A merge chain that forms a cycle breaks it (no survivor has
-- merged_into_organization_id IS NULL); the CHECK below only rules out self-merges,
-- so tooling that writes merges must keep chains acyclic.

-- ---------------------------------------------------------------------------
-- 1. Organization profile columns
-- ---------------------------------------------------------------------------
ALTER TABLE bb_evidence.source_organizations
  ADD COLUMN parent_organization_id text
    REFERENCES bb_evidence.source_organizations (id),
  ADD COLUMN merged_into_organization_id text
    REFERENCES bb_evidence.source_organizations (id),
  ADD COLUMN publisher_kind text,
  ADD COLUMN tier text,
  ADD COLUMN summary text,
  ADD COLUMN relevance text,
  ADD COLUMN limitations text[] NOT NULL DEFAULT '{}',
  ADD COLUMN profile_sources text[] NOT NULL DEFAULT '{}',
  ADD COLUMN profile_reviewed_at timestamptz,
  ADD COLUMN profile_reviewed_by text,
  ADD CONSTRAINT source_organizations_merged_into_not_self_check
    CHECK (merged_into_organization_id IS NULL OR merged_into_organization_id <> id),
  ADD CONSTRAINT source_organizations_parent_not_self_check
    CHECK (parent_organization_id IS NULL OR parent_organization_id <> id),
  ADD CONSTRAINT source_organizations_publisher_kind_check
    CHECK (publisher_kind IS NULL OR publisher_kind IN (
      'government_archive',
      'government_agency',
      'court_legal',
      'academic_library_archive',
      'museum',
      'encyclopedia_reference',
      'news_media',
      'nonprofit_heritage',
      'wiki_crowd',
      'commercial_database',
      'other'
    )),
  ADD CONSTRAINT source_organizations_tier_check
    CHECK (tier IS NULL OR tier IN ('tier1', 'tier2', 'tier3'));

COMMENT ON COLUMN bb_evidence.source_organizations.parent_organization_id IS
  'Owning or umbrella organization (for example a state archive under a state agency). '
  'Display hierarchy only; counts do not roll up through it.';
COMMENT ON COLUMN bb_evidence.source_organizations.merged_into_organization_id IS
  'Non-destructive dedup tombstone. A merged organization keeps its row, domains and '
  'evidence sources; the source library reports them under the survivor. Keep chains acyclic.';
COMMENT ON COLUMN bb_evidence.source_organizations.publisher_kind IS
  'What kind of publisher this is. NULL until profiled.';
COMMENT ON COLUMN bb_evidence.source_organizations.tier IS
  'Editorial trust tier (tier1 strongest). NULL until profiled.';
COMMENT ON COLUMN bb_evidence.source_organizations.summary IS
  'Short plain-language description of the publisher.';
COMMENT ON COLUMN bb_evidence.source_organizations.relevance IS
  'Why this publisher matters for Black history research.';
COMMENT ON COLUMN bb_evidence.source_organizations.limitations IS
  'Known weaknesses a researcher should weigh when citing this publisher.';
COMMENT ON COLUMN bb_evidence.source_organizations.profile_sources IS
  'URLs the profile text was written from.';
COMMENT ON COLUMN bb_evidence.source_organizations.profile_reviewed_at IS
  'When the profile was last reviewed.';
COMMENT ON COLUMN bb_evidence.source_organizations.profile_reviewed_by IS
  'Who (person or agent lane) last reviewed the profile.';

CREATE INDEX source_organizations_parent_organization_id_idx
  ON bb_evidence.source_organizations (parent_organization_id)
  WHERE parent_organization_id IS NOT NULL;
CREATE INDEX source_organizations_merged_into_organization_id_idx
  ON bb_evidence.source_organizations (merged_into_organization_id)
  WHERE merged_into_organization_id IS NOT NULL;

-- Host lookups match on the www-stripped, lowercased hostname. The expression must
-- stay byte-identical to the one in resolve_citation_host_organization.
CREATE INDEX source_domains_bare_hostname_idx
  ON bb_evidence.source_domains ((regexp_replace(lower(hostname), '^www\.', '')));

-- ---------------------------------------------------------------------------
-- 2. Publisher policies attach to an organization
-- ---------------------------------------------------------------------------
ALTER TABLE bb_evidence.source_policies
  ADD COLUMN organization_id text REFERENCES bb_evidence.source_organizations (id);

CREATE INDEX source_policies_organization_id_idx
  ON bb_evidence.source_policies (organization_id)
  WHERE organization_id IS NOT NULL;

COMMENT ON COLUMN bb_evidence.source_policies.organization_id IS
  'Library organization this publisher policy describes. NULL for policies that are not '
  'tied to one publisher.';

COMMENT ON COLUMN bb_evidence.source_policy_claim_fitness.claim_class IS
  'For publisher policies (source_policies.organization_id set) this carries the evidence-use '
  'vocabulary: identity_and_life_dates, location_and_address, designation_and_listing, '
  'legal_and_court_record, event_narrative, superlative_or_first, direct_quotation, statistics. '
  'Surfaced as source_library_fitness.evidence_use.';

-- ---------------------------------------------------------------------------
-- 3. Host resolution
-- ---------------------------------------------------------------------------

-- Lowercase hostname of a citation URL, with userinfo, port, a trailing root dot and
-- a leading "www." removed. NULL when the value is not an absolute scheme://host URL.
CREATE OR REPLACE FUNCTION bb_evidence.citation_host(href text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT NULLIF(
    regexp_replace(
      rtrim(
        lower(substring(btrim(href) FROM '^[A-Za-z][A-Za-z0-9+.-]*://(?:[^/?#@]*@)?([^/?#:]+)')),
        '.'
      ),
      '^www\.',
      ''
    ),
    ''
  );
$$;

COMMENT ON FUNCTION bb_evidence.citation_host(text) IS
  'Citation host: lowercase hostname of an absolute URL, port, userinfo and leading www. stripped.';

-- Follow merged_into_organization_id to the surviving organization. Returns the
-- input when it is not merged, and NULL when the id does not exist. Stops after
-- 32 hops or on a repeated id, so a cyclic chain cannot loop forever.
CREATE OR REPLACE FUNCTION bb_evidence.resolve_source_organization_root(organization_id text)
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  WITH RECURSIVE walk (id, merged_into, depth, path) AS (
    SELECT o.id, o.merged_into_organization_id, 0, ARRAY[o.id]
    FROM bb_evidence.source_organizations o
    WHERE o.id = resolve_source_organization_root.organization_id
    UNION ALL
    SELECT o.id, o.merged_into_organization_id, w.depth + 1, w.path || o.id
    FROM walk w
    JOIN bb_evidence.source_organizations o ON o.id = w.merged_into
    WHERE w.depth < 32
      AND NOT (o.id = ANY (w.path))
  )
  SELECT id FROM walk ORDER BY depth DESC LIMIT 1;
$$;

COMMENT ON FUNCTION bb_evidence.resolve_source_organization_root(text) IS
  'Surviving organization id after following merged_into_organization_id.';

-- Map a citation host to a library organization.
-- A domain matches when host = domain or host ends with '.' || domain (both compared
-- lowercased with a leading www. stripped); the longest matching domain wins. When
-- two domains tie after www stripping (for example loc.gov and www.loc.gov registered
-- to different organizations), the bare hostname wins, then the lower organization id.
-- The winner is then resolved through merges to its survivor.
CREATE OR REPLACE FUNCTION bb_evidence.resolve_citation_host_organization(host text)
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  WITH normalized AS (
    SELECT NULLIF(
      regexp_replace(
        rtrim(split_part(lower(btrim(resolve_citation_host_organization.host)), ':', 1), '.'),
        '^www\.',
        ''
      ),
      ''
    ) AS h
  ),
  labels AS (
    SELECT string_to_array(n.h, '.') AS parts
    FROM normalized n
    WHERE n.h IS NOT NULL
  ),
  best AS (
    SELECT d.organization_id
    FROM labels l
    CROSS JOIN LATERAL generate_series(1, cardinality(l.parts)) AS s (i)
    JOIN bb_evidence.source_domains d
      ON regexp_replace(lower(d.hostname), '^www\.', '') = array_to_string(l.parts[s.i:], '.')
    ORDER BY s.i, (lower(d.hostname) LIKE 'www.%'), d.organization_id
    LIMIT 1
  )
  SELECT bb_evidence.resolve_source_organization_root(best.organization_id)
  FROM best;
$$;

COMMENT ON FUNCTION bb_evidence.resolve_citation_host_organization(text) IS
  'Library organization for a citation host: longest www-stripped domain suffix match, '
  'then followed through merges. NULL when no domain matches.';

REVOKE ALL ON FUNCTION bb_evidence.citation_host(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION bb_evidence.resolve_source_organization_root(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION bb_evidence.resolve_citation_host_organization(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bb_evidence.citation_host(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION bb_evidence.resolve_source_organization_root(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION bb_evidence.resolve_citation_host_organization(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. published_citations: one row per claim in the active release
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW bb_evidence.published_citations
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
    bb_evidence.citation_host(c.claim ->> 'citationHref') AS host
  FROM bb_public.active_release ar
  JOIN bb_public.release_entities re ON re.release_id = ar.release_id
  CROSS JOIN LATERAL jsonb_array_elements(re.claims) AS c (claim)
  WHERE ar.id = 'active'
    AND (current_user <> 'authenticated' OR bb_auth.is_staff())
),
host_organizations AS (
  -- Resolve each distinct host once instead of once per claim.
  SELECT
    h.host,
    bb_evidence.resolve_citation_host_organization(h.host) AS organization_id
  FROM (SELECT DISTINCT cr.host FROM claim_rows cr WHERE cr.host IS NOT NULL) h
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

COMMENT ON VIEW bb_evidence.published_citations IS
  'Staff-only. One row per published claim in the active release with its citation host and '
  'resolved library organization (NULL when no source_domains entry matches).';

-- ---------------------------------------------------------------------------
-- 5. source_library: one row per surviving organization
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW bb_evidence.source_library
WITH (security_invoker = true) AS
WITH org_roots AS (
  SELECT
    o.id AS organization_id,
    bb_evidence.resolve_source_organization_root(o.id) AS root_id
  FROM bb_evidence.source_organizations o
),
published AS (
  SELECT
    pc.organization_id AS root_id,
    count(DISTINCT pc.entity_id)::int AS published_entities,
    count(*)::int                     AS published_claims
  FROM bb_evidence.published_citations pc
  WHERE pc.organization_id IS NOT NULL
  GROUP BY pc.organization_id
),
hosts AS (
  SELECT
    r.root_id,
    array_agg(DISTINCT d.hostname ORDER BY d.hostname) AS hosts
  FROM org_roots r
  JOIN bb_evidence.source_domains d ON d.organization_id = r.organization_id
  GROUP BY r.root_id
),
sources AS (
  SELECT
    r.root_id,
    count(DISTINCT es.id)::int AS evidence_sources,
    count(DISTINCT si.id)::int AS source_items
  FROM org_roots r
  JOIN bb_evidence.evidence_sources es ON es.organization_id = r.organization_id
  LEFT JOIN bb_evidence.source_items si ON si.source_id = es.id
  GROUP BY r.root_id
),
canonical AS (
  SELECT
    r.root_id,
    count(DISTINCT cl.entity_id)::int AS canonical_entities
  FROM org_roots r
  JOIN bb_evidence.evidence_sources es ON es.organization_id = r.organization_id
  JOIN bb_evidence.source_items si ON si.source_id = es.id
  JOIN bb_evidence.evidence_records er ON er.source_item_id = si.id
  JOIN bb_canonical.claim_evidence_links cel ON cel.evidence_id = er.id
  JOIN bb_canonical.claims cl ON cl.id = cel.claim_id
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
  COALESCE(h.hosts, '{}'::text[])                  AS hosts,
  COALESCE(p.published_entities, 0)                AS published_entities,
  COALESCE(p.published_claims, 0)                  AS published_claims,
  COALESCE(c.canonical_entities, 0)                AS canonical_entities,
  COALESCE(s.evidence_sources, 0)                  AS evidence_sources,
  COALESCE(s.source_items, 0)                      AS source_items,
  COALESCE(m.merged_organization_ids, '{}'::text[]) AS merged_organization_ids
FROM bb_evidence.source_organizations o
LEFT JOIN published p ON p.root_id = o.id
LEFT JOIN hosts h     ON h.root_id = o.id
LEFT JOIN sources s   ON s.root_id = o.id
LEFT JOIN canonical c ON c.root_id = o.id
LEFT JOIN merged m    ON m.root_id = o.id
WHERE o.merged_into_organization_id IS NULL;

COMMENT ON VIEW bb_evidence.source_library IS
  'Staff-only. One row per surviving source organization with its profile and live counts: '
  'published entities and claims in the active release, canonical entities reached through the '
  'evidence chain, evidence sources and source items. Merged organizations roll into the survivor.';

-- ---------------------------------------------------------------------------
-- 6. source_library_unmapped_hosts: published hosts with no organization
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW bb_evidence.source_library_unmapped_hosts
WITH (security_invoker = true) AS
SELECT
  pc.host,
  count(DISTINCT pc.entity_id)::int AS published_entities,
  count(*)::int                     AS published_claims,
  min(pc.citation_href)             AS sample_href
FROM bb_evidence.published_citations pc
WHERE pc.organization_id IS NULL
GROUP BY pc.host;

COMMENT ON VIEW bb_evidence.source_library_unmapped_hosts IS
  'Staff-only. Citation hosts in the active release that resolve to no library organization, '
  'the add-a-domain work queue. A NULL host groups citations whose href is not an absolute URL.';

-- ---------------------------------------------------------------------------
-- 7. source_library_fitness: per-publisher evidence-use fitness
-- ---------------------------------------------------------------------------
-- A policy id can carry several versions; only its most recently created version is
-- reported. The organization is resolved through merges so fitness follows the survivor.
CREATE OR REPLACE VIEW bb_evidence.source_library_fitness
WITH (security_invoker = true) AS
WITH current_policies AS (
  SELECT DISTINCT ON (sp.id)
    sp.id,
    sp.version,
    sp.organization_id
  FROM bb_evidence.source_policies sp
  WHERE sp.organization_id IS NOT NULL
  ORDER BY sp.id, sp.created_at DESC, sp.version DESC
)
SELECT
  bb_evidence.resolve_source_organization_root(cp.organization_id) AS organization_id,
  cp.id           AS policy_id,
  f.claim_class   AS evidence_use,
  f.fitness,
  f.limitations
FROM current_policies cp
JOIN bb_evidence.source_policy_claim_fitness f
  ON f.source_policy_id = cp.id
 AND f.source_policy_version = cp.version;

COMMENT ON VIEW bb_evidence.source_library_fitness IS
  'Staff-only. Evidence-use fitness (claim_class) for publisher policies attached to a library '
  'organization, current policy version only.';

-- ---------------------------------------------------------------------------
-- 8. Grants: staff (authenticated, RLS and in-view gated) and service_role only
-- ---------------------------------------------------------------------------
REVOKE ALL ON bb_evidence.published_citations FROM PUBLIC, anon;
REVOKE ALL ON bb_evidence.source_library FROM PUBLIC, anon;
REVOKE ALL ON bb_evidence.source_library_unmapped_hosts FROM PUBLIC, anon;
REVOKE ALL ON bb_evidence.source_library_fitness FROM PUBLIC, anon;

GRANT SELECT ON bb_evidence.published_citations TO authenticated, service_role;
GRANT SELECT ON bb_evidence.source_library TO authenticated, service_role;
GRANT SELECT ON bb_evidence.source_library_unmapped_hosts TO authenticated, service_role;
GRANT SELECT ON bb_evidence.source_library_fitness TO authenticated, service_role;
