/**
 * The Door's own label layer on the shared plate: state codes, one jurisdiction tag per state, and
 * the group circles at the phone's national zoom, all as GL symbols in one collision pass.
 *
 * Why the Door draws these itself. The shared plate draws state codes as DOM markers
 * (state-labels.ts), which MapLibre's placement engine cannot see, and its jurisdiction tag layer
 * allows a tag under any group. At the Door's national frame that printed "30" through "NY" and
 * "2 by county" under the WA group, so the opening plate read as text noise. Here:
 *
 *  - every record mark reserves its own circle in the collision index first (an invisible icon
 *    sized to the group step, placed top-most and never hidden), so a count always wins;
 *  - a state code is placed next and gives way when it would touch a mark. At national scale that
 *    is all a state carries: fifty count lines there are the noise this layer exists to remove.
 *  - from regional scale the state's one-line tag joins its code, 16px under it, as one symbol, so
 *    the pair gives way together and a tag is never left orphaned under a neighbor's code. Past
 *    state scale the codes stand down and the tag stands alone.
 *
 * Below `AMBIENT_CLUSTER_MIN_ZOOM` the shared plate holds its groups off in the Door's posture,
 * which on a phone (national zoom about 2) left the country with no groups at all. The Door draws
 * the same groups from the same clustered source below that zoom, so the plate always shows where
 * the records are, and a tap on one eases to its expansion zoom exactly as the plate's own does.
 *
 * The same mount collapses the attribution to its "i" (`collapseAttribution`).
 *
 * Everything here is added on mount and removed on unmount (browse hands the plate to Explore,
 * which has its own labels), and re-asserted on every `styledata`, because the shared plate
 * re-syncs its own layers on theme and data patches.
 */
import type {
  ExpressionSpecification,
  GeoJSONSource,
  LayerSpecification,
  Map as MapLibreMap,
} from 'maplibre-gl';
import { mapPalettes } from '@repo/ui';
import type { ExploreMapFeatureCollection } from '../lib/map-experience/build-explore-map-source';
import { CAMERA_EASING_SLOW_OUT, prefersReducedMotion } from '../lib/map-experience/camera-presets';
import {
  clampClusterExpansionZoom,
  clusterExpandDurationMs,
} from '../lib/map-experience/cluster-expand';
import { CLUSTER_RADIUS_BY_COUNT } from '../lib/map-experience/dignity-style';
import { recordMarkFor } from '../lib/map-experience/geo-precision';
import { stateLabelPoints } from '../lib/map-experience/state-labels';
import { readDocumentColorScheme } from '../components/map-stage/color-scheme';
import { AMBIENT_CLUSTER_MIN_ZOOM } from '../components/map-stage/plate-posture';
import {
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_ENTITIES_SOURCE_ID,
  EXPLORE_JURISDICTION_TAG_LAYER_ID,
} from './map/explore-layer-ids';

const LABEL_SOURCE_ID = 'door-labels';
const GROUP_LOW_LAYER_ID = 'door-group-low';
const GROUP_LOW_COUNT_LAYER_ID = 'door-group-low-count';
const TAG_LAYER_ID = 'door-jurisdiction-tag';
const STATE_LABEL_LAYER_ID = 'door-state-label';
const STATE_LABEL_TAG_LAYER_ID = 'door-state-label-tag';
const MARK_COLLISION_LAYER_ID = 'door-mark-collision';
const DISC_IMAGE_ID = 'door-collision-disc';
const DISC_PX = 64;

/** Bottom to top. MapLibre places symbols top layer first, so the marks claim space before a code. */
const DOOR_LAYER_IDS = [
  GROUP_LOW_LAYER_ID,
  GROUP_LOW_COUNT_LAYER_ID,
  TAG_LAYER_ID,
  STATE_LABEL_TAG_LAYER_ID,
  STATE_LABEL_LAYER_ID,
  MARK_COLLISION_LAYER_ID,
] as const;

