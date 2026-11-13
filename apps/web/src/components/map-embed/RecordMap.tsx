'use client';

/**
 * The one embedded map: a record's place on a record page, a place page or a story inset.
 *
 * Framed at the zoom its stored precision allows (`zoomForLocationPrecision`, capped by `maxZoom`
 * where a small frame needs context) and marked by the atlas's own style, as the atlas marks a
 * selected record (`recordMarkFor`): a copper dot at a site, a copper ring at a campus,
 * neighborhood or city, and for a county or state no point at all, only the copper jurisdiction
 * tag at the state's label point, which is also where the frame is centered (`renderedAnchorFor`).
 * A site dot carries the label beside it, so the frame still says what is there when the tiles
 * around it are empty (a swamp, a field). MapLibre's cooperative gestures keep
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
import type {
  ExploreMapFeature,
  ExploreMapFeatureCollection,
} from '../../lib/map-experience/build-explore-map-source';
import { renderedAnchorFor } from '../../lib/map-experience/record-marks';
import { readDocumentColorScheme } from '../map-stage/color-scheme';
import { setSelectedEntityFilter } from '../map-stage/selection-sync';
import { attachSafariPageZoomGuard } from '../map-stage/custom-rotate-gestures';
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM } from '../../lib/map-experience/camera-presets';
import { plateForScheme } from '../../lib/map-experience/dignity-style';
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
/** The one record on this map, as the atlas style's sources know it. */
const RECORD_ID = 'record';

export type RecordMapProps = {
  readonly lat: number;
  readonly lng: number;
  /** The place in words: the caption, the site dot's map label, and the map's accessible name. */
  readonly label: string;
  /** Stored public precision; decides the zoom and the mark. */
  readonly precision: string;
  /** The record's state: where a county- or state-precision record's tag is drawn. */
  readonly statePostalCode?: string;
  /** A closest zoom for a small frame; never frames closer than the precision allows either way. */
  readonly maxZoom?: number;
  /** False where the page states the place itself (a record page's citation line). */
  readonly caption?: boolean;
  /** `/explore?selected=…` (`exploreRecordHref`). Omit where the page already links to the map. */
  readonly exploreHref?: string;
  readonly className?: string;
};

type Status = 'idle' | 'loading' | 'ready' | 'failed';

/** The record as a one-feature atlas source, so the atlas style draws its mark or its tag. */
function recordCollection(
  lng: number,
  lat: number,
  precision: string,
  statePostalCode: string | undefined,
): ExploreMapFeatureCollection {
  const feature = {
    type: 'Feature',
    id: RECORD_ID,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      entityId: RECORD_ID,
      precision,
      ...(statePostalCode ? { statePostalCode } : {}),
    },
  } as unknown as ExploreMapFeature;
  return { type: 'FeatureCollection', features: [feature] };
}

function styleFor(
  scheme: ReturnType<typeof readDocumentColorScheme>,
  record: ExploreMapFeatureCollection,
) {
  return buildExploreMapStyle({
    featureCollection: record,
    jurisdictionAreaFeatures: [],
    layerMode: 'off',
    clusteringEnabled: false,
    colorScheme: scheme,
  });
}

/** Selects the record in the atlas style, and names a site dot beside it. */
function markRecord(map: MapLibreMap, lng: number, lat: number, precision: string, label: string) {
  setSelectedEntityFilter(map, RECORD_ID);
  // A ring sits on a named neighborhood or city the plate already labels; a site dot does not.
  if (recordMarkFor(precision) !== 'dot' || label.length === 0 || map.getSource(MARK_SOURCE)) {
    return;
  }
  const plate = plateForScheme(readDocumentColorScheme());
  map.addSource(MARK_SOURCE, {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: { label },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    },
  });
  map.addLayer({
    id: `${MARK_SOURCE}-label`,
    type: 'symbol',
    source: MARK_SOURCE,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      'text-max-width': 10,
      'text-anchor': 'left',
      'text-justify': 'left',
      'text-offset': [0.9, 0],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': plate.placeLabelHi,
      'text-halo-color': plate.placeLabelHalo,
      'text-halo-width': 1.4,
    },
  });
}

export function RecordMap({
  lat,
  lng,
  label,
  precision,
  statePostalCode,
  maxZoom = MAP_MAX_ZOOM,
  caption = true,
  exploreHref,
  className,
}: RecordMapProps) {
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
        const record = recordCollection(lng, lat, precision, statePostalCode);
        const center = renderedAnchorFor(record.features[0]!);
        map = new maplibregl.Map({
          container,
          style: styleFor(readDocumentColorScheme(), record),
          center: [center[0], center[1]],
          zoom: Math.min(zoomForLocationPrecision(precision), maxZoom, MAP_MAX_ZOOM),
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
        active.on('style.load', () => markRecord(active, lng, lat, precision, label.trim()));
        active.once('load', () => {
          if (!cancelled) setStatus('ready');
        });
        active.on('error', (event) => console.error('[RecordMap]', event.error));
        themeObserver = new MutationObserver(() => {
          active.setStyle(styleFor(readDocumentColorScheme(), record));
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
  }, [wanted, lat, lng, precision, statePostalCode, maxZoom, label]);

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
      {caption ? (
        <figcaption className="ds-record-map__caption">
          <span className="ds-record-map__place">{place}</span>
          <span className="ds-record-map__precision">{precisionInWords(precision)}</span>
          {exploreHref ? (
            <a className="ds-record-map__open" href={exploreHref}>
              Open on the map
            </a>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
