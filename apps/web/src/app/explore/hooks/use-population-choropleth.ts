/**
 * The population choropleth's data link: turns the active layer model into the per-geography
 * tiers `MapStageDataPatch` carries, fetching the compact decennial index the first time a
 * reader actually asks for one.
 *
 * Every other stage of this pipeline already existed — the static indexes under `/geo/`, the
 * bucketing (`state-choropleth.ts` / `county-choropleth.ts`), the geometry joins, the stage
 * props, the style branches and the Lens UI. What was missing was the call: nothing in the
 * client ever built the levels, so `blackShare` / `blackChange` restyled the map and then
 * painted every polygon `unknown`. This hook is that call.
 *
 * Loading is lazy and keyed on the request, not eager on mount: the resting lens is `presence`,
 * and a reader who never opens a population layer never pays for the index.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_POPULATION_CHANGE_FROM,
  DEFAULT_POPULATION_CHANGE_TO,
  DEFAULT_POPULATION_DECADE,
  isCensusPopulationDecade,
  type CensusPopulationDecade,
} from '@repo/domain/map/county-population';
import {
  buildCountyChoroplethLevels,
  type CountyChoroplethLevel,
} from '../../../lib/map-experience/county-choropleth';
import {
  buildStateChoroplethLevels,
  type StateChoroplethLevel,
} from '../../../lib/map-experience/state-choropleth';
import {
  coercePopulationGeoForDecade,
  DEFAULT_POPULATION_GEO,
  defaultPopulationChangeFrom,
  defaultPopulationChangeTo,
  defaultPopulationDecade,
  type ExplorePopulationGeo,
} from '../../../lib/map-experience/explore-population';
import { fetchCountyPopulationIndex } from '../../../lib/map-experience/load-county-population-index';
import { fetchStatePopulationIndex } from '../../../lib/map-experience/load-state-population-index';
import {
  isPopulationLayerMode,
  type ExploreLayerMode,
  type ExploreViewState,
} from '../../../lib/map-experience/url-state';

/** The two level lists a stage patch carries, plus the geography they were built for. Exactly
 * one of the level lists is ever non-empty. */
export type PopulationChoroplethLevels = {
  readonly popGeo: ExplorePopulationGeo | undefined;
  readonly stateChoroplethLevels: readonly StateChoroplethLevel[];
  readonly countyChoroplethLevels: readonly CountyChoroplethLevel[];
};

/** No population layer is on — the state polygons keep their presence density join. */
export const NO_POPULATION_CHOROPLETH: PopulationChoroplethLevels = {
  popGeo: undefined,
  stateChoroplethLevels: [],
  countyChoroplethLevels: [],
};

/**
 * What the active lens asks the population index for, or `undefined` when no population layer
 * is on. Split out from the hook because this is the whole decision — which geography, which
 * vintages — and it is worth testing without a React renderer.
 *
 * The `popGeo` / `popDecade` family is URL state (`parseExploreSearchParams`), and it is only
 * populated when the incoming address already named a population layer. A reader who switches
 * the Lens to `blackShare` on a default `/explore` therefore arrives here with none of it set,
 * so every field falls back to the same defaults the URL parser would have used.
 */
export type PopulationChoroplethRequest =
  | {
      readonly geo: 'state';
      readonly mode: 'blackShare' | 'blackChange';
      readonly decade: string;
      readonly fromDecade: string;
      readonly toDecade: string;
    }
  | {
      readonly geo: 'county';
      readonly mode: 'blackShare' | 'blackChange';
      readonly decade: CensusPopulationDecade;
      readonly fromDecade: CensusPopulationDecade;
      readonly toDecade: CensusPopulationDecade;
    };

function censusDecade(raw: string, fallback: CensusPopulationDecade): CensusPopulationDecade {
  return isCensusPopulationDecade(raw) ? raw : fallback;
}

export function populationChoroplethRequest(
  layerMode: ExploreLayerMode,
  viewState: Pick<ExploreViewState, 'popGeo' | 'popDecade' | 'popFrom' | 'popTo'>,
): PopulationChoroplethRequest | undefined {
  if (!isPopulationLayerMode(layerMode)) return undefined;

  const geoBase: ExplorePopulationGeo = viewState.popGeo ?? DEFAULT_POPULATION_GEO;
  const decade = viewState.popDecade ?? defaultPopulationDecade(geoBase);
  const fromDecade = viewState.popFrom ?? defaultPopulationChangeFrom(geoBase);
  const toDecade = viewState.popTo ?? defaultPopulationChangeTo(geoBase);
  // County geometry only carries modern FIPS vintages, so a historical decade falls back to
  // state granularity — the same coercion the URL parser and the layer picker both apply.
  const geo = coercePopulationGeoForDecade(geoBase, layerMode === 'blackShare' ? decade : toDecade);

  if (geo === 'county') {
    return {
      geo,
      mode: layerMode,
      decade: censusDecade(decade, DEFAULT_POPULATION_DECADE),
      fromDecade: censusDecade(fromDecade, DEFAULT_POPULATION_CHANGE_FROM),
      toDecade: censusDecade(toDecade, DEFAULT_POPULATION_CHANGE_TO),
    };
  }
  return { geo, mode: layerMode, decade, fromDecade, toDecade };
}

async function loadLevels(
  request: PopulationChoroplethRequest,
): Promise<PopulationChoroplethLevels> {
  if (request.geo === 'county') {
    const index = await fetchCountyPopulationIndex();
    return {
      popGeo: 'county',
      stateChoroplethLevels: [],
      countyChoroplethLevels: buildCountyChoroplethLevels({
        index,
        mode: request.mode,
        decade: request.decade,
        fromDecade: request.fromDecade,
        toDecade: request.toDecade,
      }),
    };
  }
  const index = await fetchStatePopulationIndex();
  return {
    popGeo: 'state',
    stateChoroplethLevels: buildStateChoroplethLevels({
      index,
      mode: request.mode,
      decade: request.decade,
      fromDecade: request.fromDecade,
      toDecade: request.toDecade,
    }),
    countyChoroplethLevels: [],
  };
}

/**
 * Tiers for the live layer model, empty until the index lands (and whenever no population layer
 * is on). Empty is the honest resting value: the join treats a missing level as `unknown`, which
 * paints the plain plate rather than a fabricated zero.
 *
 * `viewState` is passed through untouched (never rebuilt into a fresh object) so a caller can
 * hand this the explore view model's own `viewState` without a structural mismatch.
 */
export function usePopulationChoropleth(
  layerMode: ExploreLayerMode,
  viewState: Pick<ExploreViewState, 'popGeo' | 'popDecade' | 'popFrom' | 'popTo'>,
): PopulationChoroplethLevels {
  const request = useMemo(
    () => populationChoroplethRequest(layerMode, viewState),
    [layerMode, viewState.popGeo, viewState.popDecade, viewState.popFrom, viewState.popTo],
  );
  const [levels, setLevels] = useState<PopulationChoroplethLevels>(NO_POPULATION_CHOROPLETH);

  useEffect(() => {
    if (!request) {
      setLevels(NO_POPULATION_CHOROPLETH);
      return;
    }
    let cancelled = false;
    loadLevels(request)
      .then((next) => {
        if (!cancelled) setLevels(next);
      })
      .catch((error) => {
        console.error('[Explore] population choropleth load failed', error);
        if (!cancelled) setLevels(NO_POPULATION_CHOROPLETH);
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  return levels;
}
