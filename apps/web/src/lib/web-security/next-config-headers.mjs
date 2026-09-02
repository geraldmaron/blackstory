/**
 * Plain-JS security headers for next.config.mjs.
 * Keep in sync with security-headers.ts csp.ts tested via web-security.test.ts.
 */

/** @returns {{ key: string, value: string }}  */
export function securityHeadersForNextConfig() {
  const isDev = process.env.NODE_ENV !== 'production';
  // Keep in sync with csp.ts — production needs 'unsafe-inline' for Next RSC flight
  // scripts until a nonce pipeline lands.
  const vercelAnalytics = 'https://va.vercel-scripts.com https://vitals.vercel-insights.com';
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${vercelAnalytics}`
    : `script-src 'self' 'unsafe-inline' ${vercelAnalytics}`;
  const mapTiles = 'https://demotiles.maplibre.org https://tiles.openfreemap.org';
  // Keep in sync with csp.ts DEFAULT_IMG_SRC (GCS + Supabase public-media + book covers).
  const publicMedia = 'https://storage.googleapis.com https://twykhihqkcldpreuovay.supabase.co';
  // Article hero/inline imagery from public-domain archival collections (Wikimedia
  // Commons). Production should re-host into the Supabase media bucket.
  // commons.wikimedia.org (repo-4vuf, pin-and-serve): Special:FilePath 302s from here to
  // upload.wikimedia.org — keep in sync with csp.ts ARTICLE_MEDIA_IMG_SRC.
  const articleMedia = 'https://upload.wikimedia.org https://commons.wikimedia.org';
  // Open Library cover URLs redirect to archive.org / ia*.us.archive.org — allow each hop.
  const bookCovers = 'https://covers.openlibrary.org https://archive.org https://*.us.archive.org';
  const connectSrc = isDev
    ? `connect-src 'self' ws: wss: ${mapTiles} ${vercelAnalytics}`
    : `connect-src 'self' ${mapTiles} ${vercelAnalytics}`;
  const cspParts = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${mapTiles} ${publicMedia} ${articleMedia} ${bookCovers}`,
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
