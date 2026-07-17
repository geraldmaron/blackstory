/**
 * Global security response headers for Next.js and edge middleware (BB-028).
 */

import { buildContentSecurityPolicy } from './csp';

export type SecurityHeader = {
  key: string;
  value: string;
};

/** Referrer-Policy: strict-origin-when-cross-origin limits query leakage. */
export const REFERRER_POLICY = 'strict-origin-when-cross-origin';

/**
 * Permissions-Policy: disable powerful features on the public read surface.
 * Adjust when corrections uploads or media require explicit grants.
 */
export const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'autoplay=()',
  'camera=()',
  'display-capture=()',
  'encrypted-media=()',
  'fullscreen=(self)',
  'geolocation=()',
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

/** Build global security headers applied to all public routes. */
export function buildGlobalSecurityHeaders(): SecurityHeader[] {
  const csp = buildContentSecurityPolicy({
    allowInlineStyles: true,
    enforceTrustedTypes: false,
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

/** Convert to Next.js headers() config entries. */
export function securityHeadersForNextConfig(): SecurityHeader[] {
  return buildGlobalSecurityHeaders();
}

/** Apply security headers onto an existing Headers instance. */
export function applySecurityHeaders(headers: Headers): void {
  for (const { key, value } of buildGlobalSecurityHeaders()) {
    headers.set(key, value);
  }
}

/** Clickjacking protection is covered by X-Frame-Options DENY and CSP frame-ancestors 'none'. */
export function clickjackingProtectionHeaders(): SecurityHeader[] {
  return [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  ];
}

/** MIME sniffing protection header. */
export function mimeSniffingProtectionHeader(): SecurityHeader {
  return { key: 'X-Content-Type-Options', value: 'nosniff' };
}
