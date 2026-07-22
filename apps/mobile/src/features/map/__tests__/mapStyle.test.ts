import { brandCore, themeColors } from '@/ui';
import {
  assertNoHeatmapRegister,
  buildBasemapStyle,
  ENTITY_POINT_LAYER_STYLE,
} from '../mapStyle';

describe('buildBasemapStyle', () => {
  it('returns the demo dark canvas with ZERO tile sources when no PMTiles URL is set', () => {
    const style = buildBasemapStyle({ pmtilesUrl: null });
    expect(style.version).toBe(8);
    expect(Object.keys(style.sources)).toHaveLength(0); // no network / no third-party demo tiles
    expect(style.layers).toHaveLength(1);
    const bg = style.layers[0] as { type: string; paint: Record<string, string> };
    expect(bg.type).toBe('background');
    // Dark register sourced from brand tokens, not a parallel hardcoded hex.
    expect(bg.paint['background-color']).toBe(themeColors.dark.canvas);
  });

  it('attaches a pmtiles:// vector source and dark low-contrast boundary lines when a URL is set', () => {
    const style = buildBasemapStyle({ pmtilesUrl: 'https://cdn.example/us.pmtiles', glyphsUrl: 'https://cdn.example/glyphs/{fontstack}/{range}.pbf' });
    const source = style.sources.basemap as { type: string; url: string };
    expect(source.type).toBe('vector');
    expect(source.url).toBe('pmtiles://https://cdn.example/us.pmtiles');
    expect(style.glyphs).toBeTruthy();
    const line = style.layers.find((l) => (l as { id: string }).id === 'admin-boundaries') as {
      paint: Record<string, unknown>;
    };
    expect(line.paint['line-color']).toBe(themeColors.dark.border);
  });
});

describe('dignity invariant (no crime-heatmap register)', () => {
  it('point layer uses a single flat copper color, not a data-driven density ramp', () => {
    expect(ENTITY_POINT_LAYER_STYLE.circleColor).toBe(brandCore.copperPin);
    expect(Array.isArray(ENTITY_POINT_LAYER_STYLE.circleColor)).toBe(false);
  });

  it('assertNoHeatmapRegister passes for the real style + point paint', () => {
    const style = buildBasemapStyle({ pmtilesUrl: 'https://cdn.example/us.pmtiles' });
    expect(() => assertNoHeatmapRegister(style, { ...ENTITY_POINT_LAYER_STYLE })).not.toThrow();
  });

  it('assertNoHeatmapRegister throws on a heatmap layer', () => {
    const style = buildBasemapStyle({ pmtilesUrl: null });
    const withHeat = { ...style, layers: [...style.layers, { id: 'h', type: 'heatmap' }] };
    expect(() => assertNoHeatmapRegister(withHeat, { ...ENTITY_POINT_LAYER_STYLE })).toThrow(/heatmap/i);
  });

  it('assertNoHeatmapRegister throws on a data-driven point color ramp', () => {
    const style = buildBasemapStyle({ pmtilesUrl: null });
    const ramp = { circleColor: ['interpolate', ['linear'], ['get', 'count'], 0, '#000', 100, '#f00'] };
    expect(() => assertNoHeatmapRegister(style, ramp)).toThrow(/density ramp/i);
  });
});
