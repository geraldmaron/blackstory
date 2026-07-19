import {
  resolveAppCheckProviderConfig,
  initializeAppCheckClient,
  getAppCheckToken,
  __resetAppCheckForTests,
  type AppVariant,
} from './app-check';

afterEach(() => {
  __resetAppCheckForTests();
});

describe('resolveAppCheckProviderConfig', () => {
  it('uses hardware-backed attestation for a production release build', () => {
    const config = resolveAppCheckProviderConfig({
      variant: 'production',
      isDev: false,
    });
    expect(config.apple).toBe('appAttestWithDeviceCheckFallback');
    expect(config.android).toBe('playIntegrity');
    expect(config.debugProviderEnabled).toBe(false);
  });

  it('permits the debug provider only in a dev build on a non-production variant', () => {
    const config = resolveAppCheckProviderConfig({
      variant: 'development',
      isDev: true,
    });
    expect(config.apple).toBe('debug');
    expect(config.android).toBe('debug');
    expect(config.debugProviderEnabled).toBe(true);
  });

  // The core adversarial assertion the bead requires: the debug provider must
  // be STATICALLY UNREACHABLE under the production profile.
  it('never enables the debug provider under the production profile — even if isDev is somehow true', () => {
    const productionRelease = resolveAppCheckProviderConfig({
      variant: 'production',
      isDev: false,
    });
    // Defence in depth: a mis-set isDev=true must STILL not unlock debug on prod.
    const productionWithDevFlag = resolveAppCheckProviderConfig({
      variant: 'production',
      isDev: true,
    });

    for (const config of [productionRelease, productionWithDevFlag]) {
      expect(config.debugProviderEnabled).toBe(false);
      expect(config.apple).not.toBe('debug');
      expect(config.android).not.toBe('debug');
    }
  });

  // A release bundle has __DEV__ === false; the debug provider is unreachable
  // there for EVERY variant, not just production.
  it('never enables the debug provider in any release build (isDev=false)', () => {
    const variants: AppVariant[] = ['development', 'preview', 'production'];
    for (const variant of variants) {
      const config = resolveAppCheckProviderConfig({ variant, isDev: false });
      expect(config.debugProviderEnabled).toBe(false);
      expect(config.apple).toBe('appAttestWithDeviceCheckFallback');
      expect(config.android).toBe('playIntegrity');
    }
  });
});

describe('initializeAppCheckClient (defensive)', () => {
  it('degrades gracefully (no throw) when the native module / Firebase config is absent', async () => {
    const result = await initializeAppCheckClient({
      variant: 'development',
      isDev: true,
      loadNative: () => null, // simulate missing native module / config file
    });
    expect(result.initialized).toBe(false);
    if (!result.initialized) {
      expect(result.reason).toMatch(/absent/i);
    }
  });

  it('returns a null token when App Check was never initialized', async () => {
    await expect(getAppCheckToken()).resolves.toBeNull();
  });

  it('initializes and issues a token when the native module is present', async () => {
    const configureSpy = jest.fn();
    const getTokenSpy = jest.fn().mockResolvedValue({ token: 'attestation-jwt' });
    const fakeNative = {
      getApp: () => ({}) as never,
      ReactNativeFirebaseAppCheckProvider: class {
        configure = configureSpy;
        getToken = jest.fn();
      } as never,
      initializeAppCheck: jest.fn().mockResolvedValue({ instance: true }),
      getToken: getTokenSpy,
    };

    const result = await initializeAppCheckClient({
      variant: 'preview',
      isDev: false,
      loadNative: () => fakeNative as never,
    });

    expect(result.initialized).toBe(true);
    if (result.initialized) {
      expect(result.debugProviderEnabled).toBe(false);
    }
    // Provider configured with hardware attestation, not debug.
    expect(configureSpy).toHaveBeenCalledWith({
      apple: { provider: 'appAttestWithDeviceCheckFallback' },
      android: { provider: 'playIntegrity' },
    });

    await expect(getAppCheckToken()).resolves.toBe('attestation-jwt');
  });

  it('degrades (no throw) when native initialization itself fails', async () => {
    const fakeNative = {
      getApp: () => {
        throw new Error('no Firebase app registered');
      },
      ReactNativeFirebaseAppCheckProvider: class {
        configure = jest.fn();
        getToken = jest.fn();
      } as never,
      initializeAppCheck: jest.fn(),
      getToken: jest.fn(),
    };
    const result = await initializeAppCheckClient({
      variant: 'production',
      isDev: false,
      loadNative: () => fakeNative as never,
    });
    expect(result.initialized).toBe(false);
    if (!result.initialized) {
      expect(result.reason).toMatch(/failed/i);
    }
    await expect(getAppCheckToken()).resolves.toBeNull();
  });
});
