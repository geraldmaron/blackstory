/**
 * Decades-in-motion frames for the home hero (design-direction-v5 §6.1): the
 * archive fills in decade by decade — pins accumulate as their earliest
 * documented decade arrives, state fills deepen with documented presence, and
 * that decade's relationship lines trace movement between places.
 *
 * HONESTY RULE: every frame is driven by what the release actually documents
 * (era buckets, state aggregates, history edges) and is labeled as documented
 * records. It is NOT a population layer — Black population share by decade
 * (census bead black-book-vxz) rides this same density channel when its
 * ingestion lands, and replaces nothing here until the data is real.
 *
 * Dignity rules carry: intensity is presence-tiered copper (documented /
 * emerging / concentrated via `buildStateDensityLevels`), never incident heat.
 */
import type { MapStateAggregate } from '@blap/domain';
import type { ExploreMapFeature, ExploreMapFeatureCollection } from './build-explore-map-source';
import type { HistoryEdgeLineCollection } from './build-history-edge-lines';
import { buildStateDensityLevels, type StateDensityLevel } from './density';

export type DecadeFlowFrame = {
  /** Display label — "1870s", or FINAL_FRAME_LABEL for the closing full-archive frame. */
  readonly decade: string;
  /** Records documented by (through) this decade. */
  readonly featureCollection: ExploreMapFeatureCollection;
  /** Presence tiers over the cumulative records — documented, never ranked. */
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

function densityOf(features: readonly ExploreMapFeature[]): readonly StateDensityLevel[] {
  const byState = new Map<string, { fips: string; postal: string; name: string; count: number }>();
  for (const feature of features) {
    const { stateFips, statePostalCode, stateName } = feature.properties;
    if (!stateFips || !statePostalCode || !stateName) continue;
    const entry = byState.get(stateFips);
    if (entry) {
      entry.count += 1;
    } else {
      byState.set(stateFips, { fips: stateFips, postal: statePostalCode, name: stateName, count: 1 });
    }
  }
  const aggregates: MapStateAggregate[] = [...byState.values()].map((entry) => ({
    stateFips: entry.fips,
    statePostalCode: entry.postal,
    stateName: entry.name,
    count: entry.count,
  }));
  return buildStateDensityLevels(aggregates);
}

function collectionOf(features: readonly ExploreMapFeature[]): ExploreMapFeatureCollection {
  return { type: 'FeatureCollection', features };
}

/**
 * One frame per decade that changes something (a record arrives or an edge is
 * active), in chronological order, closed by a full-archive frame that also
 * carries the undated records and the all-time relationship lines.
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

  const frames: DecadeFlowFrame[] = [];
  for (const start of [...decadeStarts].sort((a, b) => a - b)) {
    const label = `${start}s`;
    const cumulative = collection.features.filter((feature) => {
      const earliest = earliestDecadeOf(feature);
      return earliest !== undefined && earliest <= start;
    });
    frames.push({
      decade: label,
      featureCollection: collectionOf(cumulative),
      densityLevels: densityOf(cumulative),
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
    densityLevels: densityOf(collection.features),
    edgeCollection: allTimeEdges,
    cumulativeCount: collection.features.length,
    isComplete: true,
  });

  return frames;
}
