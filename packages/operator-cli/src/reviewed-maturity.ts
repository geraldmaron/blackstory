/** Build a maturity snapshot from canonical evidence that has completed independent review. */
import {
  assessResearchMaturity,
  type ClaimSnapshot,
  type MaturityEvaluationInput,
  type RecordSnapshot,
  type ResearchMaturityAssessment,
} from '@repo/domain';
import {
  assertionClassForClaim,
  sourceClassForCitation,
  type ReleasedEntity,
} from './research-quality-audit.js';
import { validatePreservationDecision } from './wayback-anchor.js';

type ClaimRow = {
  claim_id: string;
  claim_version_id: string;
  predicate: string;
  object: unknown;
};

type EvidenceRow = ClaimRow & {
  assignment_id: string;
  source_item_id: string;
  source_url: string;
  capture_id: string;
  lineage_cluster_id: string;
  lineage_rationale: string;
  exact_text: string | null;
  start_offset: string | number | null;
  end_offset: string | number | null;
  preservation_decision: unknown;
};

type ReviewRow = {
  reviewer_actor_id: string;
  producer_actor_id: string;
  findings: unknown;
};

type ReviewedMaturityClient = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ readonly rows: readonly Row[] }>;
  release(): void;
};

export type ReviewedMaturityPool = {
  connect(): Promise<ReviewedMaturityClient>;
};

const CLAIMS_SQL = `
SELECT claim.id AS claim_id, version.id AS claim_version_id,
       version.predicate, version.object
FROM canonical.claims claim
JOIN canonical.claim_versions version
  ON version.id=claim.current_version_id AND version.claim_id=claim.id
WHERE claim.entity_id=$1 AND claim.workflow_status='accepted'
  AND version.workflow_status='accepted'
  AND NOT EXISTS (
    SELECT 1 FROM canonical.claim_tombstones tombstone
    WHERE tombstone.claim_version_id=version.id
  )
ORDER BY claim.id`;

/**
 * An accepted assignment is visible to maturity only when a later independent artifact review
 * covers the same immutable claim version. Current rights and an indexed exact passage are
 * required as well; a capture row containing retrieval metadata alone is not a durable copy.
 */
const REVIEWED_EVIDENCE_SQL = `
SELECT claim.id AS claim_id, version.id AS claim_version_id,
       version.predicate, version.object,
       assignment.id AS assignment_id, selector.source_item_id,
       origin.source_url, selector.capture_id, cluster.id AS lineage_cluster_id,
       cluster.rationale AS lineage_rationale, selector.exact_text,
       selector.start_offset, selector.end_offset,
       origin.storage_object->'preservationDecision' AS preservation_decision
FROM canonical.claims claim
JOIN canonical.claim_versions version
  ON version.id=claim.current_version_id AND version.claim_id=claim.id
JOIN canonical.evidence_assignments assignment
  ON assignment.claim_version_id=version.id
 AND assignment.status='accepted' AND assignment.role='supporting'
 AND assignment.fitness IN ('authoritative','strong','conditional')
 AND nullif(btrim(assignment.reviewer_actor_id),'') IS NOT NULL
JOIN evidence.evidence_selectors selector ON selector.id=assignment.selector_id
JOIN evidence.capture_origins origin
  ON origin.capture_id=selector.capture_id
 AND origin.source_item_id=selector.source_item_id
 AND origin.retention_revoked_at IS NULL
JOIN evidence.lineage_clusters cluster ON cluster.id=assignment.lineage_cluster_id
WHERE claim.entity_id=$1 AND claim.workflow_status='accepted'
  AND version.workflow_status='accepted'
  AND nullif(btrim(origin.source_url),'') IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM evidence.retrieval_passages passage
    WHERE passage.capture_id=selector.capture_id
      AND passage.source_item_id=selector.source_item_id
      AND passage.withdrawn_at IS NULL
      AND passage.retention_expires_at>clock_timestamp()
      AND (
        (selector.exact_text IS NOT NULL AND position(selector.exact_text IN passage.body)>0)
        OR (selector.start_offset IS NOT NULL AND selector.end_offset IS NOT NULL
            AND selector.start_offset>=passage.start_offset
            AND selector.end_offset<=passage.end_offset)
      )
  )
  AND EXISTS (
    SELECT 1
    FROM research.artifact_claims membership
    JOIN research.artifacts artifact ON artifact.id=membership.artifact_id
    JOIN LATERAL (
      SELECT decision.* FROM research.review_decisions decision
      WHERE decision.artifact_id=artifact.id
      ORDER BY decision.decided_at DESC, decision.id DESC LIMIT 1
    ) review ON true
    WHERE membership.claim_version_id=version.id
      AND artifact.status='accepted' AND review.decision='approve'
      AND review.reviewer_actor_id<>review.producer_actor_id
      AND review.decided_at>=assignment.created_at
  )
  AND NOT EXISTS (
    SELECT 1 FROM canonical.claim_tombstones tombstone
    WHERE tombstone.claim_version_id=version.id
  )
ORDER BY claim.id, assignment.id`;

