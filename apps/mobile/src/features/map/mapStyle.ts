/**
 * The dark, desaturated "archive of record" basemap style for the native map
 * (MOB-011 / ADR-024), the mobile parallel of ADR-013's web dark-archive style.
 *
 * Every color here is sourced from the generated brand tokens (`@/ui`) — never a
 * parallel hardcoded hex — so the two map surfaces cannot drift and the map
 * cannot silently diverge from the brand system. The register is a fixed dark
 * canvas regardless of the device light/dark setting, exactly as ADR-013
 * mandates: an archival map insert does not recolor to match the page around it.
 *
 * Tile sources (in priority order when basemap is enabled):
 *  1. Self-hosted Protomaps PMTiles (`pmtiles://…`) when configured
 *  2. OpenFreeMap vector TileJSON (web Explore parity) — default
 *  3. Kill-switch / tests: dark canvas only, zero tile sources
 *
 * DIGNITY INVARIANT (ADR-024, mirroring ADR-013): the point layer uses a single
 * flat copper color and a fixed radius. It MUST NOT render historical-harm data
 * as a crime-heatmap register — no `heatmap` layer, and no data-driven color
 * ramp keyed on entity density/count. `assertNoHeatmapRegister` below encodes
 * that as a checkable invariant and is exercised by mapStyle.test.ts.
 */
import { brandCore, themeColors } from '@/ui';
import {
  DEFAULT_MAP_GLYPHS_URL,
  DEFAULT_OPENFREEMAP_TILE_SOURCE_URL,
  OSM_ATTRIBUTION,
} from './mapConfig';

/** Minimal MapLibre style shape we build; passed to <Map mapStyle> as JSON. */
export type MapStyleSpec = {
  readonly version: 8;
  readonly name: string;
  readonly sources: Record<string, unknown>;
  readonly layers: readonly Record<string, unknown>[];
  /**
   * Absolute HTTPS glyphs template. Always set — MapScreen's cluster-count
   * symbol layer requires it; omitting it yields empty-URL native failures.
   */
  readonly glyphs: string;
};

export type BuildBasemapStyleInput = {
  /**
   * When false, returns the points-only dark canvas (kill-switch / tests).
   * Defaults to true.
   */
  readonly basemapEnabled?: boolean;
  /** PMTiles archive URL (Firebase Hosting/CDN), or null to use vector tiles. */
  readonly pmtilesUrl?: string | null;
  /**
   * OpenFreeMap-compatible vector TileJSON URL. Used when `pmtilesUrl` is null
   * and basemap is enabled. Defaults to OpenFreeMap planet.
   */
  readonly vectorTileUrl?: string | null;
  /**
   * Glyphs endpoint for label rendering. Defaults to OpenFreeMap fonts.
   * Blank/null/undefined → DEFAULT_MAP_GLYPHS_URL (never omit or empty-string).
   */
  readonly glyphsUrl?: string | null;
};

const DARK = themeColors.dark;

/** Resolve a usable glyphs template; never returns empty. */
function resolveGlyphsUrl(glyphsUrl: string | null | undefined): string {
  const trimmed = (glyphsUrl ?? '').trim();
  if (!trimmed) return DEFAULT_MAP_GLYPHS_URL;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return DEFAULT_MAP_GLYPHS_URL;
    }
    return trimmed;
  } catch {
    return DEFAULT_MAP_GLYPHS_URL;
  }
}

function resolveVectorTileUrl(vectorTileUrl: string | null | undefined): string {
  const trimmed = (vectorTileUrl ?? '').trim();
  if (!trimmed) return DEFAULT_OPENFREEMAP_TILE_SOURCE_URL;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return DEFAULT_OPENFREEMAP_TILE_SOURCE_URL;
    }
    return trimmed;
  } catch {
    return DEFAULT_OPENFREEMAP_TILE_SOURCE_URL;
  }
}

const backgroundLayer = {
  id: 'background',
  type: 'background',
  paint: { 'background-color': DARK.canvas },
};

/**
 * Shared dark-archive fill/line layers for OpenMapTiles-compatible sources
 * (OpenFreeMap). Source-layer ids: `water`, `landcover`, `boundary`,
 * `transportation` — NOT Protomaps' `boundaries`.
 */
