/**
 * Native map configuration and the tile cost kill-switch (MOB-011 / ADR-024).
 *
 * This module is the single place the map surface reads its tile source and
 * attribution from, so a build (or an OTA config push) can retarget the PMTiles
 * archive or disable the basemap entirely without touching render code.
 *
 * Cost/dignity posture (see docs/adr/ADR-024-mobile-map-data.md):
 *  - The basemap is a self-hosted Protomaps PMTiles archive served from
 *    Firebase Hosting/CDN, read by MapLibre Native over HTTPS range requests
 *    (the same self-host-preferred strategy ADR-013 fixed for web).
 *  - `MAP_BASEMAP_ENABLED` is the kill-switch: when false, no tile source is
 *    attached at all, so the map renders entity points over a flat dark canvas
 *    with ZERO tile egress. Flip it via `extra.map.basemapEnabled` in an OTA
 *    config push if CDN egress cost spikes — the app keeps working, degraded to
 *    points-only, instead of continuing to bill range requests.
 */
import Constants from 'expo-constants';

/**
 * Attribution required by the basemap's data license, mirrored from ADR-013's
 * web requirement. OpenStreetMap data is ODbL — attribution is a license
 * obligation, not a nicety, and MUST stay visible on the native map screen
 * (see MapAttribution). Protomaps is the basemap build/format lineage.
 */
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
export const PROTOMAPS_ATTRIBUTION = 'Protomaps';
export const MAP_ATTRIBUTION_LINES = [OSM_ATTRIBUTION, PROTOMAPS_ATTRIBUTION] as const;

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
export const DEFAULT_MAP_GLYPHS_URL =
  'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

/** Font stack present on OpenFreeMap; must match glyph PBF filenames. */
export const MAP_LABEL_TEXT_FONT = ['Noto Sans Regular'] as const;

type MapExtra = {
  /** HTTPS URL of the self-hosted PMTiles archive on Firebase Hosting/CDN. */
  readonly pmtilesUrl?: string;
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
 * The PMTiles archive URL, or null when none is configured. It is intentionally
 * null in this spike: authoring the production U.S. PMTiles archive is real
 * geodata work deferred past the spike (ADR-024 "Known gaps"). With no URL the
 * map renders the demo dark canvas + entity points — never a third-party demo
 * basemap, and never any silent paid dependency.
 *
 * Empty-string `extra.map.pmtilesUrl` is treated as unset (never passed through
 * as `pmtiles://` with a blank host — that also surfaces as unsupported URL).
 */
export const MAP_PMTILES_URL: string | null = sanitizeHttpUrl(extra.pmtilesUrl);

/**
 * Glyphs template for symbol layers. Defaults to OpenFreeMap; overridable via
 * `extra.map.glyphsUrl` when a self-hosted font pack is ready. Never empty.
 */
export const MAP_GLYPHS_URL: string =
  sanitizeHttpUrl(extra.glyphsUrl) ?? DEFAULT_MAP_GLYPHS_URL;

/**
 * Whether to attach the basemap tile source. Defaults to "enabled iff we have a
 * URL", but an explicit `extra.map.basemapEnabled === false` is the kill-switch
 * that wins even when a URL is present.
 */
export const MAP_BASEMAP_ENABLED: boolean =
  extra.basemapEnabled === false ? false : Boolean(MAP_PMTILES_URL);

/**
 * Migration threshold (ADR-024, mirroring ADR-013's ~2 MB budget): the per-point
 * data ships as a flat GeoJSON FeatureCollection until it crosses this budget,
 * at which point the per-point data moves to PMTiles/vector tiles rather than
 * growing the flat file. Documented here as a machine-checkable constant so a
 * future release-size guard can assert against it.
 */
export const MAP_FLAT_GEOJSON_MAX_GZIP_BYTES = 2 * 1024 * 1024;
export const MAP_FLAT_GEOJSON_MAX_FEATURE_COUNT = 50_000;