const OPEN_NEEDS_SQL = `
SELECT DISTINCT need.description
FROM research.evidence_needs need
JOIN research.frontier_tasks task ON task.evidence_need_id=need.id
WHERE task.target_id=$1 AND need.mandatory AND need.status='open'
ORDER BY need.description`;

/** A record-level review exists only when one approved artifact covers every current claim. */
const RECORD_REVIEW_SQL = `
WITH current_claims AS (
  SELECT version.id
  FROM canonical.claims claim
  JOIN canonical.claim_versions version
    ON version.id=claim.current_version_id AND version.claim_id=claim.id
  WHERE claim.entity_id=$1 AND claim.workflow_status='accepted'
    AND version.workflow_status='accepted'
    AND NOT EXISTS (
      SELECT 1 FROM canonical.claim_tombstones tombstone
      WHERE tombstone.claim_version_id=version.id
    )
), candidate AS (
  SELECT artifact.id, review.reviewer_actor_id, review.producer_actor_id,
         review.findings, review.decided_at
  FROM research.artifacts artifact
  JOIN LATERAL (
    SELECT decision.* FROM research.review_decisions decision
    WHERE decision.artifact_id=artifact.id
    ORDER BY decision.decided_at DESC, decision.id DESC LIMIT 1
  ) review ON true
  WHERE artifact.status='accepted' AND review.decision='approve'
    AND review.reviewer_actor_id<>review.producer_actor_id
    AND NOT EXISTS (
      SELECT 1 FROM current_claims claim
      WHERE NOT EXISTS (
        SELECT 1 FROM research.artifact_claims membership
        WHERE membership.artifact_id=artifact.id
          AND membership.claim_version_id=claim.id
      )
    )
    AND EXISTS (SELECT 1 FROM current_claims)
)
SELECT reviewer_actor_id, producer_actor_id, findings
FROM candidate ORDER BY decided_at DESC, id DESC LIMIT 1`;

const RECORD_FACTS_SQL = `
SELECT EXISTS (
         SELECT 1 FROM canonical.entity_locations location
         WHERE location.entity_id=$1 AND cardinality(location.evidence_ids)>0
       ) AS place_receipt,
       (
         SELECT count(*)::integer FROM canonical.entity_relationships relationship
         WHERE (relationship.from_entity_id=$1 OR relationship.to_entity_id=$1)
           AND relationship.workflow_status='accepted'
           AND relationship.publication_status='published'
           AND NOT EXISTS (
             SELECT 1 FROM canonical.entity_relationship_evidence support
             WHERE support.relationship_id=relationship.id
           )
       ) AS relationships_without_evidence`;

function claimText(object: unknown): string {
  return typeof object === 'string' ? object : JSON.stringify(object);
}

function publicRole(released: ReleasedEntity, row: ClaimRow): boolean {
  const match = released.claims.find((claim) => claim.id === row.claim_id);
  return match !== undefined && match.claimRole !== 'record_index';
}

function correctionFindingCount(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter(
    (finding) =>
      finding !== null &&
      typeof finding === 'object' &&
      (finding as Record<string, unknown>).correctionForcing === true,
  ).length;
}

export type ReviewedMaturityResult = {
  readonly snapshot: RecordSnapshot;
  readonly assessment: ResearchMaturityAssessment;
  readonly reviewedAssignmentIds: readonly string[];
  readonly openMandatoryNeeds: readonly string[];
};

/**
 * Reassess from canonical reviewed records. It never writes or treats acquisition as review.
 * Invalid, expired, withdrawn, metadata-only, or post-review evidence is omitted conservatively.
 */
export async function assessReviewedMaturity(
  pool: ReviewedMaturityPool,
  released: ReleasedEntity,
  evaluatedAt = new Date().toISOString(),
): Promise<ReviewedMaturityResult> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result = await assessReviewedMaturityOnClient(db, released, evaluatedAt);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

