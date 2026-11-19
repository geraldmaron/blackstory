/**
 * Unit tests for the mobile elevation token API (sheet, lift, float).
 */
import { getShadowStyle } from '../elevation';
import { shadows } from '../generated/shadows.generated';

describe('getShadowStyle', () => {
  it('returns an empty style for none', () => {
    expect(getShadowStyle('none', 'dark')).toEqual({});
    expect(getShadowStyle('none', 'light')).toEqual({});
  });

  (['sheet', 'lift', 'float'] as const).forEach((level) => {
    (['light', 'dark'] as const).forEach((theme) => {
      it(`${level} on ${theme} carries the three web shadow layers`, () => {
        expect(getShadowStyle(level, theme)).toEqual({ boxShadow: shadows[theme][level] });
        expect(shadows[theme][level]).toHaveLength(3);
      });
    });
  });
});
