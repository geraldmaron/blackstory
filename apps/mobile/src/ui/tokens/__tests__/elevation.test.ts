/**
 * Unit tests for mobile elevation token API — flat matte default.
 */
import { brandCore } from '../generated/colors.generated';
import { getShadowStyle, type ShadowLevel } from '../elevation';

describe('elevation tokens', () => {
  describe('getShadowStyle', () => {
    it('returns empty style for none (browse/shell default)', () => {
      expect(getShadowStyle('none', 'dark')).toEqual({});
      expect(getShadowStyle('none', 'light')).toEqual({});
    });

    (['sm', 'md', 'lg'] as const).forEach((level) => {
      it(`light ${level} shadow opacity stays subtler than dark (map chrome only)`, () => {
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
});
