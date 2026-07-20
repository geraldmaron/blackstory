/**
 * Route-group layout for the two map surfaces (ADR-017 "Route-group layout owns the
 * canvas"). Server component: fetches the active release and builds the base feature collection
 * + MapLibre style exactly once (`loadMapStageBase`, memoized per-request), then renders the
 * client `MapStageProvider` — the app's SOLE `maplibre-gl` instance — around `{children}`.
 *
 * Because `/` and `/explore` are siblings under this layout, navigating between them re-renders
 * the page trees but never this layout: the canvas element, WebGL context, loaded tiles, and
 * camera all survive by construction. `data-surface="map"` on the wrapper is the hook
 * `@repo/ui` shell-header CSS uses for the on-map ink bar (`.ds-shell:has([data-surface='map'])`).
 */
import type { ReactNode } from 'react';
import { loadMapStageBase } from './shared-map-data';
import { MapStageProvider } from './MapStage';
import './map-surfaces.css';

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
