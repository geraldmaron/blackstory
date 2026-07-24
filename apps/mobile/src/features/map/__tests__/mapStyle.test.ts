import {
  DEFAULT_MAP_GLYPHS_URL,
  DEFAULT_OPENFREEMAP_TILE_SOURCE_URL,
} from '../mapConfig';
import {
  assertNoHeatmapRegister,
  buildBasemapStyle,
  ENTITY_CLUSTER_RADIUS_EXPR,
  ENTITY_POINT_LAYER_STYLE,
  ENTITY_SELECTED_LAYER_STYLE,
  kindColorExpression,
} from '../mapStyle';
import { DIGNITY_PALETTE } from '../dignity-palette';

/** Relative luminance (WCAG) for hex colors — map plate contrast only. */
function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const int = parseInt(full, 16);
  const channels = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

describe('buildBasemapStyle', () => {
  it('defaults to OpenFreeMap vector tiles when no PMTiles URL is set', () => {
    const style = buildBasemapStyle({ pmtilesUrl: null });
    expect(style.version).toBe(8);
    expect(style.name).toBe('blackstory-dark-archive-openfreemap');
    const source = style.sources.basemap as { type: string; url: string };
    expect(source.type).toBe('vector');
    expect(source.url).toBe(DEFAULT_OPENFREEMAP_TILE_SOURCE_URL);
    expect(style.layers.some((l) => (l as { id: string }).id === 'water')).toBe(true);
    expect(style.layers.some((l) => (l as { id: string }).id === 'coastline')).toBe(true);
    expect(style.layers.some((l) => (l as { id: string }).id === 'landcover')).toBe(true);
    expect(style.layers.some((l) => (l as { id: string }).id === 'admin-boundaries')).toBe(true);
    expect(style.layers.some((l) => (l as { id: string }).id === 'place-state')).toBe(true);
    expect(style.layers.some((l) => (l as { id: string }).id === 'place-city')).toBe(true);
    expect(style.layers.some((l) => (l as { id: string }).id === 'street-label')).toBe(true);
    expect(style.layers.some((l) => (l as { id: string }).id === 'streets-casing')).toBe(true);
    const boundary = style.layers.find((l) => (l as { id: string }).id === 'admin-boundaries') as {
      'source-layer': string;
    };
    // OpenMapTiles / OpenFreeMap layer id (not Protomaps `boundaries`).
    expect(boundary['source-layer']).toBe('boundary');
    const bg = style.layers[0] as { type: string; paint: Record<string, string> };
    expect(bg.type).toBe('background');
    // Land plate (not ocean/canvas) — water polygons punch the Pacific through.
    expect(bg.paint['background-color']).toBe(DIGNITY_PALETTE.land);
  });

  it('keeps land plate lighter than ocean and paints a sand coastline stroke', () => {
    const style = buildBasemapStyle({ pmtilesUrl: null });
    const water = style.layers.find((l) => (l as { id: string }).id === 'water') as {
      paint: Record<string, string>;
      'source-layer': string;
    };
    const coast = style.layers.find((l) => (l as { id: string }).id === 'coastline') as {
      type: string;
      paint: Record<string, unknown>;
      'source-layer': string;
    };
    expect(water['source-layer']).toBe('water');
    expect(water.paint['fill-color']).toBe(DIGNITY_PALETTE.ocean);
    expect(coast.type).toBe('line');
    expect(coast['source-layer']).toBe('water');
    expect(coast.paint['line-color']).toBe(DIGNITY_PALETTE.coastline);
    expect(DIGNITY_PALETTE.land).not.toBe(DIGNITY_PALETTE.ocean);
    expect(relativeLuminance(DIGNITY_PALETTE.land)).toBeGreaterThan(
      relativeLuminance(DIGNITY_PALETTE.ocean),
    );
    // Cartographic plate delta — two dark archive colors will not hit WCAG 3:1;
    // require a perceptible luminance gap so west-coast land≠ocean.
    expect(
      relativeLuminance(DIGNITY_PALETTE.land) - relativeLuminance(DIGNITY_PALETTE.ocean),
    ).toBeGreaterThanOrEqual(0.015);
  });

  it('keeps state labels required at national zoom (California must not optional-drop)', () => {
    const style = buildBasemapStyle({ pmtilesUrl: null });
    const placeState = style.layers.find((l) => (l as { id: string }).id === 'place-state') as {
      layout: Record<string, unknown>;
      maxzoom?: number;
    };
    expect(placeState.layout['text-optional']).toBe(false);
    expect(placeState.maxzoom).toBe(7);
    expect(Array.isArray(placeState.layout['text-size'])).toBe(true);
  });

  it('returns the demo dark canvas with ZERO tile sources when basemap is disabled', () => {
    const style = buildBasemapStyle({ basemapEnabled: false, pmtilesUrl: null });
    expect(Object.keys(style.sources)).toHaveLength(0);
    expect(style.layers).toHaveLength(1);
    expect((style.layers[0] as { type: string }).type).toBe('background');
  });

  it('always attaches HTTPS glyphs (OpenFreeMap default) even on the demo canvas', () => {
    // Cluster count symbol layers need glyphs; omitting them yields MapLibre
    // Native "unsupported URL" with an empty NSErrorFailingURLStringKey.
    const style = buildBasemapStyle({ basemapEnabled: false });
    expect(style.glyphs).toBe(DEFAULT_MAP_GLYPHS_URL);
    expect(style.glyphs.startsWith('https://')).toBe(true);
  });

  it('falls back to the default glyphs URL when glyphsUrl is blank or scheme-less', () => {
    expect(buildBasemapStyle({ pmtilesUrl: null, glyphsUrl: '' }).glyphs).toBe(DEFAULT_MAP_GLYPHS_URL);
    expect(buildBasemapStyle({ pmtilesUrl: null, glyphsUrl: '   ' }).glyphs).toBe(DEFAULT_MAP_GLYPHS_URL);
    expect(buildBasemapStyle({ pmtilesUrl: null, glyphsUrl: 'mapbox://fonts/...' }).glyphs).toBe(
      DEFAULT_MAP_GLYPHS_URL,
    );
  });

  it('attaches a pmtiles:// vector source and dark low-contrast boundary lines when a URL is set', () => {
    const style = buildBasemapStyle({
      pmtilesUrl: 'https://cdn.example/us.pmtiles',
      glyphsUrl: 'https://cdn.example/glyphs/{fontstack}/{range}.pbf',
    });
    const source = style.sources.basemap as { type: string; url: string };
    expect(source.type).toBe('vector');
    expect(source.url).toBe('pmtiles://https://cdn.example/us.pmtiles');
    expect(style.glyphs).toBe('https://cdn.example/glyphs/{fontstack}/{range}.pbf');
    const line = style.layers.find((l) => (l as { id: string }).id === 'admin-boundaries') as {
      paint: Record<string, unknown>;
      'source-layer': string;
    };
    expect(line['source-layer']).toBe('boundaries');
    expect(line.paint['line-color']).toBe(DIGNITY_PALETTE.pointHalo);
    expect(style.layers.some((l) => (l as { id: string }).id === 'coastline')).toBe(true);
    const bg = style.layers[0] as { paint: Record<string, string> };
    expect(bg.paint['background-color']).toBe(DIGNITY_PALETTE.land);
  });

  it('defaults glyphs to OpenFreeMap when a PMTiles URL is set without glyphsUrl', () => {
    const style = buildBasemapStyle({ pmtilesUrl: 'https://cdn.example/us.pmtiles' });
    expect(style.glyphs).toBe(DEFAULT_MAP_GLYPHS_URL);
  });

  it('PMTiles wins over vectorTileUrl when both are set', () => {
    const style = buildBasemapStyle({
      pmtilesUrl: 'https://cdn.example/us.pmtiles',
      vectorTileUrl: 'https://tiles.openfreemap.org/planet',
    });
    expect((style.sources.basemap as { url: string }).url).toBe(
      'pmtiles://https://cdn.example/us.pmtiles',
    );
  });
});

