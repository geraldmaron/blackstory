/**
 * Global security response headers for Next.js and edge middleware.
 */

import { buildContentSecurityPolicy } from './csp';

export type SecurityHeader = {
  key: string;
  value: string;
};

/** Referrer-Policy: strict-origin-when-cross-origin limits query leakage.  */
export const REFERRER_POLICY = 'strict-origin-when-cross-origin';

/**
 * Permissions-Policy: disable powerful features on the public read surface by default.
 * `geolocation=(self)` is required for `/locate` consent-gated browser location
 * (explicit user click only); other sensors stay denied.
 */
export const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'autoplay=()',
  'camera=()',
  'display-capture=()',
  'encrypted-media=()',
  'fullscreen=(self)',
  'geolocation=(self)',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'picture-in-picture=()',
  'publickey-credentials-get=()',
  'screen-wake-lock=()',
  'sync-xhr=()',
  'usb=()',
  'web-share=()',
  'xr-spatial-tracking=()',
].join(', ');

export type GlobalSecurityHeaderOptions = {
  /**
   * Per-request CSP nonce (see CSP_NONCE_HEADER). Pass this through from `proxy.ts` so
   * script-src uses `'nonce-<value>' 'strict-dynamic'` instead of `'unsafe-inline'`. Omitting
   * it is only correct for the static, nonce-less `next.config.mjs` header list — see
   * `securityHeadersForNextConfig` in `next-config-headers.mjs`, which drops CSP entirely
   * rather than emit a nonce-less one.
   */
  nonce?: string;
};

/** Build global security headers applied to all public routes.  */
export function buildGlobalSecurityHeaders(
  options: GlobalSecurityHeaderOptions = {},
): SecurityHeader[] {
  const csp = buildContentSecurityPolicy({
    allowInlineStyles: true,
    enforceTrustedTypes: false,
    // Spread-conditional rather than `nonce: options.nonce`: with `exactOptionalPropertyTypes`,
    // an explicit `nonce: undefined` is a different thing from the key being absent.
    ...(options.nonce ? { nonce: options.nonce } : {}),
  });

  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: REFERRER_POLICY },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  ];
}

/** Convert to Next.js headers config entries.  */
export function securityHeadersForNextConfig(): SecurityHeader[] {
  return buildGlobalSecurityHeaders();
}

/** Apply security headers onto an existing Headers instance.  */
export function applySecurityHeaders(
  headers: Headers,
  options: GlobalSecurityHeaderOptions = {},
): void {
  for (const { key, value } of buildGlobalSecurityHeaders(options)) {
    headers.set(key, value);
  }
}

/** Clickjacking protection is covered by X-Frame-Options DENY and CSP frame-ancestors 'none'.  */
export function clickjackingProtectionHeaders(): SecurityHeader[] {
  return [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  ];
}

/** MIME sniffing protection header.  */
export function mimeSniffingProtectionHeader(): SecurityHeader {
  return { key: 'X-Content-Type-Options', value: 'nosniff' };
}
