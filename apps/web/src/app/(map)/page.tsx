/**
 * Homepage: the hero IS the shared `MapStage` canvas (mounted once by the `(map)` layout).
 * `HeroStage` renders the floating chrome over it; `HomeStorySections` owns the beats below
 * (design-direction-v5 §6.1): About, From the data (archive + `/data` census viz), the story
 * rail, and the "how this works" band.
 *
 * Decade fills load from the static Census Black-population index (twps0056 + modern county
 * rollups); pins/edges stay archive overlays. National totals for the timeline readout come
 * from the same timeline snapshot used on `/data` when available.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getNationalPopulationTimelineSnapshot } from '@repo/firebase';
import {
  parseStatePopulationIndexFile,
  type StatePopulationIndexFile,
} from '@repo/domain/map/state-population';
import { HomeStorySections } from '../../components/home/HomeStorySections';
import type { StateStartEntry } from '../../components/home/StateStart';
import { FEATURED_SEED_IDS } from '../../data/public-seed';
import type { ExploreMapFeatureCollection } from '../../lib/map-experience/build-explore-map-source';
import type { HistoryEdgeLineCollection } from '../../lib/map-experience/build-history-edge-lines';
import { buildDecadeFlowFrames } from '../../lib/map-experience/decade-flow';
import { buildEdgeLineCatalog } from './explore/explore-view-model';
import { HeroStage } from './HeroStage';
import { loadMapStageBase } from './shared-map-data';

async function safe<T>(promise: Promise<T | undefined>): Promise<T | undefined> {
  try {
    return await promise;
  } catch {
    return undefined;
  }
}

/** How many one-tap state chips the Orient beat shows. */
const TOP_STATE_LIMIT = 5;

async function loadStatePopulationIndex() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'geo', 'state-population-decades.json');
    const raw = await readFile(filePath, 'utf8');
    const payload = JSON.parse(raw) as StatePopulationIndexFile;
    const index = parseStatePopulationIndexFile(payload);
    if (index.vintages.length === 0 || Object.keys(index.states).length === 0) return undefined;
    return index;
  } catch {
    return undefined;
  }
}

/** Distinct states with pinned records, ordered by record count descending. */
function tallyStates(collection: ExploreMapFeatureCollection): StateStartEntry[] {
  const byState = new Map<string, { name: string; count: number }>();
  for (const feature of collection.features) {
    const { statePostalCode, stateName } = feature.properties;
    if (!statePostalCode || !stateName) continue;
    const entry = byState.get(statePostalCode);
    if (entry) {
      entry.count += 1;
    } else {
      byState.set(statePostalCode, { name: stateName, count: 1 });
    }
  }
  return [...byState.entries()]
    .map(([postalCode, entry]) => ({ postalCode, name: entry.name, count: entry.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** "1820s–1970s" across every feature's era buckets; undefined when nothing is dated. */
function eraSpanOf(collection: ExploreMapFeatureCollection): string | undefined {
  let min: number | undefined;
  let max: number | undefined;
  for (const feature of collection.features) {
    for (const bucket of feature.properties.eraBuckets) {
      const decade = Number.parseInt(bucket, 10);
      if (Number.isNaN(decade)) continue;
      if (min === undefined || decade < min) min = decade;
      if (max === undefined || decade > max) max = decade;
    }
  }
  if (min === undefined || max === undefined) return undefined;
  return min === max ? `${min}s` : `${min}s–${max}s`;
}

export default async function HomePage() {
  const [base, timeline, statePopulationIndex] = await Promise.all([
    loadMapStageBase(),
    safe(getNationalPopulationTimelineSnapshot()).then((snap) => snap ?? undefined),
    loadStatePopulationIndex(),
  ]);

  // Feature the curated ids when the active release carries them; otherwise lead with whatever
  // the release does hold, so the rail never goes empty just because curation lagged a release.
  const curated = FEATURED_SEED_IDS.map((id) =>
    base.entities.find((entity) => entity.id === id),
  ).filter((entity): entity is NonNullable<typeof entity> => Boolean(entity));
  const featured = curated.length > 0 ? curated : base.entities.slice(0, 3);

  const states = tallyStates(base.featureCollection);
  const recordCount = base.featureCollection.features.length;
  const eraSpan = eraSpanOf(base.featureCollection);

  // Decades in motion (v5 §6.1): per-decade edge lines from the history graph
  // release + cumulative record reveal over the shared feature collection.
  // State fills prefer the Census Black-population index when present.
  const { edgeLineCatalog } = buildEdgeLineCatalog();
  const edgesByDecade: Record<string, HistoryEdgeLineCollection> = {};
  for (const [decade, slice] of Object.entries(edgeLineCatalog.byDecade)) {
    edgesByDecade[decade] = slice.lineCollection;
  }

  const nationalBlackByDecade: Record<string, number> = {};
  for (const row of timeline?.rows ?? []) {
    nationalBlackByDecade[row.decade] = row.blackPopulation;
  }

  const decadeFrames = buildDecadeFlowFrames(
    base.featureCollection,
    edgesByDecade,
    edgeLineCatalog.allTime.lineCollection,
    {
      ...(statePopulationIndex ? { statePopulationIndex } : {}),
      ...(Object.keys(nationalBlackByDecade).length > 0 ? { nationalBlackByDecade } : {}),
    },
  );

  return (
    <>
      <HeroStage
        featureCollection={base.featureCollection}
        jurisdictionAreaFeatures={base.jurisdictionAreaFeatures}
        featureCount={recordCount}
        stateCount={states.length}
        decadeFrames={decadeFrames}
      />

      <main id="main">
        <HomeStorySections
          featured={featured}
          topStates={states.slice(0, TOP_STATE_LIMIT)}
          recordCount={recordCount}
          stateCount={states.length}
          {...(eraSpan !== undefined ? { eraSpan } : {})}
          {...(timeline ? { timeline } : {})}
        />
      </main>
    </>
  );
}