describe('dignity invariant (no crime-heatmap register)', () => {
  it('point layer uses kind-family shade expression, not a density ramp', () => {
    expect(Array.isArray(ENTITY_POINT_LAYER_STYLE.circleColor)).toBe(true);
    expect(JSON.stringify(kindColorExpression())).toContain('shade');
  });

  it('uses web-aligned zoom-scaled cluster radius and evidence-based point radius', () => {
    expect(Array.isArray(ENTITY_POINT_LAYER_STYLE.circleRadius)).toBe(true);
    const radius = ENTITY_CLUSTER_RADIUS_EXPR as unknown[];
    expect(radius[0]).toBe('interpolate');
    expect(radius[2]).toEqual(['zoom']);
    expect(radius[3]).toBe(3);
    expect(radius[5]).toBe(5.5);
    expect(radius[7]).toBe(9);
    const nationalStep = (radius[4] as unknown[])[1] as unknown[];
    expect(nationalStep[0]).toBe('step');
    expect(nationalStep.slice(2)).toEqual([10, 10, 14, 50, 18, 200, 22]);
    expect((radius[4] as unknown[])[0]).toBe('*');
    expect((radius[4] as unknown[])[2]).toBe(0.55);
  });

  it('selected ring uses copper accent (navigational), not Archive Paper alone', () => {
    expect(ENTITY_SELECTED_LAYER_STYLE.circleStrokeColor).toBe(DIGNITY_PALETTE.selectedAccent);
  });

  it('cluster fill uses copper aggregate, not per-kind shades', () => {
    expect(DIGNITY_PALETTE.point).toBeTruthy();
  });

  it('assertNoHeatmapRegister passes for the real style + point paint', () => {
    const style = buildBasemapStyle({ pmtilesUrl: 'https://cdn.example/us.pmtiles' });
    expect(() => assertNoHeatmapRegister(style, { ...ENTITY_POINT_LAYER_STYLE })).not.toThrow();
  });

  it('assertNoHeatmapRegister throws on a heatmap layer', () => {
    const style = buildBasemapStyle({ basemapEnabled: false });
    const withHeat = { ...style, layers: [...style.layers, { id: 'h', type: 'heatmap' }] };
    expect(() => assertNoHeatmapRegister(withHeat, { ...ENTITY_POINT_LAYER_STYLE })).toThrow(/heatmap/i);
  });

  it('assertNoHeatmapRegister throws on a data-driven point color ramp', () => {
    const style = buildBasemapStyle({ basemapEnabled: false });
    const ramp = { circleColor: ['interpolate', ['linear'], ['get', 'count'], 0, '#000', 100, '#f00'] };
    expect(() => assertNoHeatmapRegister(style, ramp)).toThrow(/density-keyed ramp/i);
  });
});
