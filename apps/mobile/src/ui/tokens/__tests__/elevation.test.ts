/**
 * The one elevation the app has: a sheet over the map.
 */
import { getFloatShadowStyle } from '../elevation';
import { shadows } from '../generated/shadows.generated';

describe('getFloatShadowStyle', () => {
  (['light', 'dark'] as const).forEach((theme) => {
    it(`${theme} carries the three web float layers`, () => {
      expect(getFloatShadowStyle(theme)).toEqual({ boxShadow: shadows[theme].float });
      expect(shadows[theme].float).toHaveLength(3);
    });
  });
});
