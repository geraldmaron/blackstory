import { themeColors } from '@/ui';
import {
  DEFAULT_MAP_GLYPHS_URL,
  DEFAULT_OPENFREEMAP_TILE_SOURCE_URL,
} from '../mapConfig';
import {
  assertNoHeatmapRegister,
  buildBasemapStyle,
  ENTITY_CLUSTER_RADIUS_EXPR,
  ENTITY_POINT_LAYER_STYLE,
  kindColorExpression,
} from '../mapStyle';
import { DIGNITY_PALETTE } from '../dignity-palette';

describe('buildBasemapStyle', () => {
  it('defaults to OpenFreeMap vector tiles when no PMTiles URL is set', () => {
    const style = buildBasemapStyle({ pmtilesUrl: null });
    expect(style.version).toBe(8);
    expect(style.name).toBe('blackstory-dark-archive-openfreemap');
    const source = style.sources.basemap as { type: string; url: string };
    expect(source.type).toBe('vector');
    expect(source.url).toBe(DEFAULT_OPENFREEMAP_TILE_SOURCE_URL);
    expect(style.layers.some((l) => (l as { id: string }).id === 'water')).toBe(true);
    expect(style.layers.some((l) => (l as { id: string }).id === 'admin-boundaries')).toBe(true);
    const boundary = style.layers.find((l) => (l as { id: string }).id === 'admin-boundaries') as {
      'source-layer': string;
    };
    // OpenMapTiles / OpenFreeMap layer id (not Protomaps `boundaries`).
    expect(boundary['source-layer']).toBe('boundary');
    const bg = style.layers[0] as { type: string; paint: Record<string, string> };
    expect(bg.type).toBe('background');
    expect(bg.paint['background-color']).toBe(themeColors.dark.canvas);
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
    expect(line.paint['line-color']).toBe(themeColors.dark.border);
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
