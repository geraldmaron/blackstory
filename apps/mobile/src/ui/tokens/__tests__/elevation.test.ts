/**
 * Unit tests for mobile elevation token API (shadows + brand gradients).
 */
import { brandCore, themeColors } from '../generated/colors.generated';
import { getGradient, getShadowStyle, type GradientName, type ShadowLevel } from '../elevation';

describe('elevation tokens', () => {
  describe('getShadowStyle', () => {
    it('returns empty style for none', () => {
      expect(getShadowStyle('none', 'dark')).toEqual({});
      expect(getShadowStyle('none', 'light')).toEqual({});
    });

    (['sm', 'md', 'lg'] as const).forEach((level) => {
      it(`light ${level} shadow opacity stays subtler than dark (readable lift without muddying paper)`, () => {
        const light = getShadowStyle(level, 'light');
        const dark = getShadowStyle(level, 'dark');
        const lightOpacity = light.shadowOpacity as number;
        const darkOpacity = dark.shadowOpacity as number;
        expect(lightOpacity).toBeLessThan(darkOpacity);
        expect(lightOpacity).toBeLessThanOrEqual(0.12);
      });
    });

    (['sm', 'md', 'lg'] as const).forEach((level) => {
      (['light', 'dark'] as const).forEach((theme) => {
        it(`${level} on ${theme} uses brand ink shadow color and bounded opacity`, () => {
          const style = getShadowStyle(level, theme);
          expect(style.shadowColor).toBe(brandCore.ebonyInk);
          expect(style.shadowOpacity).toBeGreaterThan(0);
          expect(style.shadowOpacity).toBeLessThanOrEqual(theme === 'light' ? 0.12 : 0.55);
          expect(style.shadowRadius).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('getGradient', () => {
    const names: GradientName[] = [
      'surfaceLift',
      'canvasDepth',
      'panelAtmosphere',
      'copperAccentEdge',
    ];

    names.forEach((name) => {
      (['light', 'dark'] as const).forEach((theme) => {
        it(`${name} on ${theme} uses only theme role colors`, () => {
          const gradient = getGradient(name, theme);
          const roles = new Set<string>(Object.values(themeColors[theme]));
          gradient.colors.forEach((color) => {
            expect(roles.has(color)).toBe(true);
          });
          expect(gradient.locations.length).toBe(gradient.colors.length);
        });
      });
    });

    it('copperAccentEdge keeps copper to the final ~7% stop only', () => {
      const light = getGradient('copperAccentEdge', 'light');
      expect(light.locations[light.locations.length - 2]).toBeGreaterThanOrEqual(0.9);
      expect(light.colors[light.colors.length - 1]).toBe(themeColors.light.accentGraphic);

      const dark = getGradient('copperAccentEdge', 'dark');
      expect(dark.locations[dark.locations.length - 2]).toBeGreaterThanOrEqual(0.9);
      expect(dark.colors[dark.colors.length - 1]).toBe(themeColors.dark.accentGraphic);
    });
  });
});
