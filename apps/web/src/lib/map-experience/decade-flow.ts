/**
 * Decades-in-motion frames for the home hero (design-direction-v5 §6.1): the
 * archive rewinds newest → oldest — starting near the present end of the
 * documented record and walking toward earlier decades — then lands on the
 * full archive.
 *
 * Pins accumulate by earliest documented decade (≤ frame decade); relationship
 * lines trace movement active that decade. State fills are driven by Census
 * Black population when a `StatePopulationIndex` is supplied (absolute count →
 * copper deepen via `@repo/domain/map/state-population`); without an index,
 * fills fall back to ACTIVE documented presence (`aggregateDecadePresence`) so
 * existing tests and degraded environments keep working.
 *
 * HONESTY RULE: population fills and archive pins are independent signals.
 * When the population index is present, fills ARE census Black population for
 * that vintage — missing state rows stay unfilled (not "zero people"). Pins
 * remain documented records only; sparse pins never mean empty demography.
 *
 * Dignity rules carry: intensity is presence-tiered copper (documented /
 * emerging / concentrated), never incident heat.
 */
// Client-safe subpaths only — this module is imported by HeroStage.tsx ('use client').
import {
  aggregateDecadePresence,
  type StateAggregateCount,
} from '@repo/domain/map/decade-presence';
import { US_STATES } from '@repo/domain/map/geography';
import {
  buildStateBlackPopulationDensityLevels,
  latestStatePopulationVintage,
  sumStateBlackPopulation,
  type StatePopulationIndex,
} from '@repo/domain/map/state-population';
import type { ExploreMapFeature, ExploreMapFeatureCollection } from './build-explore-map-source';
import type { HistoryEdgeLineCollection } from './build-history-edge-lines';
import { buildStateDensityLevels, type StateDensityLevel } from './density';

export type DecadeFlowDensityMode = 'population' | 'presence';

export type DecadeFlowFrame = {
  /** Display label — "1870s", or FINAL_FRAME_LABEL for the closing full-archive frame. */
  readonly decade: string;
  /** Records documented by (through) this decade. */
  readonly featureCollection: ExploreMapFeatureCollection;
  /**
   * State fills for this frame — Census Black population when `densityMode` is
   * `population`, otherwise ACTIVE documented presence. Missing population rows
   * stay omitted (unknown fill).
   */
  readonly densityLevels: readonly StateDensityLevel[];
  /** Relationship lines active in this decade (movement, not accumulation). */
  readonly edgeCollection: HistoryEdgeLineCollection;
  readonly cumulativeCount: number;
  /** True only on the closing frame that shows the complete archive. */
  readonly isComplete: boolean;
  /** How `densityLevels` were produced for this frame. */
  readonly densityMode: DecadeFlowDensityMode;
  /**
   * National Black population for the frame vintage when known (timeline snapshot
   * preferred; otherwise a sum of published state rows). Omitted when unknown.
   */
  readonly blackPopulationTotal?: number;
  /** True when this vintage opens the 2000 measurement-regime boundary. */
  readonly opensDefinitionBoundary?: boolean;
};

