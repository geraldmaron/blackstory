import { useEffect } from 'react';
import type { MapStageHandle } from '../../../components/map-stage/MapStage';
import type { ExploreMapFeature } from '../../../lib/map-experience/build-explore-map-source';
import { nationalFieldPatch } from '../../../lib/map-experience/national-field';
import type { ExploreViewModel } from '../explore-view-model';

/** Keeps the map plate in sync with the lens and the selection. Owns no state of its own. */
export function useMapSync(
  stage: MapStageHandle,
  view: ExploreViewModel,
  filtered: readonly ExploreMapFeature[],
  showPins: boolean,
  satellite: boolean,
  selectedId: string | undefined,
  stateCode: string,
) {
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
        },
      ),
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
  ]);

  useEffect(() => {
    stage.applyViewState({
      selectedState: stateCode || undefined,
      selectedEdge: undefined,
      selectedEntity: selectedId,
    });
  }, [selectedId, stage, stateCode]);
}
