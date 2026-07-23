import { getUpdatesPosture, checkForUpdate, fetchAndApplyUpdate } from './bootstrap';

/**
 * Mirrors `src/observability/bootstrap.test.ts`'s bar: "never throws and
 * wires the pieces together correctly" — not exhaustive native-mock
 * coverage. Unlike Crashlytics/Perf (no jest-expo mock, so
 * `loadNativeCrashlytics`/`loadNativePerf` return `null` in tests),
 * `expo-updates` DOES ship a jest-expo auto-mock that reports
 * `isEnabled: true` with placeholder `"mock"` string values — the pure
 * disabled/`null` shape is exercised directly in `config.test.ts` instead.
 * These tests assert the one thing that must hold in EVERY environment
 * (mocked or real, gated or ungated): never throw, and the fixed
 * accepted-risk label is always present.
 */
describe('getUpdatesPosture', () => {
  it('never throws and always carries the fixed accepted-risk label', () => {
    const posture = getUpdatesPosture();
    expect(posture.codeSigningPosture).toBe('free-tier-accepted-risk');
    expect(typeof posture.enabled).toBe('boolean');
  });
});

describe('checkForUpdate', () => {
  it('never throws, regardless of whether the native module reports enabled', async () => {
    const result = await checkForUpdate();
    expect(typeof result.checked).toBe('boolean');
    if (!result.checked) {
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it('no-ops in __DEV__ so Metro owns the bundle (no OTA poll/reload)', async () => {
    // Jest runs with __DEV__ === true under jest-expo.
    const result = await checkForUpdate();
    expect(result).toEqual({
      checked: false,
      reason: 'OTA checks disabled in __DEV__',
    });
  });
});

describe('fetchAndApplyUpdate', () => {
  it('never throws, regardless of whether the native module reports enabled', async () => {
    const result = await fetchAndApplyUpdate();
    expect(typeof result.applied).toBe('boolean');
    if (!result.applied) {
      expect(typeof result.reason).toBe('string');
    }
  });

  it('refuses reloadAsync in __DEV__', async () => {
    const result = await fetchAndApplyUpdate();
    expect(result).toEqual({
      applied: false,
      reason: 'OTA apply/reload disabled in __DEV__',
    });
  });
});
