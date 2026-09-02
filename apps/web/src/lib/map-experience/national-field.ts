/**
 * The national field: the one patch shape every surface hands the persistent plate.
 *
 * The Door and the Atlas draw the same map. Not "similar" — the same `MapStage`, the same
 * `buildExploreMapStyle`, the same GeoJSON clustering, the same entity markers. Before this
 * module the Door drew its own static Albers board of every individual record while the Atlas
 * (when its style applied at all) grouped nearby records into counted aggregates; a reader who
 * walked from one to the other met two different maps of one archive.
 *
 * So the resting frame is defined once: grouped at national zoom, the Atlas's resting presence
 * tint, no relationship lines, the flat cartographic plate. The Atlas spreads its lens over this
 * base (`useMapSync`, `AtlasExperience`); the Door hands it the pin plate and its state tiers
 * (`DoorImmersive`). A surface that wants the map to look different has to say so here or in an
 * override, not by building a second map.
 */
import type { MapStageDataPatch } from '../../components/map-stage/MapStage';
import type { ExploreMapFeatureCollection } from './build-explore-map-source';
import { defaultExploreOverlayState } from './url-state';

/**
 * Nearby records aggregate at national and regional zoom, on every surface. `/explore?group=0`
 * is the reader's own opt-out on the Atlas and stays shareable; it is not a default.
 */
export const NATIONAL_FIELD_GROUPING = true;

const EMPTY_LINES = { type: 'FeatureCollection', features: [] } as const;

export function nationalFieldPatch(
  featureCollection: ExploreMapFeatureCollection,
  overrides?: Partial<MapStageDataPatch>,
): MapStageDataPatch {
  return {
    featureCollection,
    jurisdictionAreaFeatures: [],
    // The Atlas's own resting layer model (presence density), so a surface that passes density
    // levels paints the same state tint the Atlas opens on. Empty levels paint plain land.
    layerMode: defaultExploreOverlayState().layerMode,
    densityLevels: [],
    clusteringEnabled: NATIONAL_FIELD_GROUPING,
    satellite: false,
    historyEdgesEnabled: false,
    historyEdgeCollection: EMPTY_LINES,
    ...overrides,
  };
}