/** A single record's mark (dot or ring) reserves this diameter, the ring's plus its halo. */
const SINGLE_MARK_DIAMETER_PX = 16;
/** Label text: the tag's line sits 16px under the code's (a 1.6 line height at 10px). */
const LABEL_TEXT_PX = 10;
const LABEL_LINE_HEIGHT = 1.6;
/** Codes stand down past state scale (the plate's own band, state-labels.ts). */
const STATE_LABEL_MAX_ZOOM = 6.2;
/** Tags join their codes from regional scale; below it a state shows its code only. */
const TAG_MIN_ZOOM = 4;

/**
 * One line per state for the records the map draws no point for (county or state precision):
 * "3 by county", "2 statewide", or, when a state holds both, "5 by county or state".
 */
export function doorStateTagLines(pins: ExploreMapFeatureCollection): ReadonlyMap<string, string> {
  const counts = new Map<string, { county: number; state: number }>();
  for (const feature of pins.features) {
    const { precision, statePostalCode } = feature.properties;
    if (!statePostalCode || recordMarkFor(precision) !== 'none') continue;
    const entry = counts.get(statePostalCode) ?? { county: 0, state: 0 };
    if (precision === 'county') entry.county += 1;
    else entry.state += 1;
    counts.set(statePostalCode, entry);
  }
  const lines = new Map<string, string>();
  for (const [code, { county, state }] of counts) {
    const total = (county + state).toLocaleString('en-US');
    lines.set(
      code,
      state === 0
        ? `${total} by county`
        : county === 0
          ? `${total} statewide`
          : `${total} by county or state`,
    );
  }
  return lines;
}

function labelCollection(pins: ExploreMapFeatureCollection) {
  const tags = doorStateTagLines(pins);
  return {
    type: 'FeatureCollection' as const,
    features: stateLabelPoints().map((point) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [point.lng, point.lat] },
      properties: { code: point.postalCode, tag: tags.get(point.postalCode) ?? '' },
    })),
  };
}

/** Icon scale for a mark's reserved circle: the group step's diameter, or a single mark's. */
function markDiameterExpression(): ExpressionSpecification {
  const steps: (number | ExpressionSpecification)[] = [];
  CLUSTER_RADIUS_BY_COUNT.forEach(([minCount, radius], index) => {
    const scale = (radius * 2 + 4) / DISC_PX;
    if (index === 0) steps.push(scale);
    else steps.push(minCount, scale);
  });
  return [
    'case',
    ['has', 'point_count'],
    ['step', ['get', 'point_count'], ...steps] as unknown as ExpressionSpecification,
    SINGLE_MARK_DIAMETER_PX / DISC_PX,
  ] as unknown as ExpressionSpecification;
}

function discImage(): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(DISC_PX * DISC_PX * 4);
  const r = DISC_PX / 2;
  for (let y = 0; y < DISC_PX; y += 1) {
    for (let x = 0; x < DISC_PX; x += 1) {
      if ((x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 > r * r) continue;
      data.set([255, 255, 255, 255], (y * DISC_PX + x) * 4);
    }
  }
  return { width: DISC_PX, height: DISC_PX, data };
}

