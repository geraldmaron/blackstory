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
 * DIGNITY INVARIANT (ADR-024, mirroring ADR-013): the point layer uses a single
 * flat copper color and a fixed radius. It MUST NOT render historical-harm data
 * as a crime-heatmap register — no `heatmap` layer, and no data-driven color
 * ramp keyed on entity density/count. `assertNoHeatmapRegister` below encodes
 * that as a checkable invariant and is exercised by mapStyle.test.ts.
 */
import { brandCore, themeColors } from '@/ui';

/** Minimal MapLibre style shape we build; passed to <Map mapStyle> as JSON. */
export type MapStyleSpec = {
  readonly version: 8;
  readonly name: string;
  readonly sources: Record<string, unknown>;
  readonly layers: readonly Record<string, unknown>[];
  readonly glyphs?: string;
};

export type BuildBasemapStyleInput = {
  /** PMTiles archive URL (Firebase Hosting/CDN), or null for the demo canvas. */
  readonly pmtilesUrl: string | null;
  /** Glyphs endpoint for label rendering; required only when a basemap is attached. */
  readonly glyphsUrl?: string | null;
};

const DARK = themeColors.dark;

/**
 * Builds the basemap style. With a `pmtilesUrl` it attaches a vector source read
 * via MapLibre Native's `pmtiles://` protocol (HTTPS range requests, per
 * ADR-013/ADR-024) and draws land/water/admin lines in the dark theme's
 * low-contrast border tone. With no URL it returns the demo canvas: a single
 * dark background layer, zero network requests — the honest spike basemap
 * (ADR-024 "Known gaps"), never a third-party demo tile server.
 */
export function buildBasemapStyle({ pmtilesUrl, glyphsUrl }: BuildBasemapStyleInput): MapStyleSpec {
  const backgroundLayer = {
    id: 'background',
    type: 'background',
    paint: { 'background-color': DARK.canvas },
  };

  if (!pmtilesUrl) {
    return {
      version: 8,
      name: 'blackstory-dark-archive-demo',
      sources: {},
      layers: [backgroundLayer],
    };
  }

  return {
    version: 8,
    name: 'blackstory-dark-archive',
    ...(glyphsUrl ? { glyphs: glyphsUrl } : {}),
    sources: {
      basemap: {
        type: 'vector',
        // MapLibre Native reads the archive directly via range requests.
        url: `pmtiles://${pmtilesUrl}`,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      backgroundLayer,
      {
        id: 'water',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'water',
        paint: { 'fill-color': DARK.surface },
      },
      {
        id: 'admin-boundaries',
        type: 'line',
        source: 'basemap',
        'source-layer': 'boundaries',
        // Low-contrast border tone — never a bright saturated color.
        paint: { 'line-color': DARK.border, 'line-width': 0.5 },
      },
    ],
  };
}

/** Paint for the entity point layer: flat copper, fixed radius, archive-paper stroke. */
export const ENTITY_POINT_LAYER_STYLE = {
  circleColor: brandCore.copperPin,
  circleRadius: 5,
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
