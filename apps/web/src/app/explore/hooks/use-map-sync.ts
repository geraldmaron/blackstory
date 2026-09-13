import { useEffect, useRef } from 'react';
import type { MapStageHandle } from '../../../components/map-stage/MapStage';
import type { ExploreMapFeature } from '../../../lib/map-experience/build-explore-map-source';
import { nationalFieldPatch } from '../../../lib/map-experience/national-field';
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
  showPins: boolean,
  satellite: boolean,
  selectedId: string | undefined,
  stateCode: string,
  /**
   * Crossdissolve the next data patch instead of snapping to it.
   *
   * Set for one frame by the story's decade sweep, when it empties the plate before filling it
   * back up. Removing features from a GeoJSON source is otherwise instant, and a country's worth
   * of pins vanishing between frames reads as a rendering fault rather than as the archive being
   * rewound. Held in a ref so raising and lowering the flag does not itself re-patch the plate:
   * it is read at the moment the data changes, which is the only moment it means anything.
   */
  fadeNextPatch = false,
  /**
   * The Black-population choropleth tiers for the active layer model (from
   * `usePopulationChoropleth`, keyed on the Lens's own `layerMode` rather than the URL-seeded
   * `view.viewState.layerMode`). Defaults to empty so a caller mid-migration onto this hook still
   * gets the presence-only patch this effect always built. Empty levels are a no-op for
   * `nationalFieldPatch` — `MapStage` falls back to its density join whenever the choropleth list
   * is empty, so passing `NO_POPULATION_CHOROPLETH` here is exactly the resting behavior before
   * this parameter existed.
   */
  populationLevels: PopulationChoroplethLevels = NO_POPULATION_CHOROPLETH,
) {
  const fadeNextPatchRef = useRef(fadeNextPatch);
  fadeNextPatchRef.current = fadeNextPatch;

  /** Keep the plate showing exactly what the rail shows. One lens, two renderings of it. The
   * base is the same national field the Door paints; the lens only adds to it. */
  useEffect(() => {
    stage.patchData(
      nationalFieldPatch(
        { type: 'FeatureCollection', features: showPins ? filtered : [] },
        {
          layerMode: view.viewState.layerMode,
          densityLevels: view.densityLevels,
          clusteringEnabled: view.viewState.group,
          satellite,
          historyEdgeCollection: view.edgeLineCollection,
          stateChoroplethLevels: populationLevels.stateChoroplethLevels,
          countyChoroplethLevels: populationLevels.countyChoroplethLevels,
          ...(populationLevels.popGeo ? { popGeo: populationLevels.popGeo } : {}),
        },
      ),
      fadeNextPatchRef.current ? { fade: true } : undefined,
    );
  }, [
    filtered,
    showPins,
    satellite,
    stage,
    view.densityLevels,
    view.edgeLineCollection,
    view.viewState.group,
    view.viewState.layerMode,
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
