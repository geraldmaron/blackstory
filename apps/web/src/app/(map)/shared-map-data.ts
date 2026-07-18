/**
 * Request-scoped shared data for the `(map)` route group (ADR-017 "Route-group layout owns the
 * canvas"): the group's `layout.tsx` fetches the active release and builds the base feature
 * collection + MapLibre style ONCE; `page.tsx` (homepage) and `explore/page.tsx` both read
 * through the same `React.cache()`-memoized entity fetch, so a single request never hits the
 * public data source twice even though two independent server components (a layout and its page)
 * each need it. `/explore`'s own page-level work collapses into view-model construction
 * (filtering, facets, edge catalogs) over this shared base, not a second style/feature build.
 */
import { cache } from 'react';
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import type { PublicEntityView } from '../../data/public-seed';
import {
  buildExploreMapSource,
  type ExploreMapFeatureCollection,
  type JurisdictionAreaFeature,
} from '../../lib/map-experience/build-explore-map-source';
import { listPublicEntityViews, type PublicReadSource } from '../../lib/public-data/source';
import { buildExploreMapStyle } from '../map/explore-style';

/** One fetch per request, however many server components ask for it. */
export const getSharedPublicEntities = cache(listPublicEntityViews);

export type MapStageBase = {
  readonly entities: readonly PublicEntityView[];
  readonly dataSource: PublicReadSource;
  readonly featureCollection: ExploreMapFeatureCollection;
  readonly jurisdictionAreaFeatures: readonly JurisdictionAreaFeature[];
  readonly style: ReturnType<typeof buildExploreMapStyle>;
  readonly bounds: typeof US_CONUS_BOUNDS;
};

/** Builds the ONE base feature collection + style the `(map)` layout hands to `MapStageProvider`
 * (unfiltered, density off, history edges off — every surface's own view state is a `patchData`/
 * `applyViewState` call on top of this resting frame, never a second style rebuild at this
 * layer). Memoized via `getSharedPublicEntities` above, so calling this from both the layout and
 * a page in the same request still only fetches once. */
export const loadMapStageBase = cache(async function loadMapStageBase(): Promise<MapStageBase> {
  const { data: entities, source: dataSource } = await getSharedPublicEntities();
  const mapSource = buildExploreMapSource(entities);
  const style = buildExploreMapStyle({
    featureCollection: mapSource.featureCollection,
    jurisdictionAreaFeatures: mapSource.jurisdictionAreaFeatures,
    densityLayerEnabled: false,
  });
  return {
    entities,
    dataSource,
    featureCollection: mapSource.featureCollection,
    jurisdictionAreaFeatures: mapSource.jurisdictionAreaFeatures,
    style,
    bounds: US_CONUS_BOUNDS,
  };
});
