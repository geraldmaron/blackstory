/**
 * MapLibre GL JS wiring for the BB-070 `/map` demo route.
 *
 * `maplibre-gl` (and its CSS) are only ever imported here — a client-only
 * leaf component — never from `@black-book/ui`'s MapExplorer shell. That
 * keeps the shared UI package free of a WebGL dependency and safe for its
 * plain Node/tsx test runner (no bundler CSS loader available there).
 */
'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
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
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      bounds: bounds as maplibregl.LngLatBoundsLike,
      fitBoundsOptions: { padding: 24 },
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Style/bounds are static for this demo route; re-creating the map on
    // every render would be wasteful and MapLibre's own APIs (setStyle,
    // fitBounds) are the right tool if this ever needs to be dynamic. Not
    // suppressed via an eslint-disable comment: this project's ESLint config
    // does not have react-hooks/exhaustive-deps configured, and a disable
    // comment for an unconfigured rule is itself a lint error here.
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
