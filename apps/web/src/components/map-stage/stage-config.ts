import type { StyleSpecification } from 'maplibre-gl';
import type {
  ExploreMapFeatureCollection,
  JurisdictionAreaFeature,
} from '../../lib/map-experience/build-explore-map-source';
import type { HistoryEdgeLineCollection } from '../../lib/map-experience/build-history-edge-lines';
import type { StateDensityLevel } from '../../lib/map-experience/density';
import type { CountyChoroplethLevel } from '../../lib/map-experience/county-choropleth';
import type { StateChoroplethLevel } from '../../lib/map-experience/state-choropleth';
import type { ExploreLayerMode } from '../../lib/map-experience/url-state';
import type { ExplorePopulationGeo } from '../../lib/map-experience/explore-population';

/** The stage's resting config: everything the live plate was last told to show, held in a ref
 * rather than React state so a patch can update it and read it back synchronously in the same
 * tick (`commitDataPatch` writes, `applyStyleAndData` reads, both outside React's render loop). */
export type StageConfig = {
  style: StyleSpecification;
  featureCollection: ExploreMapFeatureCollection;
  jurisdictionAreaFeatures: readonly JurisdictionAreaFeature[];
  layerMode: ExploreLayerMode;
  popGeo: ExplorePopulationGeo;
  densityLevels: readonly StateDensityLevel[];
  stateChoroplethLevels: readonly StateChoroplethLevel[];
  countyChoroplethLevels: readonly CountyChoroplethLevel[];
  clusteringEnabled: boolean;
  satellite: boolean;
  historyEdgesEnabled: boolean;
  historyEdgeCollection: HistoryEdgeLineCollection;
  selectedState: string | undefined;
  selectedEdge: string | undefined;
  selectedEntity: string | undefined;
};

export const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] } as const;

export const EMPTY_EDGE_COLLECTION: HistoryEdgeLineCollection = {
  type: 'FeatureCollection',
  features: [],
};
