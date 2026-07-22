/**
 * Citation independence review signal: flags high-similarity pairs among citations that
 * claim separate independence groups. Pure read-only comparison — never auto-rejects,
 * auto-publishes, or mutates promotion state.
 *
 * Promotion (`../promotion/controls.ts`) collapses evidence by `independenceGroupId` and
 * `coordinatedGroupId` when counting independent lineages. This module is the semantic
 * counterpart: when two citations are labeled as independent but their excerpt embeddings
 * are near-duplicates, reviewers need a deterministic flag before those citations can
 * credibly support triangulation.
 *
 * Persisted lineage lives in `bb_evidence.lineage_clusters` / `lineage_cluster_members`
 * (see `docs/research/citation-independence-review-signal.md`). This module stays
 * in-memory for review-queue items until a human decides whether to merge clusters.
 */
import {
  cosineSimilarity,
  DEFAULT_NEAR_DUPLICATE_THRESHOLD,
  type EmbeddingVector,
} from '../similarity/index.js';

export const CITATION_INDEPENDENCE_REVIEW_SIGNAL_VERSION =
  'citation-independence-review.v1' as const;

/** Default cosine floor mirrors near-duplicate recall — permissive enough to surface review. */
export const DEFAULT_CITATION_INDEPENDENCE_SIMILARITY_THRESHOLD =
  DEFAULT_NEAR_DUPLICATE_THRESHOLD;

export type CitationForIndependenceReview = {
  readonly citationId: string;
  readonly independenceGroupId: string;
  readonly coordinatedGroupId?: string;
  /** When omitted, the pair is skipped — similarity cannot be assessed without a vector. */
  readonly vector?: EmbeddingVector;
};

export type ReviewFlagKind = 'claimed_independence_high_similarity';

export type ReviewFlag = {
  readonly kind: ReviewFlagKind;
  readonly signalVersion: typeof CITATION_INDEPENDENCE_REVIEW_SIGNAL_VERSION;
  readonly citationIdA: string;
  readonly citationIdB: string;
  readonly similarity: number;
  readonly independenceKeyA: string;
  readonly independenceKeyB: string;
};

export type FindCitationIndependenceReviewFlagsOptions = {
  readonly threshold?: number;
};

function assertSimilarityThreshold(threshold: number): void {
  if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) {
    throw new Error(
      'findCitationIndependenceReviewFlags: threshold must be a finite number within [-1, 1]',
    );
  }
}

/** Matches `independenceKey` in `../promotion/controls.ts` for cross-layer consistency. */
export function independenceKeyForCitation(
  citation: Pick<CitationForIndependenceReview, 'independenceGroupId' | 'coordinatedGroupId'>,
): string {
  return citation.coordinatedGroupId
    ? `coordinated:${citation.coordinatedGroupId}`
    : `independent:${citation.independenceGroupId}`;
}

function claimsMutualIndependence(
  left: CitationForIndependenceReview,
  right: CitationForIndependenceReview,
): boolean {
  return independenceKeyForCitation(left) !== independenceKeyForCitation(right);
}

function canonicalPair(
  leftId: string,
  rightId: string,
): readonly [string, string] {
  return leftId.localeCompare(rightId) <= 0
    ? ([leftId, rightId] as const)
    : ([rightId, leftId] as const);
}

/**
 * Returns review flags for every pair of citations that (a) claim separate independence
 * keys, (b) both supply embedding vectors, and (c) exceed the cosine-similarity threshold.
 * Output is deterministic regardless of input order.
 */
export function findCitationIndependenceReviewFlags(
  citations: readonly CitationForIndependenceReview[],
  options: FindCitationIndependenceReviewFlagsOptions = {},
): readonly ReviewFlag[] {
  const threshold =
    options.threshold ?? DEFAULT_CITATION_INDEPENDENCE_SIMILARITY_THRESHOLD;
  assertSimilarityThreshold(threshold);

  const flags: ReviewFlag[] = [];

  for (let i = 0; i < citations.length; i += 1) {
    const left = citations[i]!;
    if (left.vector === undefined) continue;

    for (let j = i + 1; j < citations.length; j += 1) {
      const right = citations[j]!;
      if (right.vector === undefined) continue;
      if (!claimsMutualIndependence(left, right)) continue;

      const similarity = cosineSimilarity(left.vector, right.vector);
      if (similarity < threshold) continue;

      const [citationIdA, citationIdB] = canonicalPair(left.citationId, right.citationId);
      const independenceKeyA =
        citationIdA === left.citationId
          ? independenceKeyForCitation(left)
          : independenceKeyForCitation(right);
      const independenceKeyB =
        citationIdB === right.citationId
          ? independenceKeyForCitation(right)
          : independenceKeyForCitation(left);

      flags.push(
        Object.freeze({
          kind: 'claimed_independence_high_similarity',
          signalVersion: CITATION_INDEPENDENCE_REVIEW_SIGNAL_VERSION,
          citationIdA,
          citationIdB,
          similarity,
          independenceKeyA,
          independenceKeyB,
        }),
      );
    }
  }

  return Object.freeze(
    flags.sort(
      (a, b) =>
        b.similarity - a.similarity ||
        a.citationIdA.localeCompare(b.citationIdA) ||
        a.citationIdB.localeCompare(b.citationIdB),
    ),
  );
}