/** Paint the Door's layers take from the plate, read live so a theme change carries over. */
function paintFor(map: MapLibreMap): Record<string, Record<string, unknown>> {
  const read = (layer: string, key: string) =>
    map.getLayer(layer) ? (map.getPaintProperty(layer, key) as unknown) : undefined;
  const scheme = readDocumentColorScheme();
  const halo = mapPalettes[scheme].halo;
  const groupPaint: Record<string, unknown> = {};
  for (const key of [
    'circle-radius',
    'circle-color',
    'circle-stroke-width',
    'circle-stroke-color',
  ]) {
    const value = read(EXPLORE_CLUSTER_LAYER_ID, key);
    if (value !== undefined) groupPaint[key] = value;
  }
  const countColor = read(EXPLORE_CLUSTER_COUNT_LAYER_ID, 'text-color');
  const tagColor = read(EXPLORE_JURISDICTION_TAG_LAYER_ID, 'text-color');
  const tagHalo = read(EXPLORE_JURISDICTION_TAG_LAYER_ID, 'text-halo-color');
  return {
    [GROUP_LOW_LAYER_ID]: groupPaint,
    [GROUP_LOW_COUNT_LAYER_ID]: countColor !== undefined ? { 'text-color': countColor } : {},
    [TAG_LAYER_ID]: {
      ...(tagColor !== undefined ? { 'text-color': tagColor } : {}),
      'text-halo-color': tagHalo ?? halo,
      'text-halo-width': 1.2,
    },
    [STATE_LABEL_LAYER_ID]: {
      'text-color': mapPalettes[scheme].label,
      'text-halo-color': halo,
      'text-halo-width': 1.2,
    },
  };
}

/** The code, and under it the state's tag when it has one, as one symbol. */
function codeAndTagExpression(tagColor: unknown): ExpressionSpecification {
  return [
    'case',
    ['==', ['get', 'tag'], ''],
    ['get', 'code'],
    [
      'format',
      ['get', 'code'],
      {},
      '\n',
      {},
      ['get', 'tag'],
      { 'font-scale': 1, ...(typeof tagColor === 'string' ? { 'text-color': tagColor } : {}) },
    ],
  ] as unknown as ExpressionSpecification;
}

function layerSpecs(map: MapLibreMap): LayerSpecification[] {
  const paint = paintFor(map);
  const countFont = (map.getLayer(EXPLORE_CLUSTER_COUNT_LAYER_ID)
    ? map.getLayoutProperty(EXPLORE_CLUSTER_COUNT_LAYER_ID, 'text-font')
    : undefined) ?? ['Noto Sans Bold'];
  return [
    {
      id: GROUP_LOW_LAYER_ID,
      type: 'circle',
      source: EXPLORE_ENTITIES_SOURCE_ID,
      maxzoom: AMBIENT_CLUSTER_MIN_ZOOM,
      filter: ['has', 'point_count'],
      paint: paint[GROUP_LOW_LAYER_ID],
    },
    {
      id: GROUP_LOW_COUNT_LAYER_ID,
      type: 'symbol',
      source: EXPLORE_ENTITIES_SOURCE_ID,
      maxzoom: AMBIENT_CLUSTER_MIN_ZOOM,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 11,
        'text-font': countFont,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: paint[GROUP_LOW_COUNT_LAYER_ID],
    },
    {
      // Past state scale: the tag alone at the state's label point.
      id: TAG_LAYER_ID,
      type: 'symbol',
      source: LABEL_SOURCE_ID,
      minzoom: STATE_LABEL_MAX_ZOOM,
      filter: ['!=', ['get', 'tag'], ''],
      layout: {
        'text-field': ['get', 'tag'],
        'text-size': LABEL_TEXT_PX,
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 40,
        'text-allow-overlap': false,
        'text-padding': 2,
      },
      paint: paint[TAG_LAYER_ID],
    },
    {
      // Regional scale: the code on its anchor and the tag one line under it, as one symbol. The
      // first line is centered on the point by anchoring the block's top half a line up.
      id: STATE_LABEL_TAG_LAYER_ID,
      type: 'symbol',
      source: LABEL_SOURCE_ID,
      minzoom: TAG_MIN_ZOOM,
      maxzoom: STATE_LABEL_MAX_ZOOM,
      layout: {
        'text-field': codeAndTagExpression(paint[TAG_LAYER_ID]?.['text-color']),
        'text-size': LABEL_TEXT_PX,
        'text-font': ['Noto Sans Regular'],
        'text-line-height': LABEL_LINE_HEIGHT,
        'text-max-width': 40,
        'text-letter-spacing': 0.06,
        'text-anchor': ['case', ['==', ['get', 'tag'], ''], 'center', 'top'],
        'text-offset': [
          'case',
          ['==', ['get', 'tag'], ''],
          ['literal', [0, 0]],
          ['literal', [0, -0.8]],
        ],
        'text-allow-overlap': false,
        'text-padding': 2,
      },
      paint: paint[STATE_LABEL_LAYER_ID],
    },
    {
      // National scale: the code alone.
      id: STATE_LABEL_LAYER_ID,
      type: 'symbol',
      source: LABEL_SOURCE_ID,
      maxzoom: TAG_MIN_ZOOM,
      layout: {
        'text-field': ['get', 'code'],
        'text-size': LABEL_TEXT_PX,
        'text-font': ['Noto Sans Regular'],
        'text-letter-spacing': 0.06,
        'text-allow-overlap': false,
        'text-padding': 2,
      },
      paint: paint[STATE_LABEL_LAYER_ID],
    },
    {
      // Invisible: each record mark's footprint in the collision index, placed before any label.
      id: MARK_COLLISION_LAYER_ID,
      type: 'symbol',
      source: EXPLORE_ENTITIES_SOURCE_ID,
      layout: {
        'icon-image': DISC_IMAGE_ID,
        'icon-size': markDiameterExpression(),
        'icon-allow-overlap': true,
        'icon-ignore-placement': false,
        'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'point_count'], 1]],
      },
      paint: { 'icon-opacity': 0 },
    },
  ] as LayerSpecification[];
}

