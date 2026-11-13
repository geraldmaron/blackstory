'use client';

/**
 * The one embedded map: a record's place on a record page, a place page or a story inset.
 *
 * Framed no closer than its stored precision allows (`zoomForLocationPrecision`) and never closer
 * than `EMBED_CONTEXT_MAX_ZOOM`, so a small frame always reaches the nearest towns, and marked by
 * the atlas's own resting style (`recordMarkFor`): a copper dot at a site, one open copper ring at
 * a campus, neighborhood or city, and for a county or state no point at all, only the
 * jurisdiction tag at the state's label point, which is also where the frame is centered
 * (`renderedAnchorFor`). The atlas style's state and county lines come from GeoJSON the
 * persistent plate loads; this map draws them from the vector tiles instead (`addContextLayers`),
 * with village and neighborhood names, so a frame over a swamp or a field still says where it is.
 * A site dot carries the label beside it. MapLibre's cooperative gestures keep
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
import { attachSafariPageZoomGuard } from '../map-stage/custom-rotate-gestures';
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM } from '../../lib/map-experience/camera-presets';
import { OPENFREEMAP_SOURCE_ID, plateForScheme } from '../../lib/map-experience/dignity-style';
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
/**
 * The closest an embed frames. At z11 a frame shows the nearest towns, the major roads and the
 * county lines around the mark; closer than that, a frame over open ground shows nothing at all.
 */
export const EMBED_CONTEXT_MAX_ZOOM = 11;
/** The widest an embed steps out to while looking for a named place (`widenUntilNamed`). */
const EMBED_CONTEXT_MIN_ZOOM = 8;
const NAMED_PLACE_LAYERS = ['plate-place-city', 'record-map-place-local'];

/**
 * A frame over open ground (a swamp, a forest, a reservation) can hold no named place at all at
 * z11. Step out one zoom at a time until a town or village name is in the frame, so the reader
 * can always tell where the mark is. Widening only ever shows less precision, never more.
 */
function widenUntilNamed(map: MapLibreMap, done: () => void): void {
  const layers = NAMED_PLACE_LAYERS.filter((id) => map.getLayer(id));
  const named = layers.length > 0 && map.queryRenderedFeatures({ layers }).length > 0;
  if (named || map.getZoom() <= EMBED_CONTEXT_MIN_ZOOM) {
    done();
    return;
  }
  map.jumpTo({ zoom: Math.max(EMBED_CONTEXT_MIN_ZOOM, Math.floor(map.getZoom()) - 1) });
  map.once('idle', () => widenUntilNamed(map, done));
}
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

/** The first atlas layer that draws marks or tags: context goes under it. */
const CONTEXT_BEFORE_LAYER = 'explore-jurisdiction-tag';

/**
 * Orientation the atlas style leaves to the plate's GeoJSON: state and county lines and the names
 * of villages, suburbs and neighborhoods, all from the vector tiles, quiet ink on the paper chart.
 */
function addContextLayers(map: MapLibreMap): void {
  if (!map.getSource(OPENFREEMAP_SOURCE_ID) || map.getLayer('record-map-county-line')) return;
  const plate = plateForScheme(readDocumentColorScheme());
  const before = map.getLayer(CONTEXT_BEFORE_LAYER) ? CONTEXT_BEFORE_LAYER : undefined;
  const boundary = (id: string, level: number, color: string, width: number, minzoom: number) =>
    map.addLayer(
      {
        id,
        type: 'line',
        source: OPENFREEMAP_SOURCE_ID,
        'source-layer': 'boundary',
        minzoom,
        filter: [
          'all',
          ['==', ['to-number', ['coalesce', ['get', 'admin_level'], 99]], level],
          ['!=', ['get', 'maritime'], 1],
        ],
        layout: { 'line-join': 'round' },
        paint: { 'line-color': color, 'line-width': width },
      },
      before,
    );
  boundary('record-map-county-line', 6, plate.countyLine, 0.6, 7);
  boundary('record-map-state-line', 4, plate.stateBounds, 1.2, 4);
  map.addLayer(
    {
      id: 'record-map-place-local',
      type: 'symbol',
      source: OPENFREEMAP_SOURCE_ID,
      'source-layer': 'place',
      minzoom: 9,
      filter: [
        'match',
        ['get', 'class'],
        ['village', 'suburb', 'hamlet', 'neighbourhood'],
        true,
        false,
      ],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-max-width': 8,
      },
      paint: {
        'text-color': plate.placeLabel,
        'text-halo-color': plate.placeLabelHalo,
        'text-halo-width': 1.2,
      },
    },
    before,
  );
}

/** Context for the frame, and a site dot's name beside it. */
function markRecord(map: MapLibreMap, lng: number, lat: number, precision: string, label: string) {
  addContextLayers(map);
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
          zoom: Math.min(zoomForLocationPrecision(precision), maxZoom, EMBED_CONTEXT_MAX_ZOOM),
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
        // Shown once framed: a frame that has to step out does it before the reader sees it.
        active.once('idle', () =>
          widenUntilNamed(active, () => {
            if (!cancelled) setStatus('ready');
          }),
        );
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
