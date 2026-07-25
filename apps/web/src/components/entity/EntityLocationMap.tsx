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
  ENTITY_LOCATION_PIN_FEATURE_ID,
  ENTITY_LOCATION_PIN_HALO_LAYER_ID,
  ENTITY_LOCATION_PIN_SOURCE_ID,
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

/** Imperative controls handed back via `onMapReady` so a Cinematic Map Backdrop wrapper
 * (`EntityLocationCinematicMap.tsx`) can return the plate to its resting camera on close
 * (spec §2 rule 4) without this module needing to know about the pattern. */
export type EntityLocationMapControls = {
  readonly recenter: () => void;
};

export type EntityLocationMapProps = {
  readonly lat: number;
  readonly lng: number;
  readonly label: string;
  readonly precision: 'city' | 'neighborhood' | 'campus' | 'institution';
  readonly caption?: string;
  /** Cinematic Map Backdrop selection state (spec §2 rule 5/6) — pulses the halo ring when true. */
  readonly selected?: boolean;
  /** Cinematic Map Backdrop Rest/Invite lock (spec §2 rule 2) — hides the plate from assistive
   * tech and (via CSS) disables pointer interaction until Engaged. */
  readonly locked?: boolean;
  readonly onMapReady?: (controls: EntityLocationMapControls) => void;
};

const SELECTED_PULSE_PERIOD_MS = 1800;
/* Reduced-motion static enlargement, matching the shared marker pulse's fallback shape
 * (cinematic-map.css `@media (prefers-reduced-motion: reduce)`) even though this pin is
 * canvas-painted rather than a DOM marker — see repo-9q3t for the known cross-surface gap in
 * matching exact spec pulse values, which this does not attempt to fix. */
const REDUCED_MOTION_HALO_RADIUS = 14 * 1.35;
const REDUCED_MOTION_HALO_OPACITY = 0.85;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type LoadState = 'loading' | 'ready' | 'unavailable';

/** Matches MapStage: site theme lives on `document.documentElement.dataset.theme`. */
function readDocumentColorScheme(): MapColorScheme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function EntityLocationMap({
  lat,
  lng,
  label,
  precision,
  caption,
  selected = false,
  locked = false,
  onMapReady,
}: EntityLocationMapProps) {
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const schemeRef = useRef<MapColorScheme>(readDocumentColorScheme());
  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [styleGeneration, setStyleGeneration] = useState(0);

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
          onMapReadyRef.current?.({
            recenter: () => {
              const activeMap = mapRef.current;
              if (!activeMap) return;
              const target = { center: [lng, lat] as [number, number], zoom: zoomForLocationPrecision(precision) };
              if (prefersReducedMotion()) {
                activeMap.jumpTo(target);
              } else {
                activeMap.flyTo({ ...target, duration: 900 });
              }
            },
          });
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
        // New style = new source = feature-state wiped; bump so the selection-pulse effect
        // below re-applies it against the fresh source.
        setStyleGeneration((generation) => generation + 1);
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

  // Cinematic Map Backdrop selection pulse (spec §3 rule 6, §2 rule 5). Only ever targets this
  // one feature — there is nothing else on this plate to accidentally flash.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadState !== 'ready') return undefined;

    const featureTarget = { source: ENTITY_LOCATION_PIN_SOURCE_ID, id: ENTITY_LOCATION_PIN_FEATURE_ID };

    if (!selected) {
      map.setFeatureState(featureTarget, { selected: false });
      if (map.getLayer(ENTITY_LOCATION_PIN_HALO_LAYER_ID)) {
        map.setPaintProperty(ENTITY_LOCATION_PIN_HALO_LAYER_ID, 'circle-radius', 14);
        map.setPaintProperty(ENTITY_LOCATION_PIN_HALO_LAYER_ID, 'circle-opacity', 0.35);
      }
      return undefined;
    }

    map.setFeatureState(featureTarget, { selected: true });

    if (prefersReducedMotion()) {
      map.setPaintProperty(ENTITY_LOCATION_PIN_HALO_LAYER_ID, 'circle-radius', REDUCED_MOTION_HALO_RADIUS);
      map.setPaintProperty(ENTITY_LOCATION_PIN_HALO_LAYER_ID, 'circle-opacity', REDUCED_MOTION_HALO_OPACITY);
      return undefined;
    }

    const start = performance.now();
    let frame = window.requestAnimationFrame(function tick(now) {
      const progress = ((now - start) % SELECTED_PULSE_PERIOD_MS) / SELECTED_PULSE_PERIOD_MS;
      const wave = (Math.sin(progress * Math.PI * 2) + 1) / 2;
      if (map.getLayer(ENTITY_LOCATION_PIN_HALO_LAYER_ID)) {
        map.setPaintProperty(ENTITY_LOCATION_PIN_HALO_LAYER_ID, 'circle-radius', 16 + wave * 8);
        map.setPaintProperty(ENTITY_LOCATION_PIN_HALO_LAYER_ID, 'circle-opacity', 0.4 + wave * 0.3);
      }
      frame = window.requestAnimationFrame(tick);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selected, loadState, styleGeneration]);

  return (
    <figure
      className="ds-entity-location-map"
      aria-labelledby={titleId}
      aria-hidden={locked ? 'true' : undefined}
    >
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
