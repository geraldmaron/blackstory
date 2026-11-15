'use client';

/**
 * The one embedded map: a record's place on a record page, a place page or a story inset. It is
 * the `/explore` plate (`docs/ui/patterns-place-map.md`, "Embeds"), holding one record.
 *
 * The plate is the same style (`buildExploreMapStyle`): night or day atlas, waterlines, the record's
 * own mark at its stored precision (`recordMarkFor`: a copper pin at a site, one open copper ring at
 * a campus, neighborhood or city) and its name in the house type (`bindRecordName`). A county or
 * state record has no point; it shows its place as /explore's entered place does, a flat copper
 * wash under the water and a copper outline. Framed no closer than the stored precision allows
 * (`zoomForLocationPrecision`) and never closer than `EMBED_CONTEXT_MAX_ZOOM`, so a small frame
 * always reaches the nearest towns. MapLibre's cooperative gestures keep one finger (and a plain
 * wheel) scrolling the page.
 *
 * The record sits in its place: a token on the plate ("Washington, DC", 352 records) links to
 * /explore with that place entered and the record selected. Neighbors are not drawn: the
 * place token is the context, and no dot is ever sharper than /explore would draw it.
 *
 * The figure, ground, token and caption are ordinary server-rendered HTML. Until the canvas is
 * framed (or with scripting off, or without WebGL) the frame is the plate's ground carrying the
 * place and its precision in words, never an empty box.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildExploreMapStyle } from '../../app/map/explore-style';
import type {
  ExploreMapFeature,
  ExploreMapFeatureCollection,
} from '../../lib/map-experience/build-explore-map-source';
import { EXPLORE_JURISDICTION_HATCH_LAYER_ID } from '../../app/map/explore-layer-ids';
import { placeOutline } from '../../app/explore/hooks/use-place-focus';
import {
  countyLookupFor,
  type CountyGeometryCollection,
} from '../../lib/map-experience/county-hatch';
import { renderedAnchorFor } from '../../lib/map-experience/record-marks';
import { abbreviate } from '../../lib/map-experience/place-map';
import type { RecordPlace } from '../../lib/map-experience/record-place';
import { bindRecordName } from '../map-stage/place-labels';
import { fetchCountyPolygons, fetchStatePolygons } from '../map-stage/geo-source-loaders';
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

const AREA_SOURCE = 'record-map-area';
/** Same wash as /explore's held areas (`AREA_TINT_OPACITY` in explore-style.ts). */
const AREA_WASH_OPACITY = 0.16;
/**
 * The closest an embed frames. At z11 a frame shows the nearest towns, the major roads and the
 * county lines around the mark; closer than that, a frame over open ground shows nothing at all.
 */
export const EMBED_CONTEXT_MAX_ZOOM = 11;
/** The widest an embed steps out to while looking for a named place (`widenUntilNamed`). */
const EMBED_CONTEXT_MIN_ZOOM = 8;
const NAMED_PLACE_LAYERS = ['plate-place-city', 'record-map-place-local'];

type Ring = readonly (readonly [number, number])[];

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
  /** The record's state, for a statewide record's outline; read from `place` when omitted. */
  readonly statePostalCode?: string;
  /** A closest zoom for a small frame; never frames closer than the precision allows either way. */
  readonly maxZoom?: number;
  /** False where the page states the place itself (a record page's citation line). */
  readonly caption?: boolean;
  /** `/explore?selected=…` (`exploreRecordHref`), or the record inside its place (`RecordPlace.href`). */
  readonly exploreHref?: string;
  /** The place the record belongs to, with its record count (`loadRecordPlace`). */
  readonly place?: Pick<RecordPlace, 'key' | 'name' | 'count' | 'href'>;
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

/** A county or state record has no point and no tag here: its place is drawn as an area. */
const NO_MARKS: ExploreMapFeatureCollection = { type: 'FeatureCollection', features: [] };

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

/**
 * The ring set of a county or state record's own place, from the published outlines. Nothing
 * when the geometry cannot be had: the frame then shows the plate and the place token alone.
 */
async function loadAreaRings(
  lng: number,
  lat: number,
  precision: string,
  statePostalCode: string | undefined,
): Promise<{ rings: Ring[]; counties?: CountyGeometryCollection }> {
  try {
    if (precision === 'county') {
      const counties = await fetchCountyPolygons();
      const county = countyLookupFor(counties)(lng, lat);
      return {
        rings: county ? placeOutline(`county-${county.fips}`, undefined, undefined, counties) : [],
        counties,
      };
    }
    if (!statePostalCode) return { rings: [] };
    const states = await fetchStatePolygons();
    return {
      rings: placeOutline(`state-${statePostalCode.toLowerCase()}`, undefined, states, undefined),
    };
  } catch {
    return { rings: [] };
  }
}