/**
 * MapLibre opens a compact attribution expanded the first time its text arrives. It is a license
 * obligation, so it stays one tap away, but as the collapsed "i", not a box on the map.
 */
function collapseAttribution(map: MapLibreMap): () => void {
  const collapse = () => {
    const control = map
      .getContainer()
      .querySelector('.maplibregl-ctrl-attrib.maplibregl-compact:not(.maplibregl-attrib-empty)');
    if (!control) return;
    control.classList.remove('maplibregl-compact-show');
    control.removeAttribute('open');
    map.off('styledata', collapse);
    map.off('sourcedata', collapse);
  };
  map.on('styledata', collapse);
  map.on('sourcedata', collapse);
  collapse();
  return () => {
    map.off('styledata', collapse);
    map.off('sourcedata', collapse);
  };
}

/** The shared plate as the Door's labels need it. */
export type DoorPlate = MapLibreMap;

export type DoorPlateLabels = {
  /** The records the plate shows this frame (the sweep narrows them). */
  readonly setPins: (pins: ExploreMapFeatureCollection) => void;
  readonly remove: () => void;
};

/** Mounts the Door's labels on the shared plate; returns a handle that updates and removes them. */
export function mountDoorPlateLabels(
  map: MapLibreMap,
  initialPins: ExploreMapFeatureCollection,
): DoorPlateLabels {
  let pins = initialPins;
  let applied = new Map<string, string>();

  const ensure = () => {
    // The shared entities source has to exist before anything can be drawn from it.
    if (!map.getSource(EXPLORE_ENTITIES_SOURCE_ID)) return false;
    if (!map.hasImage(DISC_IMAGE_ID)) map.addImage(DISC_IMAGE_ID, discImage());
    if (!map.getSource(LABEL_SOURCE_ID)) {
      map.addSource(LABEL_SOURCE_ID, { type: 'geojson', data: labelCollection(pins) as never });
    }
    if (
      map.getLayer(EXPLORE_JURISDICTION_TAG_LAYER_ID) &&
      map.getLayoutProperty(EXPLORE_JURISDICTION_TAG_LAYER_ID, 'visibility') !== 'none'
    ) {
      map.setLayoutProperty(EXPLORE_JURISDICTION_TAG_LAYER_ID, 'visibility', 'none');
    }
    let added = false;
    for (const spec of layerSpecs(map)) {
      if (!map.getLayer(spec.id)) {
        map.addLayer(spec);
        applied.set(spec.id, JSON.stringify('paint' in spec ? spec.paint : {}));
        added = true;
        continue;
      }
      // Re-sync paint only when the plate's own paint moved (a theme change); setting it
      // unconditionally would fire `styledata` again and loop.
      const next = JSON.stringify('paint' in spec ? spec.paint : {});
      if (applied.get(spec.id) === next || !('paint' in spec) || !spec.paint) continue;
      applied.set(spec.id, next);
      for (const [key, value] of Object.entries(spec.paint)) {
        map.setPaintProperty(spec.id, key, value);
      }
    }
    // Re-adding one layer puts it on top; keep the Door's own bottom-to-top order.
    if (added) for (const id of DOOR_LAYER_IDS) map.moveLayer(id);
    return true;
  };

  const onStyleData = () => {
    try {
      ensure();
    } catch (error) {
      console.error('[door-plate-labels] sync failed', error);
    }
  };
  // Until the entities source exists, wait on source events too; after that only a style change
  // (a theme switch, a re-added layer) can need a re-sync.
  const onSourceData = () => {
    try {
      if (ensure()) map.off('sourcedata', onSourceData);
    } catch (error) {
      console.error('[door-plate-labels] mount failed', error);
    }
  };
  map.on('styledata', onStyleData);
  map.on('sourcedata', onSourceData);
  onSourceData();
  const releaseAttribution = collapseAttribution(map);

  // A low-zoom group opens the way the plate's own groups do (MapStage, cluster expand).
  const onGroupClick = (event: { features?: { geometry: unknown; properties: unknown }[] }) => {
    const feature = event.features?.[0];
    const clusterId = (feature?.properties as { cluster_id?: number } | undefined)?.cluster_id;
    const source = map.getSource(EXPLORE_ENTITIES_SOURCE_ID) as GeoJSONSource | undefined;
    if (!feature || clusterId === undefined || !source) return;
    const [lng, lat] = (feature.geometry as { coordinates: [number, number] }).coordinates;
    void source
      .getClusterExpansionZoom(clusterId)
      .then((zoom) => {
        map.easeTo({
          center: [lng, lat],
          zoom: clampClusterExpansionZoom(zoom, map.getZoom()),
          duration: clusterExpandDurationMs(prefersReducedMotion()),
          easing: CAMERA_EASING_SLOW_OUT,
        });
      })
      .catch(() => {
        // The group may have dissolved between the tap and the lookup.
      });
  };
  const onGroupEnter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const onGroupLeave = () => {
    map.getCanvas().style.cursor = '';
  };
  map.on('click', GROUP_LOW_LAYER_ID, onGroupClick);
  map.on('mouseenter', GROUP_LOW_LAYER_ID, onGroupEnter);
  map.on('mouseleave', GROUP_LOW_LAYER_ID, onGroupLeave);

  return {
    setPins(next) {
      pins = next;
      const source = map.getSource(LABEL_SOURCE_ID) as GeoJSONSource | undefined;
      source?.setData(labelCollection(pins) as never);
    },
    remove() {
      releaseAttribution();
      map.off('click', GROUP_LOW_LAYER_ID, onGroupClick);
      map.off('mouseenter', GROUP_LOW_LAYER_ID, onGroupEnter);
      map.off('mouseleave', GROUP_LOW_LAYER_ID, onGroupLeave);
      map.off('styledata', onStyleData);
      map.off('sourcedata', onSourceData);
      try {
        for (const id of [...DOOR_LAYER_IDS].reverse()) {
          if (map.getLayer(id)) map.removeLayer(id);
        }
        if (map.getSource(LABEL_SOURCE_ID)) map.removeSource(LABEL_SOURCE_ID);
        if (map.getLayer(EXPLORE_JURISDICTION_TAG_LAYER_ID)) {
          map.setLayoutProperty(EXPLORE_JURISDICTION_TAG_LAYER_ID, 'visibility', 'visible');
        }
      } catch (error) {
        console.error('[door-plate-labels] remove failed', error);
      }
      applied = new Map();
    },
  };
}
