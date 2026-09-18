/**
 * Source display classification and independently reviewed publication confidence.
 * Host heuristics do not establish support for a claim.
 */
import type { ReleaseSourceClaim, ReleaseSourceEntity } from '@repo/domain';
import { validateContract, type ConfidenceAssessment } from '@repo/research-kernel';
import type { PoolClient } from 'pg';
import { isPatentDocumentUrl } from '@repo/domain-core/claims/lineage';
import { lookupSourceRegister } from './source-register.ts';
import { isReputableSecondaryHost, isTier1Host, isWikipediaHost } from './tier1-sources.ts';

/** Classifies parsed hostnames, so URL paths and query strings cannot affect host rules. */
const GOVERNMENT_TLDS = ['gov', 'mil'];
const GOVERNMENT_DOMAINS = ['si.edu'];
const ARCHIVAL_DOMAINS = ['rosenwald.fisk.edu', 'archive.org'];

/**
 * Substrings of a *hostname label*, not of the whole URL. A newspaper's masthead shows up in
 * its domain (nytimes.com, chicagotribune.com), so the hint has to match inside a label rather
 * than against the whole name — but it is matched per label, so a path or query cannot smuggle
 * "times" into the decision.
 */
const NEWS_HOST_HINTS = ['news', 'times', 'post', 'tribune', 'gazette', 'herald'];

function hostUnderTld(hostname: string, tld: string): boolean {
  return hostname.endsWith(`.${tld}`);
}

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * Source-class display heuristic. Government records and patent specifications receive
 * high, Wikipedia receives low, and other sources receive medium. This does not assess
 * whether a particular source supports a particular claim.
 */
export function confidenceLevelForSource(url: string | undefined): 'high' | 'medium' | 'low' {
  if (url === undefined || url.trim().length === 0) return 'low';
  if (isWikipediaHost(url)) return 'low';
  return classifySourceForConfidence(url) === 'government_record' ? 'high' : 'medium';
}

/** Maps a source URL to the product constitution's sourceClassifications vocabulary. */
export function classifySourceForConfidence(url: string): string {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return 'unknown';
  }
  if (
    GOVERNMENT_TLDS.some((tld) => hostUnderTld(hostname, tld)) ||
    GOVERNMENT_DOMAINS.some((domain) => hostMatches(hostname, domain))
  )
    return 'government_record';
  // A patent specification is the same government grant whichever mirror serves it —
  // `resolveSourceLineage` (packages/domain-core/src/claims/lineage.ts) already collapses
  // uspto.gov and patents.google.com onto one lineage for exactly this reason. This
  // classification follows the same logic: it grades the DOCUMENT, not the host serving it, so
  // a patent read on patents.google.com must not grade lower than the identical text read on
  // uspto.gov. `isPatentDocumentUrl` only matches an individual patent document (a resolvable
  // patent number) — a search page or the mirror's home page falls through to the classification
  // below, same as any other unrecognized page on that host.
  if (isPatentDocumentUrl(url)) return 'government_record';
  if (
    ARCHIVAL_DOMAINS.some((domain) => hostMatches(hostname, domain)) ||
    hostUnderTld(hostname, 'edu')
  ) {
    // University archival collections hold scanned original records; general .edu pages
    // (e.g. an alma mater mentioned in passing) do not carry the same evidentiary weight,
    // but distinguishing that would need page-content classification this function doesn't
    // have — treat .edu as reputable_secondary, the conservative (lower-authority) choice.
    return 'reputable_secondary';
  }
  if (isWikipediaHost(url)) return 'reputable_secondary';
  // The source register (scripts/lib/source-register.json) is consulted before the curated
  // suffix list, because a register entry says WHY a host counts — a Wikidata item with an
  // authority-control identifier that names this host as its own official website — and the
  // curated list only records that somebody once decided it did. Where both would answer, the
  // one with a basis wins, and it can also grade a host DOWN: a newspaper registered here is
  // news_reportage even though the curated list would have called it reputable_secondary.
  const registered = lookupSourceRegister(hostname);
  if (registered) return registered.sourceClass;
  if (isReputableSecondaryHost(url)) return 'reputable_secondary';
  const labels = hostname.split('.');
  if (NEWS_HOST_HINTS.some((hint) => labels.some((label) => label.includes(hint))))
    return 'news_reportage';
  return 'unknown';
}

/** A database-reviewed assessment of one immutable claim version. Never load from model payloads. */
export type ReviewedClaimAssessment = {
  readonly entityId: string;
  readonly claimId: string;
  readonly claimVersionId: string;
  readonly predicate: string;
  readonly object: string;
  readonly citationHrefs: readonly string[];
  readonly assessmentId: string;
  readonly reviewDecisionId: string;
  readonly assessment: ConfidenceAssessment;
};

/**
 * Review must cover the current version, latest assessment and every evidence assignment.
 * A newer rejection, correction, assessment or assignment invalidates an older approval.
 * Source URLs come from reviewed, captured selectors; a projection citation is not evidence.
 */
