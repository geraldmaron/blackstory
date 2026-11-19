import { useEffect, useRef } from 'react';
import type { MapStageHandle } from '../../../components/map-stage/MapStage';
import type { ExploreMapFeature } from '../../../lib/map-experience/build-explore-map-source';
import { nationalFieldPatch } from '../../../lib/map-experience/national-field';
import type { ExploreLayerMode } from '../../../lib/map-experience/url-state';
import type { ExploreViewModel } from '../explore-view-model';
import {
  NO_POPULATION_CHOROPLETH,
  type PopulationChoroplethLevels,
} from './use-population-choropleth';

/** Keeps the map plate in sync with the lens and the selection. Owns no state of its own. */
export function useMapSync(
  stage: MapStageHandle,
  view: ExploreViewModel,
  filtered: readonly ExploreMapFeature[],
  layers: { readonly pins: boolean; readonly satellite: boolean },
  /** The reader's own area shading (the column's layer chips), not the URL-seeded value. */
  layerMode: ExploreLayerMode,
  selectedId: string | undefined,
  stateCode: string,
  /** The Black-population choropleth tiers for `layerMode` (`usePopulationChoropleth`). */
  populationLevels: PopulationChoroplethLevels = NO_POPULATION_CHOROPLETH,
  /** Lens matches outside the brushed decades, drawn as sand ghosts. */
  ghosts: readonly ExploreMapFeature[] = [],
  /** The brushed range as a key; a change of range alone fades and drops the pins in. */
  periodKey = '',
) {
  const lastPeriodKey = useRef(periodKey);
  /** Keep the plate showing exactly what the list shows. One lens, two renderings of it. The
   * base is the same national field the Door paints; the lens only adds to it. */
  useEffect(() => {
    const brushed = lastPeriodKey.current !== periodKey;
    lastPeriodKey.current = periodKey;
    stage.patchData(
      nationalFieldPatch(
        { type: 'FeatureCollection', features: layers.pins ? filtered : [] },
        {
          layerMode,
          ghostCollection: { type: 'FeatureCollection', features: layers.pins ? ghosts : [] },
          densityLevels: view.densityLevels,
          satellite: layers.satellite,
          historyEdgeCollection: view.edgeLineCollection,
          stateChoroplethLevels: populationLevels.stateChoroplethLevels,
          countyChoroplethLevels: populationLevels.countyChoroplethLevels,
          ...(populationLevels.popGeo ? { popGeo: populationLevels.popGeo } : {}),
        },
      ),
      // Brushing the decade strip morphs: leaving pins ghost, arriving pins drop in. Every other
      // lens change snaps, as before.
      { fade: brushed },
    );
  }, [
    periodKey,
    filtered,
    ghosts,
    layers.pins,
    layers.satellite,
    layerMode,
    stage,
    view.densityLevels,
    view.edgeLineCollection,
    populationLevels,
  ]);

  useEffect(() => {
    stage.applyViewState({
      selectedState: stateCode || undefined,
      selectedEdge: undefined,
      selectedEntity: selectedId,
    });
  }, [selectedId, stage, stateCode]);
}
