/**
 * Route-group layout for the two map surfaces (ADR-017 "Route-group layout owns the
 * canvas"). Server component: fetches the active release and builds the base feature collection
 * + MapLibre style exactly once (`loadMapStageBase`, memoized per-request), then renders the
 * client `MapStageProvider` — the app's SOLE `maplibre-gl` instance — around `{children}`.
 *
 * Because `/` and `/explore` are siblings under this layout, navigating between them re-renders
 * the page trees but never this layout: the canvas element, WebGL context, loaded tiles, and
 * camera all survive by construction. `data-surface="map"` marks the persistent canvas for
 * shell body clearance / page-field opt-out; the site header follows `[data-theme]` like
 * every other route (no map-only fixed-ink navbar override).
 *
 * Must stay dynamic: App Hosting mounts DATABASE_URL at RUNTIME only. A build-time static
 * `/` (hero) would bake the 4-entity Dunbar seed into production while `/explore/api` still
 * reads live Postgres — the exact split that made the homepage show 4 pins.
 */
import type { ReactNode } from 'react';
import { loadMapStageBase } from './shared-map-data';
import { MapStageProvider } from './MapStage';
import './map-surfaces.css';

export const dynamic = 'force-dynamic';

export default async function MapSurfaceLayout({ children }: { readonly children: ReactNode }) {
  const base = await loadMapStageBase();

  return (
    <div className="ds-map-surface" data-surface="map">
      <MapStageProvider
        initialStyle={base.style}
        initialFeatureCollection={base.featureCollection}
        initialJurisdictionAreaFeatures={base.jurisdictionAreaFeatures}
        bounds={base.bounds}
      >
        {children}
      </MapStageProvider>
    </div>
  );
}
