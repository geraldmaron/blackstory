/**
 * Client MapLibre snippet for entity pages: OpenFreeMap streets centered on the
 * record’s public-precision coordinates, with a copper pin. Plate colors follow
 * the site `data-theme` light/dark toggle (same contract as MapStage). Falls back
 * to a static frame when WebGL/map load fails. Dynamically imports maplibre-gl so
 * the entity RSC page stays free of a top-level WebGL dependency.
 */
'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapColorScheme } from '../../lib/map-experience/dignity-style';
import {
  buildEntityLocationMapStyle,
  zoomForLocationPrecision,
} from '../../lib/map-experience/entity-location-map-style';
import {
  bindMapResizeLifecycle,
  bindWebGlContextRecovery,
  containerHasLayout,
  isWebGlAvailable,
  waitForContainerLayout,
} from '../../lib/map-experience/map-libre-lifecycle';

export type EntityLocationMapProps = {
  readonly lat: number;
  readonly lng: number;
  readonly label: string;
  readonly precision: 'city' | 'neighborhood' | 'campus' | 'institution';
  readonly caption?: string;
};

type LoadState = 'loading' | 'ready' | 'unavailable';

/** Matches MapStage: site theme lives on `document.documentElement.dataset.theme`. */
function readDocumentColorScheme(): MapColorScheme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function EntityLocationMap({ lat, lng, label, precision, caption }: EntityLocationMapProps) {
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const schemeRef = useRef<MapColorScheme>(readDocumentColorScheme());
  const [loadState, setLoadState] = useState<LoadState>('loading');

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let cancelled = false;
    let map: MapLibreMap | undefined;
    let resizeLifecycle: ReturnType<typeof bindMapResizeLifecycle> | undefined;
    let contextRecovery: ReturnType<typeof bindWebGlContextRecovery> | undefined;

    void (async () => {
      try {
        await waitForContainerLayout(container);
        if (cancelled || !container.isConnected || !containerHasLayout(container)) return;

        if (!isWebGlAvailable()) {
          throw new Error('WebGL unavailable');
        }

        const maplibregl = (await import('maplibre-gl')).default;
        await import('maplibre-gl/dist/maplibre-gl.css');
        if (cancelled || !container.isConnected || !containerHasLayout(container)) return;

        const colorScheme = readDocumentColorScheme();
        schemeRef.current = colorScheme;
        map = new maplibregl.Map({
          container,
          style: buildEntityLocationMapStyle({ lat, lng, colorScheme }),
          center: [lng, lat],
          zoom: zoomForLocationPrecision(precision),
          minZoom: 8,
          maxZoom: 14,
          attributionControl: { compact: true },
          renderWorldCopies: false,
          cooperativeGestures: true,
        });
        mapRef.current = map;
        map.once('load', () => {
          if (cancelled) return;
          contextRecovery = bindWebGlContextRecovery(
            map!.getCanvas(),
            () => {
              if (!cancelled) setLoadState('unavailable');
            },
            () => {
              if (!cancelled) map?.resize();
            },
          );
          map?.resize();
          setLoadState('ready');
        });
        map.on('error', () => {
          if (!cancelled) setLoadState('unavailable');
        });

        resizeLifecycle = bindMapResizeLifecycle(container, () => {
          map?.resize();
        });
      } catch {
        if (!cancelled) setLoadState('unavailable');
      }
    })();

    return () => {
      cancelled = true;
      resizeLifecycle?.disconnect();
      contextRecovery?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, [lat, lng, precision]);

  useEffect(() => {
    const applyTheme = () => {
      const map = mapRef.current;
      if (!map) return;
      const scheme = readDocumentColorScheme();
      if (scheme === schemeRef.current) return;
      schemeRef.current = scheme;
      const center = map.getCenter();
      const zoom = map.getZoom();
      map.setStyle(buildEntityLocationMapStyle({ lat, lng, colorScheme: scheme }));
      map.once('style.load', () => {
        map.setCenter(center);
        map.setZoom(zoom);
        map.resize();
      });
    };

    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === 'data-theme')) {
        applyTheme();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, [lat, lng]);

  return (
    <figure className="ds-entity-location-map" aria-labelledby={titleId}>
      <p className="ds-visually-hidden" id={titleId}>
        Street map for {label} at {precision} precision
      </p>
      <div
        className="ds-entity-location-map__frame"
        ref={containerRef}
        role="img"
        aria-label={`Street map centered on ${label}`}
        data-load-state={loadState}
      />
      {loadState === 'unavailable' ? (
        <p className="ds-entity-location-map__fallback ds-sans" role="status">
          Map tiles could not load. Use Open in maps for street context.
        </p>
      ) : null}
      {caption ? (
        <figcaption className="ds-entity-location-map__caption">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
