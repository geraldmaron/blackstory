/**
 * The national field: the one patch shape every surface hands the persistent plate.
 *
 * The Door and Explore draw the same map. Not "similar" — the same `MapStage`, the same
 * `buildExploreMapStyle`, the same GeoJSON clustering, the same entity markers. Before this
 * module the Door drew its own static Albers board of every individual record while Explore
 * (when its style applied at all) grouped nearby records into counted aggregates; a reader who
 * walked from one to the other met two different maps of one archive.
 *
 * So the resting frame is defined once: grouped at national zoom, Explore's resting presence
 * tint, no relationship lines, the flat cartographic plate. Explore spreads its lens over this
 * base (`useMapSync`, `AtlasExperience`); the Door hands it the pin plate and its state tiers
 * (`DoorImmersive`). A surface that wants the map to look different has to say so here or in an
 * override, not by building a second map.
 */
import type { MapStageDataPatch } from '../../components/map-stage/MapStage';
import type { ExploreMapFeatureCollection } from './build-explore-map-source';
import { defaultExploreOverlayState } from './url-state';

/**
 * Nearby records aggregate at national and regional zoom, on every surface. `/explore?group=0`
 * is the reader's own opt-out on Explore and stays shareable; it is not a default.
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
    // Explore's own resting layer model (presence density), so a surface that passes density
    // levels paints the same state tint Explore opens on. Empty levels paint plain land.
    layerMode: defaultExploreOverlayState().layerMode,
    densityLevels: [],
    clusteringEnabled: NATIONAL_FIELD_GROUPING,
    satellite: false,
    historyEdgesEnabled: false,
    historyEdgeCollection: EMPTY_LINES,
    ...overrides,
  };
}
