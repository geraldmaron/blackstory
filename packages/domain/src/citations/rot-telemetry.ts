/**
 * Citation health telemetry: rot rate per source class, feeding
 * (a) confidence-engine authority signals see the small, additive
 * `citationRotRateAuthoritySignal` in packages/domain/src/confidence-engine/engine.ts, which
 * consumes the `rotRate` this module computes and (b) an admin dashboard tile
 * (apps/admin/src/app/citation-health/).
 */
import type { Citation } from './citation.js';

export type SourceClassRotRate = {
  readonly sourceClassification: string;
  readonly totalCitations: number;
  readonly deadCount: number;
  readonly driftedCount: number;
  /** deadCount totalCitations, 0..1. */
  readonly rotRate: number;
  /** (deadCount + driftedCount) totalCitations, 0..1 a broader "needs attention" rate. */
  readonly attentionRate: number;
};

const UNCLASSIFIED = 'unclassified' as const;

/**
 * Aggregates rot rate by `sourceClassification`. Citations without a recorded classification
 * are grouped under `'unclassified'` rather than dropped a missing classification is itself
 * a data-quality signal worth surfacing, not something to silently discard.
 */
export function computeRotRateBySourceClass(
  citations: readonly Pick<Citation, 'sourceClassification' | 'linkStatus'>[],
): readonly SourceClassRotRate[] {
  const buckets = new Map<string, { total: number; dead: number; drifted: number }>();
  for (const citation of citations) {
    const key = citation.sourceClassification ?? UNCLASSIFIED;
    const bucket = buckets.get(key) ?? { total: 0, dead: 0, drifted: 0 };
    bucket.total += 1;
    if (citation.linkStatus === 'dead') bucket.dead += 1;
    if (citation.linkStatus === 'drifted') bucket.drifted += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .map(([sourceClassification, bucket]) => ({
      sourceClassification,
      totalCitations: bucket.total,
      deadCount: bucket.dead,
      driftedCount: bucket.drifted,
      rotRate: bucket.total === 0 ? 0 : bucket.dead / bucket.total,
      attentionRate: bucket.total === 0 ? 0 : (bucket.dead + bucket.drifted) / bucket.total,
    }))
    .sort((left, right) => right.rotRate - left.rotRate || left.sourceClassification.localeCompare(right.sourceClassification));
}
