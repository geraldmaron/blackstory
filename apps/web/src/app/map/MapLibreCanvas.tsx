/**
 * MapLibre GL JS wiring for the `/map` demo route.
 *
 * `maplibre-gl` (and its CSS) are only ever imported here a client-only
 * leaf component never from `@repo/ui`'s MapExplorer shell. That
 * keeps the shared UI package free of a WebGL dependency and safe for its
 * plain Node/tsx test runner (no bundler CSS loader available there).
 *
 * Large inline styles are applied with `addSource` `addLayer` after `load`
 * (same pattern as `ExploreMapCanvas`) so style loading cannot hang.
 */
'use client';

import { useEffect, useRef } from 'react';
import maplibregl, {
  type LayerSpecification,
  type SourceSpecification,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export type MapLibreCanvasProps = {
  readonly style: StyleSpecification;
  readonly bounds: readonly [west: number, south: number, east: number, north: number];
};

export function MapLibreCanvas({ style, bounds }: MapLibreCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }
    const cloned = JSON.parse(JSON.stringify(style)) as StyleSpecification;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#0A0A0A' },
          },
        ],
      },
      bounds: bounds as maplibregl.LngLatBoundsLike,
      fitBoundsOptions: { padding: 24 },
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.once('load', () => {
      for (const [id, source] of Object.entries(cloned.sources ?? {})) {
        if (!map.getSource(id)) map.addSource(id, source as SourceSpecification);
      }
      for (const layer of cloned.layers ?? []) {
        if (layer.type === 'symbol') continue;
        if (layer.id === 'background') {
          const color = (layer as { paint?: { 'background-color'?: string } }).paint?.[
            'background-color'
          ];
          if (color) map.setPaintProperty('background', 'background-color', color);
          continue;
        }
        if (!map.getLayer(layer.id)) map.addLayer(layer as LayerSpecification);
      }
      map.resize();
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
