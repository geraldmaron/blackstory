/**
 * MIN_TOUCH_TARGET platform-awareness (Wave 8): Android's Material guidance sets a 48dp floor,
 * while iOS designs around 44pt — the token used to be a flat 44 on both, which is a visibly
 * unusable control on Android that an invisible hit slop doesn't excuse.
 *
 * Proving the Android branch isn't a matter of flipping `Platform.OS` at runtime: RN's own
 * `Platform.select` on the `.ios.js` build (what jest-expo resolves by default) has 'ios'
 * baked into its own closure — `'ios' in spec ? spec.ios : ...` — so it ignores `OS` entirely,
 * and mutating `OS` on an already-loaded `react-native` (the pattern `maps-handoff.test.ts` uses
 * for a value actually read at call time) never reaches it. The only way to observe the Android
 * branch under Jest is to swap in an Android-shaped `Platform` module before the token module is
 * (re-)required, in a sandboxed registry so it doesn't leak into the rest of the suite.
 */
import { MIN_TOUCH_TARGET } from '../index';

describe('MIN_TOUCH_TARGET', () => {
  it('is 44 on iOS — this suite’s jest-expo default', () => {
    expect(MIN_TOUCH_TARGET).toBe(44);
  });

  it('is 48 on Android', () => {
    let androidValue: number | undefined;
    jest.isolateModules(() => {
      jest.doMock('react-native/Libraries/Utilities/Platform', () => ({
        __esModule: true,
        default: {
          OS: 'android',
          select: (spec: Record<string, unknown>) =>
            'android' in spec ? spec.android : spec.default,
        },
      }));
      /* eslint-disable-next-line @typescript-eslint/no-require-imports */
      androidValue = require('../index').MIN_TOUCH_TARGET;
    });
    expect(androidValue).toBe(48);
  });
});
