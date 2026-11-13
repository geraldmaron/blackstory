/**
 * The national field: the one patch shape every surface hands the persistent plate.
 *
 * The Door and Explore draw the same map. Not "similar" — the same `MapStage`, the same
 * `buildExploreMapStyle`, the same GeoJSON clustering, the same entity markers. Before this
 * module the Door drew its own static Albers board of every individual record while Explore
 * (when its style applied at all) grouped nearby records into counted aggregates; a reader who
 * walked from one to the other met two different maps of one archive.
 *
 * So the resting frame is defined once: grouped at national zoom, neutral land with no area
 * shading, no relationship lines, the flat cartographic plate. Explore spreads its lens over this
 * base (`useMapSync`, `AtlasExperience`); the Door hands it the pin plate and its state tiers
 * (`DoorImmersive`). A surface that wants the map to look different has to say so here or in an
 * override, not by building a second map.
 */
import type { MapStageDataPatch } from '../../components/map-stage/MapStage';
import type { ExploreMapFeatureCollection } from './build-explore-map-source';
import { defaultExploreOverlayState } from './url-state';

const EMPTY_LINES = { type: 'FeatureCollection', features: [] } as const;

export function nationalFieldPatch(
  featureCollection: ExploreMapFeatureCollection,
  overrides?: Partial<MapStageDataPatch>,
): MapStageDataPatch {
  return {
    featureCollection,
    jurisdictionAreaFeatures: [],
    // Explore's own resting layer model: neutral land, no area shading. Density is opt-in.
    layerMode: defaultExploreOverlayState().layerMode,
    densityLevels: [],
    // Nearby records always aggregate at national and regional zoom, on every surface.
    clusteringEnabled: true,
    satellite: false,
    historyEdgesEnabled: false,
    historyEdgeCollection: EMPTY_LINES,
    ...overrides,
  };
}
