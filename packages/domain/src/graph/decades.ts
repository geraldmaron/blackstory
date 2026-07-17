/**
 * Per-decade node/edge sets (BB-092 acceptance criterion 3), bucketed by ACTIVE SPAN, never
 * creation/founding date (BB-092 acceptance criterion 10 — CRITICAL).
 *
 * An entity with an open-ended or ongoing active period (an org, institution, movement, or law)
 * must appear in EVERY decade it was active — derived from BB-090's `statusHistory`/start-end
 * fields — not merely the decade it was founded. This module never re-derives BB-090's
 * status/statusHistory logic itself (that stays owned by `../entity-status.ts`, imported
 * read-only here); callers resolve an entity's own status-history windows (or event
 * startAt/endAt, or a single founding-year point) into `EraSpan` inputs before calling in — the
 * same "caller resolves, this module composes" discipline `../graph/containment.ts` follows for
 * jurisdiction data.
 */
import { deriveEraBuckets, type EraSpan } from '../era.js';
import type { EntityRelationship } from '../relationship.js';

export type DecadeBucketEntityInput = {
  readonly entityId: string;
  /**
   * Every window during which the entity counts as "active" for decade-view placement — e.g. one
   * entry per BB-090 `statusHistory` record for place/org/institution/law/movement kinds, or a
   * single `{validFrom: startAt, validTo: endAt}` window for an `event`, or a single
   * `{validFrom: birthYear, validTo: deathYear}` window for a `person`. An entity with several
   * disjoint active windows (e.g. an institution that closed and later reopened) supplies one
   * `EraSpan` per window; every window's buckets are unioned.
   */
  readonly activeSpans: readonly EraSpan[];
};

export type DeriveActiveDecadeBucketsOptions = {
  /**
   * Resolves an open-ended window (`validTo` omitted or null — "still active") through to this
   * cutoff year/date before decade-bucketing, so a still-active entity is placed in every
   * published decade through the present, not silently truncated at its founding decade. Defaults
   * to leaving the span open, which `deriveEraBuckets` (BB-090) already resolves to a
   * single-point span at `validFrom` alone — callers building a real release MUST supply the
   * release's `generatedAt` year here to get the "every subsequent decade" behavior the
   * acceptance criterion requires.
   */
  readonly stillActiveCutoff?: string;
};

/**
 * Derives every decade bucket an entity's active spans overlap — the core of acceptance
 * criterion 10. An entity founded in the 1950s with an open-ended (still-active) status-history
 * record and `stillActiveCutoff: "2026"` yields `["1950s", "1960s", ..., "2020s"]`, not just
 * `["1950s"]`.
 */
export function deriveActiveDecadeBuckets(
  input: DecadeBucketEntityInput,
  options: DeriveActiveDecadeBucketsOptions = {},
): readonly string[] {
  const buckets = new Set<string>();
  for (const span of input.activeSpans) {
    const stillOpen = span.validTo === undefined || span.validTo === null;
    const resolvedSpan: EraSpan =
      stillOpen && options.stillActiveCutoff !== undefined
        ? { ...span, validTo: options.stillActiveCutoff }
        : span;
    for (const bucket of deriveEraBuckets(resolvedSpan)) buckets.add(bucket);
  }
  return [...buckets].sort();
}

export type DecadeGraphView = {
  readonly decade: string;
  /** Sorted, deduplicated entity ids active during this decade. */
  readonly nodeIds: readonly string[];
  /** Sorted, deduplicated relationship ids whose endpoints are both node members of this decade
   * and whose own temporal context (when present) overlaps the decade. */
  readonly edgeIds: readonly string[];
};

export type BuildDecadeViewsInput = {
  readonly entities: readonly DecadeBucketEntityInput[];
  readonly relationships: readonly EntityRelationship[];
};

function edgeTemporalOverlapsDecade(rel: EntityRelationship, decade: string): boolean {
  if (!rel.temporal?.validFrom) return true;
  const buckets = deriveEraBuckets({
    validFrom: rel.temporal.validFrom,
    ...(rel.temporal.validTo !== undefined ? { validTo: rel.temporal.validTo } : {}),
    datePrecision: 'year',
  });
  return buckets.length === 0 || buckets.includes(decade);
}

/**
 * Builds one `DecadeGraphView` per decade touched by any entity's active span. Deterministic: the
 * decade list, node lists, and edge lists are all sorted, so re-running the build against the
 * same input always yields byte-identical output (required for the BB-019 release-snapshot
 * discipline this feeds).
 */
export function buildDecadeViews(
  input: BuildDecadeViewsInput,
  options: DeriveActiveDecadeBucketsOptions = {},
): readonly DecadeGraphView[] {
  const decadeToNodes = new Map<string, Set<string>>();
  for (const entity of input.entities) {
    const buckets = deriveActiveDecadeBuckets(entity, options);
    for (const decade of buckets) {
      const nodes = decadeToNodes.get(decade) ?? new Set<string>();
      nodes.add(entity.entityId);
      decadeToNodes.set(decade, nodes);
    }
  }

  const decades = [...decadeToNodes.keys()].sort();
  return decades.map((decade) => {
    const nodeIds = new Set(decadeToNodes.get(decade) ?? []);
    const edgeIds = new Set<string>();
    for (const rel of input.relationships) {
      if (!nodeIds.has(rel.fromEntityId) || !nodeIds.has(rel.toEntityId)) continue;
      if (!edgeTemporalOverlapsDecade(rel, decade)) continue;
      edgeIds.add(rel.id);
    }
    return {
      decade,
      nodeIds: [...nodeIds].sort(),
      edgeIds: [...edgeIds].sort(),
    };
  });
}

/** Union of every decade view into one all-time node/edge set (BB-092 acceptance criterion 3's
 * "an all-time union view"). */
export type AllTimeGraphView = {
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
};

export function buildAllTimeView(decadeViews: readonly DecadeGraphView[]): AllTimeGraphView {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  for (const view of decadeViews) {
    for (const id of view.nodeIds) nodeIds.add(id);
    for (const id of view.edgeIds) edgeIds.add(id);
  }
  return {
    nodeIds: [...nodeIds].sort(),
    edgeIds: [...edgeIds].sort(),
  };
}
