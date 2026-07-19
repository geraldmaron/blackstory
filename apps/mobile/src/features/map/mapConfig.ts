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

type MapExtra = {
  /** HTTPS URL of the self-hosted PMTiles archive on Firebase Hosting/CDN. */
  readonly pmtilesUrl?: string;
  /** Kill-switch: force-disable the basemap tile source (points-only, zero egress). */
  readonly basemapEnabled?: boolean;
};

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
 */
export const MAP_PMTILES_URL: string | null = extra.pmtilesUrl ?? null;

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
