/**
 * Decades-in-motion frames for the home hero (design-direction-v5 §6.1): the
 * archive rewinds newest → oldest — starting near the present end of the
 * documented record and walking toward earlier decades — then lands on the
 * full archive. Pins accumulate by earliest documented decade (≤ frame decade);
 * state fills reflect ACTIVE documented presence that decade (an entity's own
 * `eraBuckets` span, not just its arrival); that decade's relationship lines
 * trace movement between places.
 *
 * Per-decade state density is delegated to `@repo/domain`'s
 * `aggregateDecadePresence` (packages/domain/src/map/decade-presence.ts) —
 * the modeling-library primitive for "which decades is this entity
 * recognized as active in," shared with the history graph's per-decade
 * node/edge views (`../graph/decades.ts`). This module supplies the pieces
 * that ARE web-specific: which decades get a pin-arrival frame at all, and
 * the frame's actual GeoJSON feature collection/edge lines.
 *
 * HONESTY RULE: every frame is driven by what the release actually documents
 * (era buckets, state aggregates, history edges) and is labeled as documented
 * records. It is NOT a population layer — Black population share by decade
 * (census bead the related workstream) rides this same density channel when its
 * ingestion lands, and replaces nothing here until the data is real.
 *
 * Dignity rules carry: intensity is presence-tiered copper (documented /
 * emerging / concentrated via `buildStateDensityLevels`), never incident heat.
 */
// Both the value and the type come from the client-safe `./map/decade-presence` subpath, never
// the top-level `@repo/domain` barrel: this module is imported by HeroStage.tsx ('use client'),
// and the barrel transitively pulls in server-only modules (Node builtins in
// publication/index.ts, relevance/fixtures.ts) that webpack cannot bundle for the browser. That
// subpath's own module is import-free by design (see its doc comment) so nothing it pulls in can
// reintroduce the problem — `StateAggregateCount` is a structural duplicate of `@repo/domain`'s
// `MapStateAggregate` (same four fields), freely interchangeable via TypeScript's structural
// typing with `density.ts`'s `buildStateDensityLevels`, which expects the latter.
import {
  aggregateDecadePresence,
  type StateAggregateCount,
} from '@repo/domain/map/decade-presence';
import type { ExploreMapFeature, ExploreMapFeatureCollection } from './build-explore-map-source';
import type { HistoryEdgeLineCollection } from './build-history-edge-lines';
import { buildStateDensityLevels, type StateDensityLevel } from './density';

export type DecadeFlowFrame = {
  /** Display label — "1870s", or FINAL_FRAME_LABEL for the closing full-archive frame. */
  readonly decade: string;
  /** Records documented by (through) this decade. */
  readonly featureCollection: ExploreMapFeatureCollection;
  /** Presence tiers for entities ACTIVE this decade (or, on the closing frame, the
   * complete era-agnostic archive) — documented presence, never ranked. */
  readonly densityLevels: readonly StateDensityLevel[];
  /** Relationship lines active in this decade (movement, not accumulation). */
  readonly edgeCollection: HistoryEdgeLineCollection;
  readonly cumulativeCount: number;
  /** True only on the closing frame that shows the complete archive. */
  readonly isComplete: boolean;
};

export const FINAL_FRAME_LABEL = 'Today';

export const EMPTY_EDGE_LINE_COLLECTION: HistoryEdgeLineCollection = {
  type: 'FeatureCollection',
  features: [],
};