export const REVIEWED_CLAIM_ASSESSMENTS_SQL = `
SELECT c.entity_id AS "entityId", c.id AS "claimId", v.id AS "claimVersionId",
       v.predicate, v.object, ca.id AS "assessmentId", review.id AS "reviewDecisionId",
       jsonb_build_object(
         'acceptanceProbability', ca.acceptance_probability,
         'intervalLow', ca.interval_low, 'intervalHigh', ca.interval_high,
         'sourceReliability', ca.source_reliability, 'entailment', ca.entailment,
         'independence', ca.independence, 'identityConfidence', ca.identity_confidence,
         'relevance', ca.relevance, 'researchCompleteness', ca.research_completeness,
         'calibrationVersion', ca.calibration_version
       ) AS assessment,
       ARRAY(
         SELECT DISTINCT si.url
         FROM canonical.evidence_assignments ea
         JOIN evidence.evidence_selectors es ON es.id = ea.selector_id
         JOIN evidence.capture_origins origin ON origin.capture_id = es.capture_id
           AND origin.source_item_id = es.source_item_id AND origin.retention_revoked_at IS NULL
         JOIN evidence.source_items si ON si.id = origin.source_item_id
         WHERE ea.claim_version_id = v.id AND ea.status = 'accepted'
           AND ea.role = 'supporting' AND ea.fitness IN ('authoritative', 'strong', 'conditional')
           AND nullif(btrim(ea.reviewer_actor_id), '') IS NOT NULL
           AND nullif(btrim(si.url), '') IS NOT NULL
       ) AS "citationHrefs"
FROM canonical.claims c
JOIN canonical.claim_versions v ON v.id = c.current_version_id AND v.claim_id = c.id
JOIN LATERAL (
  SELECT a.* FROM canonical.claim_confidence_assessments a
  WHERE a.claim_version_id = v.id ORDER BY a.created_at DESC, a.id DESC LIMIT 1
) ca ON true
JOIN LATERAL (
  SELECT r.*, artifact.status AS artifact_status
  FROM research.artifact_claims ac
  JOIN research.artifacts artifact ON artifact.id = ac.artifact_id
  JOIN research.review_decisions r ON r.artifact_id = artifact.id
  WHERE ac.claim_version_id = v.id
  ORDER BY r.decided_at DESC, r.id DESC LIMIT 1
) review ON true
WHERE c.entity_id = ANY($1::text[])
  AND c.workflow_status = 'accepted' AND v.workflow_status = 'accepted'
  AND review.decision = 'approve' AND review.artifact_status = 'accepted'
  AND review.reviewer_actor_id <> review.producer_actor_id
  AND nullif(btrim(review.reviewer_actor_id), '') IS NOT NULL
  AND ca.created_at <= review.decided_at
  AND NOT EXISTS (
    SELECT 1 FROM canonical.claim_tombstones t WHERE t.claim_version_id = v.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM canonical.evidence_assignments ea
    WHERE ea.claim_version_id = v.id AND ea.created_at > review.decided_at
  )
`;

export async function loadReviewedClaimAssessments(
  client: Pick<PoolClient, 'query'>,
  entityIds: readonly string[],
): Promise<readonly ReviewedClaimAssessment[]> {
  if (entityIds.length === 0) return [];
  const result = await client.query<ReviewedClaimAssessment>(REVIEWED_CLAIM_ASSESSMENTS_SQL, [
    entityIds,
  ]);
  return result.rows.filter((row) => validReviewedAssessment(row));
}

function validReviewedAssessment(row: ReviewedClaimAssessment): boolean {
  const result = validateContract('ConfidenceAssessment', row.assessment);
  if (!result.ok) return false;
  const assessment = result.value;
  return Boolean(
    row.entityId &&
    row.claimId &&
    row.claimVersionId &&
    row.assessmentId &&
    row.reviewDecisionId &&
    typeof row.object === 'string' &&
    row.citationHrefs.length > 0 &&
    assessment.calibrationVersion.trim() &&
    !/uncalibrated|placeholder|unknown/i.test(assessment.calibrationVersion) &&
    assessment.intervalLow <= assessment.acceptanceProbability &&
    assessment.acceptanceProbability <= assessment.intervalHigh,
  );
}

export type PublicationClaimAssessment =
  | { readonly ok: true; readonly score: number; readonly claims: readonly ReleaseSourceClaim[] }
  | { readonly ok: false; readonly detail: string };

/**
 * Every public assertion must match one reviewed version, including its cited source.
 * The conservative interval bound is a release gate, not a model self-score or host heuristic.
 */
export function assessPublicationClaims(
  entry: Pick<ReleaseSourceEntity, 'id' | 'claims'>,
  reviewed: readonly ReviewedClaimAssessment[],
): PublicationClaimAssessment {
  if (!entry.claims?.length) return { ok: false, detail: 'No assessed claims' };
  const claims: ReleaseSourceClaim[] = [];
  let score = 1;
  for (const claim of entry.claims) {
    const matches = reviewed.filter(
      (row) =>
        validReviewedAssessment(row) &&
        row.entityId === entry.id &&
        (claim.id === undefined || row.claimId === claim.id) &&
        row.predicate === claim.predicate &&
        row.object === claim.object &&
        claim.citationHref !== undefined &&
        row.citationHrefs.includes(claim.citationHref),
    );
    if (matches.length !== 1) {
      return {
        ok: false,
        detail: `Claim requires an exact, independently reviewed assessment: ${claim.predicate}`,
      };
    }
    const match = matches[0]!;
    score = Math.min(score, match.assessment.intervalLow);
    claims.push({ ...claim, id: match.claimId });
  }
  return { ok: true, score, claims };
}

export { isTier1Host };
