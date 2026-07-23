/**
 * Homepage: single-panel hero + theme-aware edition beats (`HomeEdition`).
 * `HeroStage` positions the live `MapStage` plate over the hero map column; `engage()` clears
 * the inset for ADR-017 explore handoff (see `hero-map-inset.ts` + map-surfaces.css).
 *
 * Decade fills seed the hidden plate's complete-archive state for explore transitions.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getNationalPopulationTimelineSnapshot } from '../../lib/demographics/public-stats-source';
import {
  parseStatePopulationIndexFile,
  type StatePopulationIndexFile,
} from '@repo/domain/map/state-population';
import { HomeEdition } from '../../components/home/HomeEdition';
import { HomeAtmosphereMosaic } from '../../components/home/HomeAtmosphereMosaic';
import { editionAtmosphereCanvasClassName } from '../../components/patterns/edition-atmosphere/edition-atmosphere-canvas';
import type { StateStartEntry } from '../../components/home/StateStart';
import '../../components/data/data-charts.css';
import '../../components/home/home-edition.css';
import '../../components/patterns/browse-mode.css';
import '../../components/patterns/edition-fact-icon.css';
import '../../components/patterns/record-anatomy.css';
import '../../components/trust/research-pipeline-sketch.css';
import { FEATURED_SEED_IDS } from '../../data/public-seed';
import { buildHomeFeaturedCarouselSet } from '../../components/patterns/home-featured-set';
import { initialBrowseIndex } from '../../components/patterns/browse-mode';
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
  return min === max ? `${min}s` : `${min}s to ${max}s`;
}

export default async function HomePage() {
  const [base, timeline, statePopulationIndex] = await Promise.all([
    loadMapStageBase(),
    safe(getNationalPopulationTimelineSnapshot()).then((snap) => snap ?? undefined),
    loadStatePopulationIndex(),
  ]);

  // Full active-release carousel: curated ids lead when present, then every other release entity.
  const featured = buildHomeFeaturedCarouselSet(base.entities, FEATURED_SEED_IDS);
  const featuredInitialIndex = initialBrowseIndex(featured.length);

  const states = tallyStates(base.featureCollection);
  const recordCount = base.featureCollection.features.length;
  const eraSpan = eraSpanOf(base.featureCollection);

  // Decades in motion: per-decade edge lines from the history graph release + cumulative record
  // reveal over the shared feature collection. State fills prefer the Census index when present.
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
    <div className={`ds-home ${editionAtmosphereCanvasClassName()}`} data-home-edition="v6">
      <HomeAtmosphereMosaic />
      <HeroStage
        featureCollection={base.featureCollection}
        jurisdictionAreaFeatures={base.jurisdictionAreaFeatures}
        featureCount={recordCount}
        stateCount={states.length}
        decadeFrames={decadeFrames}
        {...(eraSpan !== undefined ? { eraSpan } : {})}
      />

      <HomeEdition
        featured={featured}
        featuredInitialIndex={featuredInitialIndex}
        topStates={states.slice(0, TOP_STATE_LIMIT)}
        recordCount={recordCount}
        stateCount={states.length}
        {...(eraSpan !== undefined ? { eraSpan } : {})}
        {...(timeline ? { timeline } : {})}
      />
    </div>
  );
}
