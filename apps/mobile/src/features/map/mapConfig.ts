/**
 * Native map source, attribution and basemap kill switch. Defaults to OpenFreeMap; an
 * explicitly configured PMTiles URL can replace it. Disabling the basemap keeps entity points
 * visible without tile requests. Follow the map dignity and precision rules in
 * docs/ui/PROTECTED-EXPERIENCES.md.
 */
import Constants from 'expo-constants';

/**
 * Attribution required by the basemap's data license, mirrored from the web Explore
 * style's own attribution line (the OpenFreeMap source's `attribution` in
 * `apps/web/src/app/map/explore-style.ts`). OpenStreetMap data is ODbL — attribution
 * is a license obligation, not a nicety, and MUST stay visible on the native map
 * screen (see MapAttribution). OpenFreeMap / OpenMapTiles / Protomaps are basemap
 * build/format lineages depending on which source is active.
 */
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
export const OPENFREEMAP_ATTRIBUTION = 'OpenFreeMap';
export const OPENMAPTILES_ATTRIBUTION = 'OpenMapTiles';
export const PROTOMAPS_ATTRIBUTION = 'Protomaps';

/**
 * Default glyphs endpoint — same OpenFreeMap fonts CDN the web Explore map uses
 * (`OPENFREEMAP_GLYPHS_URL` / `tiles.openfreemap.org/fonts`). Required whenever
 * MapScreen mounts a symbol layer (cluster counts): without a style `glyphs`
 * URL, MapLibre Native requests an empty URL and fails with NSURLError
 * unsupported URL (−1002) for the default Open Sans stack.
 *
 * Pair with `MAP_LABEL_TEXT_FONT` (`Noto Sans Regular`) — OpenFreeMap serves
 * that stack; it does not serve Open Sans.
 */
export const DEFAULT_MAP_GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

/**
 * Default vector TileJSON — same OpenFreeMap planet source web Explore uses
 * (`OPENFREEMAP_TILE_SOURCE_URL`). Used whenever no self-hosted PMTiles URL is
 * configured so the simulator/device still shows land/water/boundaries.
 */
export const DEFAULT_OPENFREEMAP_TILE_SOURCE_URL = 'https://tiles.openfreemap.org/planet';

/** Font stack present on OpenFreeMap; must match glyph PBF filenames. */
export const MAP_LABEL_TEXT_FONT = ['Noto Sans Regular'] as const;

type MapExtra = {
  /** HTTPS URL of the self-hosted PMTiles archive on the configured CDN. */
  readonly pmtilesUrl?: string;
  /**
   * HTTPS MapLibre TileJSON / style source URL (OpenFreeMap by default).
   * Ignored when `pmtilesUrl` is set (PMTiles wins).
   */
  readonly vectorTileUrl?: string;
  /**
   * HTTPS MapLibre glyphs template (`…/{fontstack}/{range}.pbf`). Empty/invalid
   * values are ignored so we never pass an empty string into style JSON.
   */
  readonly glyphsUrl?: string;
  /** Kill-switch: force-disable the basemap tile source (points-only, zero egress). */
  readonly basemapEnabled?: boolean;
};

/** Absolute http(s) URL, or null when missing/blank/non-http(s). */
function sanitizeHttpUrl(raw: string | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return value;
  } catch {
    return null;
  }
}

function readMapExtra(): MapExtra {
  const extra = Constants.expoConfig?.extra as { map?: MapExtra } | undefined;
  return extra?.map ?? {};
}

const extra = readMapExtra();

/**
 * Optional self-hosted PMTiles archive. When set, MapLibre Native reads it via
 * `pmtiles://` HTTPS range requests (`docs/decisions-carryover.md`, "Explore basemap and
 * live map source"). Empty-string is treated as unset.
 */
export const MAP_PMTILES_URL: string | null = sanitizeHttpUrl(extra.pmtilesUrl);

/**
 * Vector TileJSON URL for the archive plate when PMTiles is unset.
 * Defaults to OpenFreeMap (web parity); override via `extra.map.vectorTileUrl`.
 */
export const MAP_VECTOR_TILE_URL: string =
  sanitizeHttpUrl(extra.vectorTileUrl) ?? DEFAULT_OPENFREEMAP_TILE_SOURCE_URL;

/**
 * Glyphs template for symbol layers. Defaults to OpenFreeMap; overridable via
 * `extra.map.glyphsUrl` when a self-hosted font pack is ready. Never empty.
 */
export const MAP_GLYPHS_URL: string = sanitizeHttpUrl(extra.glyphsUrl) ?? DEFAULT_MAP_GLYPHS_URL;

/**
 * Whether to attach the basemap tile source. Defaults to enabled (OpenFreeMap
 * or PMTiles). An explicit `extra.map.basemapEnabled === false` is the
 * kill-switch that wins even when a URL is present.
 */
export const MAP_BASEMAP_ENABLED: boolean = extra.basemapEnabled !== false;

/** Attribution lines for the active basemap (OSM always; source lineage second). */
export const MAP_ATTRIBUTION_LINES: readonly string[] = MAP_PMTILES_URL
  ? [OSM_ATTRIBUTION, PROTOMAPS_ATTRIBUTION]
  : [OSM_ATTRIBUTION, OPENFREEMAP_ATTRIBUTION, OPENMAPTILES_ATTRIBUTION];

/**
 * Shorter on-map credit for Explore chrome. OSM license line stays; OpenMapTiles
 * remains in the accessibility label via `MAP_ATTRIBUTION_LINES` so the filled
 * “OpenMapTiles” tag does not crowd the sheet handle.
 */
export const MAP_ATTRIBUTION_LINES_COMPACT: readonly string[] = MAP_PMTILES_URL
  ? [OSM_ATTRIBUTION, PROTOMAPS_ATTRIBUTION]
  : [OSM_ATTRIBUTION, OPENFREEMAP_ATTRIBUTION];

/**
 * Migration threshold (`docs/decisions-carryover.md`, "Native map render layer" §5,
 * mirroring the ~2 MB flat-GeoJSON budget in
 * `docs/decisions-carryover.md`, "Map stack": size budgets): the per-point data ships
 * as a flat GeoJSON FeatureCollection until it crosses this budget, at which point the
 * per-point data moves to PMTiles/vector tiles rather than growing the flat file.
 * Nothing asserts against this constant yet. The one release-time size gate that
 * actually fires is `DEFAULT_BOUNDED_POINTS_BUDGET` in
 * `packages/domain/src/publication/release-activation.ts`, and it covers
 * `map/bounded-points.json` only.
 */
export const MAP_FLAT_GEOJSON_MAX_GZIP_BYTES = 2 * 1024 * 1024;
export const MAP_FLAT_GEOJSON_MAX_FEATURE_COUNT = 50_000;
