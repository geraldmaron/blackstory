/**
 * Plain-JS security headers for next.config.mjs.
 * Keep in sync with security-headers.ts csp.ts tested via web-security.test.ts.
 */

/** @returns {{ key: string, value: string }}  */
export function securityHeadersForNextConfig() {
  const isDev = process.env.NODE_ENV !== 'production';
  // Keep in sync with csp.ts — production needs 'unsafe-inline' for Next RSC flight
  // scripts until a nonce pipeline lands.
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
  const mapTiles = 'https://demotiles.maplibre.org https://tiles.openfreemap.org';
  const connectSrc = isDev
    ? `connect-src 'self' ws: wss: ${mapTiles}`
    : `connect-src 'self' ${mapTiles}`;
  const cspParts = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${mapTiles}`,
    `font-src 'self' ${mapTiles}`,
    connectSrc,
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
  ];
  if (!isDev) {
    cspParts.push('upgrade-insecure-requests');
  }
  const csp = cspParts.join('; ');

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
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: permissionsPolicy },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  ];
}
