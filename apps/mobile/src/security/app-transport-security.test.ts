/**
 * App Transport Security per build variant, read from app.config.ts itself.
 *
 * Expo's bare prebuild template Info.plist ships NSAllowsLocalNetworking = true. A config that only
 * adds the exemption for development leaves that template default in place for production, so the
 * store build quietly carried the LAN exemption until the mobile release gate's first CI dispatch
 * failed ios-store-compliance on it. Production has to state both keys, not omit them.
 */

type AppConfigModule = {
  default: { ios?: { infoPlist?: { NSAppTransportSecurity?: Record<string, unknown> } } };
};

function atsFor(
  variant: 'development' | 'preview' | 'production',
): Record<string, unknown> | undefined {
  const saved = { APP_VARIANT: process.env.APP_VARIANT, API_BASE_URL: process.env.API_BASE_URL };
  let ats: Record<string, unknown> | undefined;
  try {
    process.env.APP_VARIANT = variant;
    // Production refuses a cleartext API base, so give it the real https origin.
    process.env.API_BASE_URL =
      variant === 'production' ? 'https://api.blackstory.app' : 'http://127.0.0.1:8080';
    jest.isolateModules(() => {
      /* eslint-disable-next-line @typescript-eslint/no-require-imports */
      const config = (require('../../app.config') as AppConfigModule).default;
      ats = config.ios?.infoPlist?.NSAppTransportSecurity;
    });
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  return ats;
}

describe('App Transport Security by variant', () => {
  it('states both exemptions as off in production, so the template default cannot ship', () => {
    expect(atsFor('production')).toEqual({
      NSAllowsArbitraryLoads: false,
      NSAllowsLocalNetworking: false,
    });
  });

  it.each(['development', 'preview'] as const)(
    'keeps the local-network exemption in %s, where the API can be a LAN or simulator host',
    (variant) => {
      expect(atsFor(variant)).toEqual({ NSAllowsLocalNetworking: true });
    },
  );
});