export type BuildDecadeFlowFramesOptions = {
  /** When set, state fills encode absolute Census Black population. */
  readonly statePopulationIndex?: StatePopulationIndex;
  /**
   * Optional national Black totals keyed by vintage year (`"1870"`). Preferred
   * over summing state rows when a timeline snapshot is available.
   */
  readonly nationalBlackByDecade?: Readonly<Partial<Record<string, number>>>;
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
 * closing/complete frame's "today" density when population data is unavailable. */
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

/** Per-decade ACTIVE-presence density, keyed by decade label. */
export function buildActiveDensityByDecade(
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

function nationalTotalForVintage(
  vintage: string,
  index: StatePopulationIndex,
  nationalBlackByDecade: Readonly<Partial<Record<string, number>>> | undefined,
): number | undefined {
  const fromTimeline = nationalBlackByDecade?.[vintage];
  if (typeof fromTimeline === 'number' && Number.isFinite(fromTimeline)) {
    return fromTimeline;
  }
  const summed = sumStateBlackPopulation(index, vintage);
  return summed > 0 ? summed : undefined;
}

function populationDensityForVintage(
  index: StatePopulationIndex,
  vintage: string,
): readonly StateDensityLevel[] {
  return buildStateBlackPopulationDensityLevels(index, vintage, US_STATES).map((level) => ({
    stateFips: level.stateFips,
    statePostalCode: level.statePostalCode,
    stateName: level.stateName,
    count: level.count,
    tier: level.tier,
  }));
}

/**
 * One frame per decade that changes something (a record arrives, an edge is
 * active, or — when a population index is present — a census vintage exists),
 * newest → oldest, closed by a full-archive frame.
 *
 * Pins accumulate by arrival; density reflects Census Black population when
 * `options.statePopulationIndex` is set, otherwise ACTIVE archive presence.
 */
export function buildDecadeFlowFrames(
  collection: ExploreMapFeatureCollection,
  edgesByDecade: Readonly<Record<string, HistoryEdgeLineCollection>>,
  allTimeEdges: HistoryEdgeLineCollection = EMPTY_EDGE_LINE_COLLECTION,
  options: BuildDecadeFlowFramesOptions = {},
): readonly DecadeFlowFrame[] {
  const { statePopulationIndex, nationalBlackByDecade } = options;
  const populationMode = Boolean(statePopulationIndex);

  const decadeStarts = new Set<number>();
  for (const feature of collection.features) {
    const earliest = earliestDecadeOf(feature);
    if (earliest !== undefined) decadeStarts.add(earliest);
  }
  for (const label of Object.keys(edgesByDecade)) {
    const start = decadeStartOf(label);
    if (start !== undefined) decadeStarts.add(start);
  }
  if (statePopulationIndex) {
    for (const vintage of statePopulationIndex.vintages) {
      const start = decadeStartOf(vintage);
      if (start !== undefined) decadeStarts.add(start);
    }
  }

  const activeDensityByDecade = populationMode
    ? undefined
    : buildActiveDensityByDecade(collection.features);

  const frames: DecadeFlowFrame[] = [];
  // Newest first so autoplay and the rail both read new → old.
  for (const start of [...decadeStarts].sort((a, b) => b - a)) {
    const label = `${start}s`;
    const vintage = String(start);
    const cumulative = collection.features.filter((feature) => {
      const earliest = earliestDecadeOf(feature);
      return earliest !== undefined && earliest <= start;
    });

    const densityLevels = statePopulationIndex
      ? populationDensityForVintage(statePopulationIndex, vintage)
      : (activeDensityByDecade?.get(label) ?? []);
    const blackPopulationTotal = statePopulationIndex
      ? nationalTotalForVintage(vintage, statePopulationIndex, nationalBlackByDecade)
      : undefined;

    frames.push({
      decade: label,
      featureCollection: collectionOf(cumulative),
      densityLevels,
      edgeCollection: edgesByDecade[label] ?? EMPTY_EDGE_LINE_COLLECTION,
      cumulativeCount: cumulative.length,
      isComplete: false,
      densityMode: populationMode ? 'population' : 'presence',
      ...(blackPopulationTotal !== undefined ? { blackPopulationTotal } : {}),
      // 2000 opens the alone-category measurement boundary (see population-decades meta).
      ...(vintage === '2000' ? { opensDefinitionBoundary: true } : {}),
    });
  }

  // Closing frame: complete archive pins + latest population vintage fills (or
  // era-agnostic presence when no population index).
  const latestVintage = statePopulationIndex
    ? latestStatePopulationVintage(statePopulationIndex)
    : undefined;
  const closingBlackTotal =
    statePopulationIndex && latestVintage
      ? nationalTotalForVintage(latestVintage, statePopulationIndex, nationalBlackByDecade)
      : undefined;

  frames.push({
    decade: FINAL_FRAME_LABEL,
    featureCollection: collection,
    densityLevels:
      statePopulationIndex && latestVintage
        ? populationDensityForVintage(statePopulationIndex, latestVintage)
        : densityOfAllFeatures(collection.features),
    edgeCollection: allTimeEdges,
    cumulativeCount: collection.features.length,
    isComplete: true,
    densityMode: populationMode ? 'population' : 'presence',
    ...(closingBlackTotal !== undefined ? { blackPopulationTotal: closingBlackTotal } : {}),
  });

  return frames;
}
