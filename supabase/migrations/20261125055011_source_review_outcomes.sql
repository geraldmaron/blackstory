-- How independent claim review has gone for each publisher, computed at read time like the rest
-- of the source library. One row per publisher host: the number of model reviews in which a claim
-- citing it was approved, and the number in which one was rejected. Deterministic script reviews
-- are excluded. A rejection can mean the draft overreached, not that the source is poor, so
-- this is a place to look, never a ranking or an acceptance rule.
CREATE VIEW evidence.source_review_outcomes WITH (security_invoker = true) AS
WITH decided AS (
  SELECT d.id, d.decision, d.decided_at, coalesce(si.url, f ->> 'citationHref') AS href
  FROM research.review_decisions d
  JOIN research.artifacts a ON a.id = d.artifact_id AND a.artifact_type = 'claim-review-packet'
  LEFT JOIN research.artifact_claims ac ON ac.artifact_id = a.id AND d.decision = 'approve'
  LEFT JOIN canonical.evidence_assignments ea ON ea.claim_version_id = ac.claim_version_id
  LEFT JOIN evidence.evidence_selectors es ON es.id = ea.selector_id
  LEFT JOIN evidence.source_items si ON si.id = es.source_item_id
  LEFT JOIN LATERAL jsonb_array_elements(
    CASE WHEN d.decision = 'reject' AND jsonb_typeof(d.findings) = 'array'
      THEN d.findings ELSE '[]'::jsonb END) f ON true
  WHERE d.reviewer_actor_id NOT LIKE 'script:%'
), hosted AS (
  SELECT DISTINCT id, decision, decided_at, evidence.citation_host(href) AS host
  FROM decided WHERE href IS NOT NULL
)
SELECT
  evidence.resolve_citation_host_organization(h.host) AS organization_id,
  h.host,
  count(*) FILTER (WHERE h.decision = 'approve') AS reviews_approved,
  count(*) FILTER (WHERE h.decision = 'reject') AS reviews_rejected,
  max(h.decided_at) AS last_reviewed_at
FROM hosted h
GROUP BY 1, 2;

REVOKE ALL ON evidence.source_review_outcomes FROM PUBLIC, anon;
GRANT SELECT ON evidence.source_review_outcomes TO authenticated, service_role, admin_app;
COMMENT ON VIEW evidence.source_review_outcomes IS 'Per publisher host: model claim reviews approved and rejected. Read-time counts; not a ranking.';
