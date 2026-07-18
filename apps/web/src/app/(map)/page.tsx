/**
 * Homepage: the hero IS the shared `MapStage` canvas (mounted once by the `(map)` layout).
 * `HeroStage` renders the floating chrome over it; `HomeStorySections` owns the beats below
 * (design-direction-v5 §6.1): start-with-your-state, the story rail, the numbers strip, and
 * the "how this works" band.
 */
import { HomeStorySections } from '../../components/home/HomeStorySections';
import type { StateStartEntry } from '../../components/home/StateStart';
import { FEATURED_SEED_IDS } from '../../data/public-seed';
import type { ExploreMapFeatureCollection } from '../../lib/map-experience/build-explore-map-source';
import type { HistoryEdgeLineCollection } from '../../lib/map-experience/build-history-edge-lines';
import { buildDecadeFlowFrames } from '../../lib/map-experience/decade-flow';
import { buildEdgeLineCatalog } from './explore/explore-view-model';
import { HeroStage } from './HeroStage';
import { loadMapStageBase } from './shared-map-data';

/** Below this many released records the story rail carries the honest "early release" note —
 * a small hand-verified collection is a fact worth stating, not a defect to hide. */
const EARLY_RELEASE_THRESHOLD = 25;

/** How many one-tap state chips the Orient beat shows. */
const TOP_STATE_LIMIT = 5;

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
  const base = await loadMapStageBase();

  // Feature the curated ids when the active release carries them; otherwise lead with whatever
  // the release does hold, so the rail never goes empty just because curation lagged a release.
  const curated = FEATURED_SEED_IDS.map((id) => base.entities.find((entity) => entity.id === id)).filter(
    (entity): entity is NonNullable<typeof entity> => Boolean(entity),
  );
  const featured = curated.length > 0 ? curated : base.entities.slice(0, 3);

  const states = tallyStates(base.featureCollection);
  const recordCount = base.featureCollection.features.length;

  // Decades in motion (v5 §6.1): per-decade edge lines from the history graph
  // release + cumulative record reveal over the shared feature collection.
  const { edgeLineCatalog } = buildEdgeLineCatalog();
  const edgesByDecade: Record<string, HistoryEdgeLineCollection> = {};
  for (const [decade, slice] of Object.entries(edgeLineCatalog.byDecade)) {
    edgesByDecade[decade] = slice.lineCollection;
  }
  const decadeFrames = buildDecadeFlowFrames(
    base.featureCollection,
    edgesByDecade,
    edgeLineCatalog.allTime.lineCollection,
  );

  return (
    <>
      <HeroStage
        featureCollection={base.featureCollection}
        jurisdictionAreaFeatures={base.jurisdictionAreaFeatures}
        featureCount={recordCount}
        stateCount={states.length}
        decadeFrames={decadeFrames}
        liveData={base.dataSource === 'live'}
      />

      <main id="main">
        <HomeStorySections
          featured={featured}
          topStates={states.slice(0, TOP_STATE_LIMIT)}
          recordCount={recordCount}
          stateCount={states.length}
          eraSpan={eraSpanOf(base.featureCollection)}
          showSeedNotice={base.dataSource !== 'live' || base.entities.length < EARLY_RELEASE_THRESHOLD}
        />
      </main>
    </>
  );
}
