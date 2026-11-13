import { useEffect } from 'react';
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
) {
  /** Keep the plate showing exactly what the list shows. One lens, two renderings of it. The
   * base is the same national field the Door paints; the lens only adds to it. */
  useEffect(() => {
    stage.patchData(
      nationalFieldPatch(
        { type: 'FeatureCollection', features: layers.pins ? filtered : [] },
        {
          layerMode,
          densityLevels: view.densityLevels,
          satellite: layers.satellite,
          historyEdgeCollection: view.edgeLineCollection,
          stateChoroplethLevels: populationLevels.stateChoroplethLevels,
          countyChoroplethLevels: populationLevels.countyChoroplethLevels,
          ...(populationLevels.popGeo ? { popGeo: populationLevels.popGeo } : {}),
        },
      ),
    );
  }, [
    filtered,
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
