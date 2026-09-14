/**
 * The app-level privacy manifest is declared in app.config.ts, not left to CocoaPods.
 *
 * Expo's withPrivacyInfo plugin writes ios/<Project>/PrivacyInfo.xcprivacy only when
 * ios.privacyManifests is declared. Before it was, the file existed locally only because pod install
 * aggregates pod privacy manifests, so a `prebuild --no-install` (what the mobile release gate runs)
 * produced no manifest at all, and App Store Connect rejects an upload without one. The entries mirror
 * what that aggregation produced for this app's pods.
 */

type PrivacyManifests = {
  NSPrivacyAccessedAPITypes?: {
    NSPrivacyAccessedAPIType: string;
    NSPrivacyAccessedAPITypeReasons: string[];
  }[];
  NSPrivacyCollectedDataTypes?: unknown[];
  NSPrivacyTracking?: boolean;
};

type AppConfigModule = { default: { ios?: { privacyManifests?: PrivacyManifests } } };

function privacyManifestsFor(
  variant: 'development' | 'preview' | 'production',
): PrivacyManifests | undefined {
  const saved = { APP_VARIANT: process.env.APP_VARIANT, API_BASE_URL: process.env.API_BASE_URL };
  let manifests: PrivacyManifests | undefined;
  try {
    process.env.APP_VARIANT = variant;
    process.env.API_BASE_URL =
      variant === 'production' ? 'https://api.blackstory.app' : 'http://127.0.0.1:8080';
    jest.isolateModules(() => {
      /* eslint-disable-next-line @typescript-eslint/no-require-imports */
      manifests = (require('../../app.config') as AppConfigModule).default.ios?.privacyManifests;
    });
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  return manifests;
}

describe('iOS privacy manifest declaration', () => {
  it.each(['development', 'preview', 'production'] as const)(
    'declares the required-reason APIs, no tracking and no collected data in %s',
    (variant) => {
      const manifests = privacyManifestsFor(variant);
      expect(manifests?.NSPrivacyTracking).toBe(false);
      expect(manifests?.NSPrivacyCollectedDataTypes).toEqual([]);
      const reasons = Object.fromEntries(
        (manifests?.NSPrivacyAccessedAPITypes ?? []).map((entry) => [
          entry.NSPrivacyAccessedAPIType,
          entry.NSPrivacyAccessedAPITypeReasons,
        ]),
      );
      expect(reasons).toEqual({
        NSPrivacyAccessedAPICategoryUserDefaults: ['CA92.1'],
        NSPrivacyAccessedAPICategorySystemBootTime: ['35F9.1'],
        NSPrivacyAccessedAPICategoryFileTimestamp: ['C617.1'],
      });
    },
  );
});