/** The place as /explore's entered place draws it: a copper wash under the water, a copper edge. */
function drawArea(map: MapLibreMap, rings: readonly Ring[]): void {
  if (rings.length === 0 || map.getSource(AREA_SOURCE)) return;
  const plate = plateForScheme(readDocumentColorScheme());
  const edge =
    getComputedStyle(document.documentElement).getPropertyValue('--ds-accent-graphic').trim() ||
    plate.areaTint;
  map.addSource(AREA_SOURCE, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'MultiPolygon', coordinates: rings.map((ring) => [ring]) },
        },
      ],
    },
  });
  const before = (id: string) => (map.getLayer(id) ? id : undefined);
  map.addLayer(
    {
      id: `${AREA_SOURCE}-wash`,
      type: 'fill',
      source: AREA_SOURCE,
      paint: { 'fill-color': plate.areaTint, 'fill-opacity': AREA_WASH_OPACITY },
    },
    before(EXPLORE_JURISDICTION_HATCH_LAYER_ID),
  );
  map.addLayer(
    {
      id: `${AREA_SOURCE}-edge`,
      type: 'line',
      source: AREA_SOURCE,
      layout: { 'line-join': 'round' },
      paint: { 'line-color': edge, 'line-width': 2 },
    },
    before(CONTEXT_BEFORE_LAYER),
  );
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
  place,
  className,
}: RecordMapProps) {
  // A statewide record's place is its state (`state-ga`): the outline comes from the place.
  const statePostal =
    statePostalCode ?? /^state-([a-z]{2})$/.exec(place?.key ?? '')?.[1]?.toUpperCase();
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
    let unbindName: (() => void) | null = null;

    void (async () => {
      try {
        if (!isWebGlAvailable()) {
          setStatus('failed');
          return;
        }
        setStatus('loading');
        const marked = recordMarkFor(precision) !== 'none';
        const [area] = await Promise.all([
          marked
            ? Promise.resolve<Awaited<ReturnType<typeof loadAreaRings>>>({ rings: [] })
            : loadAreaRings(lng, lat, precision, statePostal),
          waitForContainerLayout(container),
        ]);
        const maplibregl = (await import('maplibre-gl')).default;
        if (cancelled) return;
        const record = recordCollection(lng, lat, precision, statePostal);
        const marks = marked ? record : NO_MARKS;
        const center = renderedAnchorFor(record.features[0]!, area.counties);
        map = new maplibregl.Map({
          container,
          style: styleFor(readDocumentColorScheme(), marks),
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
        // A site's name, in the house type beside its pin; a ring sits on a place the plate names.
        const name = label.trim();
        if (recordMarkFor(precision) === 'dot' && name.length > 0) {
          unbindName = bindRecordName(active, [lng, lat], name);
        }
        active.on('style.load', () => {
          addContextLayers(active);
          drawArea(active, area.rings);
        });
        // Shown once framed: a frame that has to step out does it before the reader sees it.
        active.once('idle', () =>
          widenUntilNamed(active, () => {
            if (!cancelled) setStatus('ready');
          }),
        );
        active.on('error', (event) => console.error('[RecordMap]', event.error));
        themeObserver = new MutationObserver(() => {
          active.setStyle(styleFor(readDocumentColorScheme(), marks));
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
      unbindName?.();
      themeObserver?.disconnect();
      resizeLifecycle?.disconnect();
      contextRecovery?.disconnect();
      guard?.detach();
      map?.remove();
    };
  }, [wanted, lat, lng, precision, statePostal, maxZoom, label]);

  const named = label.trim();
  const precisionWords = precisionInWords(precision);

  return (
    <figure className={className ? `ds-record-map ${className}` : 'ds-record-map'}>
      <div ref={slotRef} className="ds-record-map__frame" data-ground="ink" data-status={status}>
        <div
          ref={canvasRef}
          className="ds-record-map__canvas"
          role="region"
          aria-label={`Map of ${named}. Use two fingers, or Control and scroll, to move it.`}
        />
        {/* The plate before the canvas paints, and the whole map where it never does. */}
        <p className="ds-record-map__ground">
          <span className="ds-record-map__ground-name">{named}</span>
          <span className="ds-record-map__ground-note">{precisionWords}</span>
        </p>
        {place ? (
          <a
            className="ds-record-map__token"
            href={place.href}
            aria-label={`${place.name}, ${place.count} ${place.count === 1 ? 'record' : 'records'}. Open this place on the map.`}
          >
            <span className="ds-record-map__count" aria-hidden="true">
              {abbreviate(place.count)}
            </span>
            <span className="ds-record-map__name" aria-hidden="true">
              {place.name}
            </span>
          </a>
        ) : null}
      </div>
      {caption ? (
        <figcaption className="ds-record-map__caption">
          <span className="ds-record-map__place">{named}</span>
          <span className="ds-record-map__precision">{precisionWords}</span>
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
