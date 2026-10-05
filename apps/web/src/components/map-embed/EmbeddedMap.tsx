'use client';

/**
 * A real map inside a page, that grows to full screen right where it is.
 *
 * In the page it is a live MapLibre map with the Explore cartography, using MapLibre's supported
 * cooperative gestures: one finger keeps scrolling the page, two fingers pan and pinch the map.
 * A tap on it (touch screens) or the expand button grows the same map — same instance, same
 * camera — to full screen with an animation from its slot, where one finger pans and a pinch
 * zooms. Close (or Escape) shrinks it back into the slot. Nothing navigates; no second map is
 * built; the page underneath never moves.
 *
 * Mounted lazily (only once the slot is near the viewport) and torn down with the page, so a
 * record page costs one GL context only while its map is actually wanted. Until the map has
 * painted — and forever where WebGL is unavailable — the static locator stands in.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { brandPalette } from '@repo/ui';
import { buildExploreMapStyle } from '../../app/map/explore-style';
import { readDocumentColorScheme } from '../map-stage/color-scheme';
import { attachSafariPageZoomGuard } from '../map-stage/custom-rotate-gestures';
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM } from '../../lib/map-experience/camera-presets';
import { useFocusTrap } from '../../lib/keyboard/use-focus-trap';
import {
  bindMapResizeLifecycle,
  bindWebGlContextRecovery,
  isWebGlAvailable,
  resizeMapInPlace,
  waitForContainerLayout,
} from '../../lib/map-experience/map-libre-lifecycle';
import { RecordLocator } from '../patterns/RecordLocator';
import { applyEmbeddedGestures, fixedBoxFor } from './embedded-map-gestures';
import './embedded-map.css';

void React;

const EXPAND_MS = 280;
const PLACE_SOURCE = 'embed-place';

export type EmbeddedMapProps = {
  readonly lat: number;
  readonly lng: number;
  /** The place in words, for the accessible name and the static stand-in. */
  readonly label: string;
  readonly accessibleName?: string;
  /** Opening zoom. City scale by default — the record is held to city precision. */
  readonly zoom?: number;
  readonly className?: string;
};

type Status = 'idle' | 'loading' | 'ready' | 'failed';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * The browser's top layer, via the Popover API: an element shown as a popover paints above every
 * stacking context on the page — the site header included — without moving in the DOM, so the
 * map instance and its WebGL canvas are untouched. Where the API is missing, the frame falls back
 * to a high z-index (CSS), which is right everywhere the header does not form its own layer.
 */
function supportsTopLayer(element: HTMLElement): boolean {
  return typeof (element as HTMLElement & { showPopover?: unknown }).showPopover === 'function';
}

function enterTopLayer(element: HTMLElement): void {
  if (!supportsTopLayer(element)) return;
  if (!element.hasAttribute('popover')) element.setAttribute('popover', 'manual');
  if (!element.matches(':popover-open')) element.showPopover();
}

function leaveTopLayer(element: HTMLElement): void {
  if (!supportsTopLayer(element) || !element.hasAttribute('popover')) return;
  if (element.matches(':popover-open')) element.hidePopover();
}

function prefersCoarsePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

function styleFor(scheme: ReturnType<typeof readDocumentColorScheme>) {
  return buildExploreMapStyle({
    featureCollection: { type: 'FeatureCollection', features: [] },
    jurisdictionAreaFeatures: [],
    layerMode: 'off',
    clusteringEnabled: false,
    colorScheme: scheme,
  });
}

