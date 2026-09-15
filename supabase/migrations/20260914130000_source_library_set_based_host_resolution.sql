-- 20260914130000_source_library_set_based_host_resolution
--
-- published_citations resolved each distinct citation host by calling
-- bb_evidence.resolve_citation_host_organization once per host. That function is not
-- inlinable, so 788 hosts cost about 2.5s and every source library view paid it.
-- This replaces the per-host call with one set-based join that applies the same rule:
-- longest www-stripped domain suffix wins; on a tie the bare hostname wins, then the lower
-- organization id; the winner is followed through merges. The function stays for
-- single-host lookups and must keep matching this view.

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
  JOIN bb_evidence.source_domains d
    ON regexp_replace(lower(d.hostname), '^www\.', '') = hs.suffix
  ORDER BY hs.host, hs.i, (lower(d.hostname) LIKE 'www.%'), d.organization_id
),
host_organizations AS (
  SELECT
    bd.host,
    bb_evidence.resolve_source_organization_root(bd.organization_id) AS organization_id
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

COMMENT ON VIEW bb_evidence.published_citations IS
  'Staff-only. One row per published claim in the active release with its citation host and '
  'resolved library organization (NULL when no source_domains entry matches). Host resolution '
  'is set-based here and must agree with bb_evidence.resolve_citation_host_organization.';