function decadeStartOf(label: string): number | undefined {
  const parsed = Number.parseInt(label, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Earliest parseable era-bucket decade; undefined for undated records. */
function earliestDecadeOf(feature: ExploreMapFeature): number | undefined {
  let earliest: number | undefined;
  for (const bucket of feature.properties.eraBuckets) {
    const start = decadeStartOf(bucket);
    if (start !== undefined && (earliest === undefined || start < earliest)) {
      earliest = start;
    }
  }
  return earliest;
}

function stateResolved(feature: ExploreMapFeature): feature is ExploreMapFeature & {
  properties: { stateFips: string; statePostalCode: string; stateName: string };
} {
  const { stateFips, statePostalCode, stateName } = feature.properties;
  return Boolean(stateFips && statePostalCode && stateName);
}

/** Era-agnostic state presence over every state-resolved feature, dated or not — the
 * closing/complete frame's "today" density. Deliberately independent of decade-bucket
 * membership: an undated-but-located record still belongs on the map today, even though
 * it can never honestly claim a specific decade's ACTIVE presence (see
 * `aggregateDecadePresence`'s doc comment on why decade-scoped presence excludes it). */
function densityOfAllFeatures(
  features: readonly ExploreMapFeature[],
): readonly StateDensityLevel[] {
  const byState = new Map<string, { fips: string; postal: string; name: string; count: number }>();
  for (const feature of features) {
    if (!stateResolved(feature)) continue;
    const { stateFips, statePostalCode, stateName } = feature.properties;
    const entry = byState.get(stateFips);
    if (entry) {
      entry.count += 1;
    } else {
      byState.set(stateFips, {
        fips: stateFips,
        postal: statePostalCode,
        name: stateName,
        count: 1,
      });
    }
  }
  const aggregates: StateAggregateCount[] = [...byState.values()].map((entry) => ({
    stateFips: entry.fips,
    statePostalCode: entry.postal,
    stateName: entry.name,
    count: entry.count,
  }));
  return buildStateDensityLevels(aggregates);
}

/** Per-decade ACTIVE-presence density, keyed by decade label, over every state-resolved
 * feature's own `eraBuckets` span — delegates the active/cumulative aggregation to
 * `@repo/domain`'s `aggregateDecadePresence` rather than reimplementing it here. */
function buildActiveDensityByDecade(
  features: readonly ExploreMapFeature[],
): ReadonlyMap<string, readonly StateDensityLevel[]> {
  const entities = features.filter(stateResolved).map((feature) => ({
    entityId: feature.properties.entityId,
    stateFips: feature.properties.stateFips,
    statePostalCode: feature.properties.statePostalCode,
    stateName: feature.properties.stateName,
    decadeBuckets: feature.properties.eraBuckets,
  }));
  const presenceByDecade = aggregateDecadePresence(entities);
  return new Map(
    presenceByDecade.map((presence) => [presence.decade, buildStateDensityLevels(presence.active)]),
  );
}

function collectionOf(features: readonly ExploreMapFeature[]): ExploreMapFeatureCollection {
  return { type: 'FeatureCollection', features };
}

/**
 * One frame per decade that changes something (a record arrives or an edge is
 * active), newest → oldest so the hero starts at the present end of the
 * archive and rewinds toward earlier records, closed by a full-archive frame
 * that also carries the undated records and the all-time relationship lines.
 * Pins accumulate by arrival (earliest documented decade ≤ frame decade);
 * density reflects ACTIVE presence that decade, via `@repo/domain`'s
 * decade-presence model.
 */
export function buildDecadeFlowFrames(
  collection: ExploreMapFeatureCollection,
  edgesByDecade: Readonly<Record<string, HistoryEdgeLineCollection>>,
  allTimeEdges: HistoryEdgeLineCollection = EMPTY_EDGE_LINE_COLLECTION,
): readonly DecadeFlowFrame[] {
  const decadeStarts = new Set<number>();
  for (const feature of collection.features) {
    const earliest = earliestDecadeOf(feature);
    if (earliest !== undefined) decadeStarts.add(earliest);
  }
  for (const label of Object.keys(edgesByDecade)) {
    const start = decadeStartOf(label);
    if (start !== undefined) decadeStarts.add(start);
  }

  const activeDensityByDecade = buildActiveDensityByDecade(collection.features);

  const frames: DecadeFlowFrame[] = [];
  // Newest first so autoplay and the rail both read new → old.
  for (const start of [...decadeStarts].sort((a, b) => b - a)) {
    const label = `${start}s`;
    const cumulative = collection.features.filter((feature) => {
      const earliest = earliestDecadeOf(feature);
      return earliest !== undefined && earliest <= start;
    });
    frames.push({
      decade: label,
      featureCollection: collectionOf(cumulative),
      densityLevels: activeDensityByDecade.get(label) ?? [],
      edgeCollection: edgesByDecade[label] ?? EMPTY_EDGE_LINE_COLLECTION,
      cumulativeCount: cumulative.length,
      isComplete: false,
    });
  }

  // Closing frame: the complete archive — including undated records, which
  // never appear under a decade label they can't honestly claim.
  frames.push({
    decade: FINAL_FRAME_LABEL,
    featureCollection: collection,
    densityLevels: densityOfAllFeatures(collection.features),
    edgeCollection: allTimeEdges,
    cumulativeCount: collection.features.length,
    isComplete: true,
  });

  return frames;
}