function addPlace(map: MapLibreMap, lng: number, lat: number): void {
  if (map.getSource(PLACE_SOURCE)) return;
  map.addSource(PLACE_SOURCE, {
    type: 'geojson',
    data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } },
  });
  // A ring, not a filled disc: the locator's honest mark for a point held to city precision.
  map.addLayer({
    id: `${PLACE_SOURCE}-halo`,
    type: 'circle',
    source: PLACE_SOURCE,
    paint: { 'circle-radius': 14, 'circle-color': brandPalette.copperPin, 'circle-opacity': 0.22 },
  });
  map.addLayer({
    id: `${PLACE_SOURCE}-ring`,
    type: 'circle',
    source: PLACE_SOURCE,
    paint: {
      'circle-radius': 7,
      'circle-color': brandPalette.copperPin,
      'circle-opacity': 0.35,
      'circle-stroke-width': 2.5,
      'circle-stroke-color': brandPalette.copperDark,
    },
  });
}

export function EmbeddedMap({
  lat,
  lng,
  label,
  accessibleName,
  zoom = 11,
  className,
}: EmbeddedMapProps) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const expandedRef = useRef(false);
  const [status, setStatus] = useState<Status>('idle');
  /** The slot has come near the viewport: build the map. Separate from `status` so a status change
   * never re-runs (and so tears down) the effect that owns the map. */
  const [wanted, setWanted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const place = accessibleName?.trim() || label.trim();

  useFocusTrap(frameRef, expanded, { overlayRef: frameRef });

  // Mount the map only once its slot is near the viewport.
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || wanted) return;
    if (typeof IntersectionObserver === 'undefined') {
      setWanted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setWanted(true);
        }
      },
      { rootMargin: '300px 0px' },
    );
    observer.observe(slot);
    return () => observer.disconnect();
  }, [wanted]);

  const expand = useCallback(() => {
    const frame = frameRef.current;
    const map = mapRef.current;
    if (!frame || !map || expandedRef.current) return;
    expandedRef.current = true;
    const from = frame.getBoundingClientRect();
    Object.assign(frame.style, { transition: 'none', ...fixedBoxFor(from) });
    frame.dataset.state = 'open';
    enterTopLayer(frame);
    document.documentElement.setAttribute('data-embed-map-open', '');
    void frame.getBoundingClientRect();
    const reduce = prefersReducedMotion();
    requestAnimationFrame(() => {
      frame.style.transition = reduce
        ? 'none'
        : `top ${EXPAND_MS}ms var(--ds-easing), left ${EXPAND_MS}ms var(--ds-easing), width ${EXPAND_MS}ms var(--ds-easing), height ${EXPAND_MS}ms var(--ds-easing), border-radius ${EXPAND_MS}ms var(--ds-easing)`;
      Object.assign(frame.style, { top: '0px', left: '0px', width: '100vw', height: '100dvh' });
    });
    applyEmbeddedGestures(map, true);
    setExpanded(true);
    window.setTimeout(() => resizeMapInPlace(map), reduce ? 0 : EXPAND_MS + 20);
  }, []);

  const collapse = useCallback(() => {
    const frame = frameRef.current;
    const slot = slotRef.current;
    const map = mapRef.current;
    if (!frame || !slot || !map || !expandedRef.current) return;
    expandedRef.current = false;
    const reduce = prefersReducedMotion();
    const to = slot.getBoundingClientRect();
    Object.assign(frame.style, fixedBoxFor(to));
    applyEmbeddedGestures(map, false);
    setExpanded(false);
    const settle = () => {
      leaveTopLayer(frame);
      frame.style.cssText = '';
      delete frame.dataset.state;
      document.documentElement.removeAttribute('data-embed-map-open');
      resizeMapInPlace(map);
      expandButtonRef.current?.focus();
    };
    window.setTimeout(settle, reduce ? 0 : EXPAND_MS + 20);
  }, []);

  // Build the map.
  useEffect(() => {
    if (!wanted) return;
    const container = canvasRef.current;
    if (!container) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let guard: { detach(): void } | null = null;
    let themeObserver: MutationObserver | null = null;
    let resizeLifecycle: { disconnect(): void } | null = null;
    let contextRecovery: { disconnect(): void } | null = null;

    void (async () => {
      try {
        // The same mount guards the shared plate uses (map-libre-lifecycle.ts): no WebGL means the
        // static locator stays, and a zero-size box (Safari mini-map blank frames) is waited out.
        if (!isWebGlAvailable()) {
          setStatus('failed');
          return;
        }
        setStatus('loading');
        await waitForContainerLayout(container);
        const maplibregl = (await import('maplibre-gl')).default;
        if (cancelled) return;
        map = new maplibregl.Map({
          container,
          style: styleFor(readDocumentColorScheme()),
          center: [lng, lat],
          zoom,
          minZoom: MAP_MIN_ZOOM,
          maxZoom: MAP_MAX_ZOOM,
          attributionControl: false,
          renderWorldCopies: false,
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
          // Resizing is the shared lifecycle's job (below), as it is for the plate.
          trackResize: false,
        });
        mapRef.current = map;
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
        applyEmbeddedGestures(map, false);
        guard = attachSafariPageZoomGuard(container);
        const active = map;
        resizeLifecycle = bindMapResizeLifecycle(container, () => resizeMapInPlace(active));
        contextRecovery = bindWebGlContextRecovery(
          active.getCanvas(),
          () => {
            if (!cancelled) setStatus('failed');
          },
          () => {
            if (!cancelled) resizeMapInPlace(active);
          },
        );
        active.on('style.load', () => addPlace(active, lng, lat));
        active.once('load', () => {
          if (!cancelled) setStatus('ready');
        });
        active.on('error', (event) => console.error('[EmbeddedMap]', event.error));
        // A tap — not a scroll, not a two-finger gesture — on a touch screen asks for the map.
        active.on('click', () => {
          if (!expandedRef.current && prefersCoarsePointer()) expand();
        });
        // Follow the site theme like the plate does.
        themeObserver = new MutationObserver(() => {
          active.setStyle(styleFor(readDocumentColorScheme()));
        });
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme'],
        });
      } catch {
        if (!cancelled) setStatus('failed');
      }
    })();

    return () => {
      cancelled = true;
      themeObserver?.disconnect();
      resizeLifecycle?.disconnect();
      contextRecovery?.disconnect();
      guard?.detach();
      map?.remove();
      mapRef.current = null;
      if (expandedRef.current) {
        expandedRef.current = false;
        document.documentElement.removeAttribute('data-embed-map-open');
      }
    };
  }, [wanted, lat, lng, zoom, expand]);

  // Escape closes; focus goes to Close when it opens.
  useEffect(() => {
    if (!expanded) return;
    closeButtonRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      collapse();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded, collapse]);

  const ready = status === 'ready';
  const rootClass = ['ds-embed-map', className ?? ''].filter(Boolean).join(' ');

  return (
    <div ref={slotRef} className={rootClass} data-status={status}>
      {/* The stand-in until the map paints, and the whole answer where WebGL is unavailable. */}
      {ready ? null : (
        <RecordLocator
          lat={lat}
          lng={lng}
          label={label}
          {...(accessibleName !== undefined ? { accessibleName } : {})}
          className="ds-embed-map__standin"
        />
      )}
      {status === 'failed' ? null : (
        <div
          ref={frameRef}
          className="ds-embed-map__frame"
          {...(expanded
            ? { role: 'dialog', 'aria-modal': true, 'aria-label': `Map of ${place}` }
            : {})}
        >
          <div
            ref={canvasRef}
            className="ds-embed-map__canvas"
            role="region"
            aria-label={`Map of ${place}. Use two fingers or Control and scroll to move it, or expand it.`}
          />
          {ready ? (
            expanded ? (
              <button
                ref={closeButtonRef}
                type="button"
                className="ds-embed-map__button ds-embed-map__button--close"
                onClick={collapse}
                aria-label="Close full-screen map"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M3.5 3.5l9 9m0-9-9 9"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : (
              <button
                ref={expandButtonRef}
                type="button"
                className="ds-embed-map__button"
                onClick={expand}
                aria-label="Expand map to full screen"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M9.5 2.5h4v4m0-4-5 5m-2 6h-4v-4m0 4 5-5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}