function openMapTilesArchiveLayers(sourceId: string): readonly Record<string, unknown>[] {
  return [
    backgroundLayer,
    {
      id: 'landcover',
      type: 'fill',
      source: sourceId,
      'source-layer': 'landcover',
      paint: { 'fill-color': DARK.surface, 'fill-opacity': 0.35 },
    },
    {
      id: 'water',
      type: 'fill',
      source: sourceId,
      'source-layer': 'water',
      paint: { 'fill-color': '#080606' },
    },
    {
      id: 'admin-boundaries',
      type: 'line',
      source: sourceId,
      'source-layer': 'boundary',
      filter: ['<=', ['get', 'admin_level'], 4],
      paint: { 'line-color': DARK.border, 'line-width': 0.6, 'line-opacity': 0.7 },
    },
    {
      id: 'streets',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      minzoom: 8,
      filter: ['all', ['!=', ['get', 'class'], 'ferry'], ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: {
        'line-color': 'rgba(244, 239, 229, 0.28)',
        'line-width': 0.8,
      },
    },
  ];
}

/** Protomaps PMTiles archive layers (land/water/admin). */
function pmtilesArchiveLayers(sourceId: string): readonly Record<string, unknown>[] {
  return [
    backgroundLayer,
    {
      id: 'water',
      type: 'fill',
      source: sourceId,
      'source-layer': 'water',
      paint: { 'fill-color': DARK.surface },
    },
    {
      id: 'admin-boundaries',
      type: 'line',
      source: sourceId,
      'source-layer': 'boundaries',
      paint: { 'line-color': DARK.border, 'line-width': 0.5 },
    },
  ];
}

/**
 * Builds the basemap style. Prefer PMTiles when configured; otherwise OpenFreeMap
 * vector tiles (web Explore parity). Kill-switch / `basemapEnabled: false` yields
 * the dark canvas with no tile sources. Glyphs always attach over HTTPS so
 * cluster count symbol layers do not request an empty URL on MapLibre Native.
 */
export function buildBasemapStyle({
  basemapEnabled = true,
  pmtilesUrl = null,
  vectorTileUrl = null,
  glyphsUrl,
}: BuildBasemapStyleInput): MapStyleSpec {
  const glyphs = resolveGlyphsUrl(glyphsUrl);

  if (!basemapEnabled) {
    return {
      version: 8,
      name: 'blackstory-dark-archive-demo',
      glyphs,
      sources: {},
      layers: [backgroundLayer],
    };
  }

  if (pmtilesUrl) {
    return {
      version: 8,
      name: 'blackstory-dark-archive-pmtiles',
      glyphs,
      sources: {
        basemap: {
          type: 'vector',
          // MapLibre Native reads the archive directly via range requests.
          url: `pmtiles://${pmtilesUrl}`,
          attribution: OSM_ATTRIBUTION,
        },
      },
      layers: [...pmtilesArchiveLayers('basemap')],
    };
  }

  const tileUrl = resolveVectorTileUrl(vectorTileUrl);
  return {
    version: 8,
    name: 'blackstory-dark-archive-openfreemap',
    glyphs,
    sources: {
      basemap: {
        type: 'vector',
        url: tileUrl,
        attribution: `${OSM_ATTRIBUTION} · OpenFreeMap · OpenMapTiles`,
      },
    },
    layers: [...openMapTilesArchiveLayers('basemap')],
  };
}

/**
 * Unclustered point radius (px). Kept deliberately small so a national view
 * stays scannable — clusters and points must not read as state-covering blobs.
 */
export const ENTITY_POINT_RADIUS = 4;

/** Selected highlight ring radius (px); slightly larger than the point fill. */
export const ENTITY_SELECTED_RADIUS = 7;

/**
 * Dignity-safe cluster bubble radii (MapLibre `step` on `point_count`).
 * Size — never color — conveys density; stops stay compact at national zoom.
 * Expression shape: `['step', input, default, stop1, value1, …]`.
 */
export const ENTITY_CLUSTER_RADIUS_EXPR = [
  'step',
  ['get', 'point_count'],
  7, // < 10
  10,
  9, // >= 10
  25,
  11, // >= 25
  50,
  13, // >= 50
] as const;

/** Paint for the entity point layer: flat copper, fixed radius, archive-paper stroke. */
export const ENTITY_POINT_LAYER_STYLE = {
  circleColor: brandCore.copperPin,
  circleRadius: ENTITY_POINT_RADIUS,
  circleStrokeColor: brandCore.archivePaper,
  circleStrokeWidth: 1,
  circleOpacity: 0.9,
} as const;

/**
 * Dignity guard: proves a style + point paint carry no crime-heatmap register.
 * Rejects any `heatmap` layer and any data-driven (`interpolate`/`step` keyed on
 * a count/density expression) color ramp on points. Exercised by mapStyle.test.ts.
 */
export function assertNoHeatmapRegister(style: MapStyleSpec, pointPaint: Record<string, unknown>): void {
  for (const layer of style.layers) {
    if ((layer as { type?: string }).type === 'heatmap') {
      throw new Error('Dignity invariant violated: heatmap layer is forbidden on the archive map.');
    }
  }
  const color = pointPaint.circleColor;
  if (Array.isArray(color)) {
    throw new Error('Dignity invariant violated: point color must be flat, not a data-driven density ramp.');
  }
}
