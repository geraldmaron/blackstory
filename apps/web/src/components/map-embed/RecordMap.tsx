'use client';

/**
 * The one embedded map: a record's place on a record page, a place page or a story inset.
 *
 * Framed at the zoom its stored precision allows (`zoomForLocationPrecision`) and marked the way
 * the atlas marks a selected record (`recordMarkFor`): a copper dot at a site, a copper ring at a
 * neighborhood or city, no mark at all for a county or state. MapLibre's cooperative gestures keep
 * one finger (and a plain wheel) scrolling the page. "Open on the map" hands off to /explore with
 * the record selected, where the same `frameRecord` contract frames it.
 *
 * The figure, caption and link are ordinary server-rendered HTML; the canvas mounts lazily once
 * the slot nears the viewport, and is simply absent where WebGL is unavailable.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildExploreMapStyle } from '../../app/map/explore-style';
import { readDocumentColorScheme } from '../map-stage/color-scheme';
import { attachSafariPageZoomGuard } from '../map-stage/custom-rotate-gestures';
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM } from '../../lib/map-experience/camera-presets';
import { DIGNITY_PALETTE, plateForScheme } from '../../lib/map-experience/dignity-style';
import {
  precisionInWords,
  recordMarkFor,
  zoomForLocationPrecision,
} from '../../lib/map-experience/geo-precision';
import {
  bindMapResizeLifecycle,
  bindWebGlContextRecovery,
  isWebGlAvailable,
  resizeMapInPlace,
  waitForContainerLayout,
} from '../../lib/map-experience/map-libre-lifecycle';
import './record-map.css';

void React;

const MARK_SOURCE = 'record-map-mark';

export type RecordMapProps = {
  readonly lat: number;
  readonly lng: number;
  /** The place in words: the caption, and the map's accessible name. */
  readonly label: string;
  /** Stored public precision; decides the zoom and the mark. */
  readonly precision: string;
  /** `/explore?selected=…` (`exploreRecordHref`). Omit where the page already links to the map. */
  readonly exploreHref?: string;
  readonly className?: string;
};

type Status = 'idle' | 'loading' | 'ready' | 'failed';

function styleFor(scheme: ReturnType<typeof readDocumentColorScheme>) {
  return buildExploreMapStyle({
    featureCollection: { type: 'FeatureCollection', features: [] },
    jurisdictionAreaFeatures: [],
    layerMode: 'off',
    clusteringEnabled: false,
    colorScheme: scheme,
  });
}

function addMark(map: MapLibreMap, lng: number, lat: number, precision: string): void {
  const mark = recordMarkFor(precision);
  if (mark === 'none' || map.getSource(MARK_SOURCE)) return;
  map.addSource(MARK_SOURCE, {
    type: 'geojson',
    data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } },
  });
  // The atlas's selected mark: copper with a paper halo, at the mark's own size.
  map.addLayer({
    id: `${MARK_SOURCE}-point`,
    type: 'circle',
    source: MARK_SOURCE,
    paint: {
      'circle-radius': mark === 'dot' ? 5 : 7,
      'circle-color': DIGNITY_PALETTE.point,
      'circle-stroke-width': 2,
      'circle-stroke-color': plateForScheme(readDocumentColorScheme()).selectedHalo,
    },
  });
}

export function RecordMap({ lat, lng, label, precision, exploreHref, className }: RecordMapProps) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  /** The slot has come near the viewport: build the map. */
  const [wanted, setWanted] = useState(false);

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
          zoom: Math.min(zoomForLocationPrecision(precision), MAP_MAX_ZOOM),
          minZoom: MAP_MIN_ZOOM,
          maxZoom: MAP_MAX_ZOOM,
          attributionControl: false,
          renderWorldCopies: false,
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          trackResize: false,
        });
        const active = map;
        active.touchZoomRotate.disableRotation();
        active.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
        // Start the credit as the "i" button; the text opens on tap.
        const collapseAttribution = () => {
          const credit = container.querySelector('.maplibregl-ctrl-attrib');
          credit?.classList.remove('maplibregl-compact-show');
          credit?.removeAttribute('open');
        };
        collapseAttribution();
        active.once('load', collapseAttribution);
        guard = attachSafariPageZoomGuard(container);
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
        active.on('style.load', () => addMark(active, lng, lat, precision));
        active.once('load', () => {
          if (!cancelled) setStatus('ready');
        });
        active.on('error', (event) => console.error('[RecordMap]', event.error));
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
    };
  }, [wanted, lat, lng, precision]);

  const place = label.trim();

  return (
    <figure className={className ? `ds-record-map ${className}` : 'ds-record-map'}>
      {status === 'failed' ? null : (
        <div ref={slotRef} className="ds-record-map__frame" data-status={status}>
          <div
            ref={canvasRef}
            className="ds-record-map__canvas"
            role="region"
            aria-label={`Map of ${place}. Use two fingers, or Control and scroll, to move it.`}
          />
        </div>
      )}
      <figcaption className="ds-record-map__caption">
        <span className="ds-record-map__place">{place}</span>
        <span className="ds-record-map__precision">{precisionInWords(precision)}</span>
        {exploreHref ? (
          <a className="ds-record-map__open" href={exploreHref}>
            Open on the map
          </a>
        ) : null}
      </figcaption>
    </figure>
  );
}
