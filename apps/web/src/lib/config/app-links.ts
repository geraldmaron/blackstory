/**
 * The one place the published app-link association values are decided.
 *
 * Two files have to agree with the shipped mobile binary or the OS silently refuses to open
 * links in the app: `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`.
 * `apps/mobile/public/.well-known/` holds local fixtures of the same shape, but those are never
 * served — `blackstory.app` is `apps/web`, so this module is the authoritative copy and the
 * routes below it are what iOS and Android actually fetch.
 *
 * The Apple Team ID is real (set 2026-07-22) and the iOS side is publishable as-is. The Android
 * release signing certificate does not exist yet, so `ANDROID_APP_LINKS_SHA256_FINGERPRINTS` is
 * unset in every environment and the assetlinks route fails closed rather than publishing a
 * placeholder. A wrong fingerprint is worse than an absent file: Android caches a failed
 * verification, so the app stops being a candidate handler until the cache expires.
 *
 * Every value stays env-overridable so a signing identity or a bundle rename lands as
 * configuration, not as a code change.
 */

/** Apple Developer Team ID that owns the iOS bundle. */
export const APPLE_TEAM_ID: string = process.env.APPLE_TEAM_ID?.trim() || '4Q2XU7D33G';

/** Production iOS bundle identifier. */
export const IOS_BUNDLE_ID: string = process.env.IOS_BUNDLE_ID?.trim() || 'app.blackstory.mobile';

/** Production Android application id. */
export const ANDROID_PACKAGE_NAME: string =
  process.env.ANDROID_PACKAGE_NAME?.trim() || 'app.blackstory.mobile';

/**
 * Web route shapes the mobile app mirrors. The `NOT` entries keep the web app's own API routes
 * out of the app: a link to an API path is a fetch, never a screen.
 */
export const UNIVERSAL_LINK_PATHS: readonly string[] = [
  '/explore',
  '/search',
  '/learn',
  '/more',
  '/entity/*',
  '/history',
  '/history/*',
  '/stories',
  '/stories/*',
  '/myths',
  '/myths/*',
  '/methodology',
  '/about',
  '/corrections',
  '/corrections/*',
  '/errata',
  '/facts',
  '/facts/*',
  'NOT /submit/api/*',
  'NOT /corrections/api/*',
  'NOT /search/api/*',
  'NOT /history/api/*',
  'NOT /locate/api/*',
];

/** A SHA-256 certificate fingerprint as Android expects it: 32 uppercase hex bytes, colon-separated. */
const SHA256_FINGERPRINT = /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/;

/**
 * Release signing fingerprints, comma-separated in the environment. Anything that is not a
 * well-formed SHA-256 fingerprint is dropped, which is what keeps the `TODO_REPLACE_WITH_...`
 * placeholder carried in the mobile fixture from ever reaching the served file.
 */
export function androidCertFingerprints(
  raw: string | undefined = process.env.ANDROID_APP_LINKS_SHA256_FINGERPRINTS,
): string[] {
  return (raw ?? '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => SHA256_FINGERPRINT.test(value));
}

/** The `appID` iOS matches against the entitlement in the installed build. */
export function appleAppId(): string {
  return `${APPLE_TEAM_ID}.${IOS_BUNDLE_ID}`;
}

/** Body of `/.well-known/apple-app-site-association`. */
export function buildAppleAppSiteAssociation(): unknown {
  return {
    applinks: {
      apps: [],
      details: [{ appID: appleAppId(), paths: [...UNIVERSAL_LINK_PATHS] }],
    },
  };
}

/** Body of `/.well-known/assetlinks.json`, or null when no real fingerprint is configured. */
export function buildAssetLinks(
  fingerprints: string[] = androidCertFingerprints(),
): unknown | null {
  if (fingerprints.length === 0) return null;
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: ANDROID_PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
