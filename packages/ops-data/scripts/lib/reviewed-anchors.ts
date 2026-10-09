import { isDiscoveryStatementUrl } from '@repo/domain-core/claims/source-fitness';
/** Publication evidence is loaded from accepted assignments, never a URL tier or author flag. */
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { loadReviewedClaimAssessments } from './confidence.js';

export type PublicationAnchor = {
  url: string;
  claimId?: string | undefined;
  claimVersionId?: string | undefined;
  selectorId?: string | undefined;
};

/** Bind review to all assertion-bearing fields; transport-only evidence references are excluded. */
export function publicationAssertionDigest(value: unknown): string {
  const canonical = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v)
          .filter(([key]) => !['anchors', 'replicationVerified'].includes(key))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, child]) => [key, canonical(child)]),
      );
    return v;
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

export async function assertReviewedPublicationAnchors(
  db: Pick<PoolClient, 'query'>,
  assertion: unknown,
  anchors: readonly PublicationAnchor[] | undefined,
  requiresIndependentSupport = true,
): Promise<void> {
  if (anchors?.some((a) => isDiscoveryStatementUrl(a.url)))
    throw new Error(
      'Inspect and review the underlying work; encyclopedia statements are discovery only',
    );
  if (!anchors?.length || anchors.some((a) => !a.claimId || !a.claimVersionId || !a.selectorId))
    throw new Error(
      'Publication requires exact claim-version and selector review references; host reputation and replicationVerified are not evidence',
    );
  const claims = await db.query<{ entity_id: string }>(
    'SELECT DISTINCT entity_id FROM canonical.claims WHERE id=ANY($1::text[])',
    [anchors.map((a) => a.claimId)],
  );
  const accepted = await loadReviewedClaimAssessments(
    db,
    claims.rows.map((c) => c.entity_id),
  );
  const digest = publicationAssertionDigest(assertion);
  for (const anchor of anchors) {
    const claim = accepted.find(
      (c) => c.claimId === anchor.claimId && c.claimVersionId === anchor.claimVersionId,
    );
    if (
      !claim ||
      claim.predicate !== 'publication_assertion_sha256' ||
      claim.object !== digest ||
      !claim.citationHrefs.includes(anchor.url)
    )
      throw new Error(
        'Anchor review does not cover the exact publication assertion and current accepted claim version',
      );
  }
  const rows = await db.query<{
    selector_id: string;
    claim_version_id: string;
    url: string;
    lineage_cluster_id: string;
    root_capture_id: string;
    rationale: string;
    work_captures: string[];
    root_digest: string;
  }>(
    `
    SELECT ea.selector_id,ea.claim_version_id,si.url,ea.lineage_cluster_id,lc.root_capture_id,lc.rationale,root.content_hash_digest AS root_digest,
      ARRAY(SELECT member.capture_id FROM evidence.lineage_cluster_members member WHERE member.cluster_id=lc.id) || ARRAY[lc.root_capture_id] AS work_captures
    FROM canonical.evidence_assignments ea
    JOIN evidence.evidence_selectors es ON es.id=ea.selector_id
    JOIN evidence.source_items si ON si.id=es.source_item_id
    JOIN evidence.capture_origins origin ON origin.capture_id=es.capture_id
      AND origin.source_item_id=es.source_item_id AND origin.retention_revoked_at IS NULL
    JOIN evidence.lineage_clusters lc ON lc.id=ea.lineage_cluster_id
    JOIN evidence.source_captures root ON root.id=lc.root_capture_id
    WHERE ea.selector_id=ANY($1::text[]) AND ea.claim_version_id=ANY($2::text[])
      AND ea.status='accepted' AND ea.role='supporting' AND ea.fitness IN ('authoritative','strong','conditional')
      AND nullif(btrim(ea.reviewer_actor_id),'') IS NOT NULL
      AND ea.assessment_basis='qualitative_review'
      AND nullif(btrim(ea.fitness_reason),'') IS NOT NULL AND nullif(btrim(ea.support_reason),'') IS NOT NULL
      AND nullif(btrim(lc.rationale),'') IS NOT NULL
      AND (lc.root_capture_id=es.capture_id OR EXISTS (
        SELECT 1 FROM evidence.lineage_cluster_members m WHERE m.cluster_id=lc.id AND m.capture_id=es.capture_id))
      AND (nullif(btrim(es.exact_text),'') IS NOT NULL OR es.page_number IS NOT NULL
        OR es.start_offset IS NOT NULL OR es.time_start_seconds IS NOT NULL OR nullif(btrim(es.fragment),'') IS NOT NULL)
      AND CASE WHEN origin.storage_object->'preservationDecision'->>'expiresAt' IS NOT NULL
        THEN (origin.storage_object->'preservationDecision'->>'expiresAt')::timestamptz > clock_timestamp()
        ELSE true END
    FOR SHARE OF origin`,
    [anchors.map((a) => a.selectorId), anchors.map((a) => a.claimVersionId)],
  );
  const works: { captures: Set<string>; digests: Set<string> }[] = [];
  for (const anchor of anchors) {
    const row = rows.rows.find(
      (r) =>
        r.selector_id === anchor.selectorId &&
        r.claim_version_id === anchor.claimVersionId &&
        r.url === anchor.url,
    );
    if (!row)
      throw new Error(
        'Anchor lacks an accepted source-specific assignment and assessed work lineage',
      );
    const captures = new Set(row.work_captures),
      digests = new Set([row.root_digest]);
    const overlap = works.filter(
      (work) =>
        [...captures].some((id) => work.captures.has(id)) || work.digests.has(row.root_digest),
    );
    for (const work of overlap) {
      for (const id of work.captures) captures.add(id);
      for (const hash of work.digests) digests.add(hash);
      works.splice(works.indexOf(work), 1);
    }
    works.push({ captures, digests });
  }
  if (requiresIndependentSupport && works.length < 2)
    throw new Error(
      'Consequential publication requires independently derived support; copies and mirrors count as one lineage',
    );
}
