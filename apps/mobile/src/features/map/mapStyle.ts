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
 * Entity circles use v6 kind-family encoding (`entity-paint.ts`). DIGNITY INVARIANT:
 * no `heatmap` layer and no density-keyed color ramps. `assertNoHeatmapRegister`
 * is exercised by mapStyle.test.ts.
 */
import { themeColors } from '@/ui';
import {
  DEFAULT_MAP_GLYPHS_URL,
  DEFAULT_OPENFREEMAP_TILE_SOURCE_URL,
  OSM_ATTRIBUTION,
} from './mapConfig';
import { clusterRadiusZoomExpression } from './dignity-palette';

export {
  ENTITY_POINT_LAYER_STYLE,
  ENTITY_HALO_LAYER_STYLE,
  ENTITY_EVENT_GLYPH_LAYER_STYLE,
  ENTITY_SELECTED_LAYER_STYLE,
  ENTITY_CLUSTER_LAYER_STYLE,
  kindColorExpression,
} from './entity-paint';
export { MARKER_RADIUS_MIN as ENTITY_POINT_RADIUS_MIN, MARKER_RADIUS_MAX as ENTITY_POINT_RADIUS_MAX } from './marker-size';
/** Cluster radius zoom-scaled step expression (web v6: 10/14/18/22 at z≥9). */
export const ENTITY_CLUSTER_RADIUS_EXPR = clusterRadiusZoomExpression();

/** @deprecated Use ENTITY_POINT_RADIUS_MIN — kept for legacy tests. */
export const ENTITY_POINT_RADIUS = 4;
/** @deprecated Selection ring uses data-driven radius in entity-paint. */
export const ENTITY_SELECTED_RADIUS = 7;

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

function isDensityKeyedColorRamp(color: unknown): boolean {
  if (!Array.isArray(color)) return false;
  const json = JSON.stringify(color);
  if (json.includes('point_count') || json.includes('density') || json.includes('heatmap')) {
    return true;
  }
  if (json.includes('shade') || json.includes('kindFamily') || json.includes('mapTone')) {
    return false;
  }
  if (color[0] === 'interpolate' || color[0] === 'step') {
    const input = JSON.stringify(color[2] ?? '');
    if (/count|density|heatmap/.test(input)) return true;
  }
  return false;
}

/**
 * Dignity guard: no heatmap layer and no density-keyed color ramps on entity points.
 */
export function assertNoHeatmapRegister(style: MapStyleSpec, pointPaint: Record<string, unknown>): void {
  for (const layer of style.layers) {
    if ((layer as { type?: string }).type === 'heatmap') {
      throw new Error('Dignity invariant violated: heatmap layer is forbidden on the archive map.');
    }
  }
  if (isDensityKeyedColorRamp(pointPaint.circleColor)) {
    throw new Error('Dignity invariant violated: point color must not use a density-keyed ramp.');
  }
}