/** Test/admin transaction seam; the caller owns the surrounding consistent snapshot. */
export async function assessReviewedMaturityOnClient(
  db: Pick<ReviewedMaturityClient, 'query'>,
  released: ReleasedEntity,
  evaluatedAt: string,
): Promise<ReviewedMaturityResult> {
  const claimsResult = await db.query<ClaimRow>(CLAIMS_SQL, [released.entityId]);
  const evidenceResult = await db.query<EvidenceRow>(REVIEWED_EVIDENCE_SQL, [released.entityId]);
  const needsResult = await db.query<{ description: string }>(OPEN_NEEDS_SQL, [released.entityId]);
  const reviewResult = await db.query<ReviewRow>(RECORD_REVIEW_SQL, [released.entityId]);
  const factsResult = await db.query<{
    place_receipt: boolean;
    relationships_without_evidence: number;
  }>(RECORD_FACTS_SQL, [released.entityId]);
  const evidenceByClaim = new Map<string, EvidenceRow[]>();
  for (const row of evidenceResult.rows) {
    try {
      const decision = validatePreservationDecision(
        row.preservation_decision,
        row.source_url,
        evaluatedAt,
      );
      if (!decision.allowTextRetention || decision.sensitivity !== 'public') continue;
    } catch {
      continue;
    }
    const current = evidenceByClaim.get(row.claim_id) ?? [];
    current.push(row);
    evidenceByClaim.set(row.claim_id, current);
  }
  const claims: ClaimSnapshot[] = claimsResult.rows.map((row) => ({
    id: row.claim_id,
    text: `${row.predicate} ${claimText(row.object)}`.trim(),
    assertionClass: assertionClassForClaim({
      id: row.claim_id,
      predicate: row.predicate,
      object: claimText(row.object),
    }),
    inPublicSummary: publicRole(released, row),
    evidence: (evidenceByClaim.get(row.claim_id) ?? []).map((item) => {
      const sourceClass = sourceClassForCitation(item.source_url, undefined);
      return {
        sourceId: item.source_item_id,
        url: item.source_url,
        sourceClass,
        lineage: {
          key: `reviewed:${item.lineage_cluster_id}`,
          kind:
            sourceClass === 'wikipedia_bridge' || sourceClass === 'wikidata_bridge'
              ? ('bridge' as const)
              : ('work' as const),
          basis: item.lineage_rationale,
          bridge: sourceClass === 'wikipedia_bridge' || sourceClass === 'wikidata_bridge',
          inferred: false,
        },
        hasSelector: true,
        captured: true,
        assessedDimensions: ['directness'],
      };
    }),
  }));
  const canonicalClaimIds = new Set(claimsResult.rows.map((row) => row.claim_id));
  for (const [index, releasedClaim] of released.claims.entries()) {
    if (
      releasedClaim.claimRole === 'record_index' ||
      (releasedClaim.id !== undefined && canonicalClaimIds.has(releasedClaim.id))
    )
      continue;
    claims.push({
      id: releasedClaim.id ?? `${released.entityId}-unbound-release-claim-${index}`,
      text: `${releasedClaim.predicate ?? ''} ${releasedClaim.object ?? ''}`.trim(),
      assertionClass: assertionClassForClaim(releasedClaim),
      inPublicSummary: true,
      evidence: [],
    });
  }
  const citesPatent = claims.some((claim) =>
    claim.evidence.some((item) => item.sourceClass.startsWith('patent_')),
  );
  const facts = factsResult.rows[0];
  const identityResolved = evidenceByClaim.size > 0;
  const snapshot: RecordSnapshot = {
    entityId: released.entityId,
    entityKind: released.kind,
    claims,
    contradictionSearchRun: false,
    priorArtSearchRun: false,
    placeReceipt: facts?.place_receipt ?? false,
    relationshipsWithoutEvidence: facts?.relationships_without_evidence ?? 0,
    requiresTechnicalReceipt: released.kind === 'invention',
    requiresCommunityIdentityReceipt: released.kind === 'person' && citesPatent,
    released: true,
  };
  const openMandatoryNeeds = needsResult.rows.map((row) => row.description);
  const recordReview = reviewResult.rows[0];
  const maturityInput: MaturityEvaluationInput = {
    record: snapshot,
    identityResolved,
    openMandatoryNeeds,
    evaluatedAt,
    ...(recordReview
      ? {
          independentReview: {
            reviewerActorId: recordReview.reviewer_actor_id,
            producerActorId: recordReview.producer_actor_id,
            correctionForcingFindings: correctionFindingCount(recordReview.findings),
          },
        }
      : {}),
  };
  return {
    snapshot,
    assessment: assessResearchMaturity(maturityInput),
    reviewedAssignmentIds: [...evidenceByClaim.values()].flat().map((row) => row.assignment_id),
    openMandatoryNeeds,
  };
}
