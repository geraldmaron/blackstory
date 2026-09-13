/**
 * Plain-JS security headers for next.config.mjs.
 * Keep in sync with security-headers.ts, tested via web-security.test.ts.
 *
 * Content-Security-Policy is deliberately NOT emitted here. A nonce cannot be static — Next
 * reads this module directly (no TS transform, no per-request context) — so CSP moves to
 * `proxy.ts`, which issues a fresh nonce per request and sets the header there via
 * `applySecurityHeaders`/`buildContentSecurityPolicy` (see csp.ts, CSP_NONCE_HEADER). Every
 * header below is static and safe to keep here.
 */

/** @returns {{ key: string, value: string }}  */
export function securityHeadersForNextConfig() {
  const permissionsPolicy = [
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

  return [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: permissionsPolicy },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  ];
}
