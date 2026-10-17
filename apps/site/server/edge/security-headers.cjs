/**
 * Content-Security-Policy and the global security headers. Port of
 * apps/web/src/lib/web-security/{csp,security-headers}.ts, same directive lists, same nonce shape
 * (`'self' 'nonce-X' 'strict-dynamic'`). The theme bootstrap hash is kept so the policy stays a
 * superset of today's until the site has its own theme bootstrap (design package task).
 */
const THEME_BOOTSTRAP_SCRIPT_SHA256 = "'sha256-51ZZphqguJf2bHn9CnelhCzdAtWW/oDmMD+ATk0tpAk='";

const MAP_TILE_SRC = ['https://demotiles.maplibre.org', 'https://tiles.openfreemap.org'];
const SATELLITE_TILE_SRC = ['https://basemap.nationalmap.gov'];
const PUBLIC_MEDIA_IMG_SRC = [
  'https://storage.googleapis.com',
  'https://twykhihqkcldpreuovay.supabase.co',
];
const ARTICLE_MEDIA_IMG_SRC = [
  'https://upload.wikimedia.org',
  'https://commons.wikimedia.org',
  'https://thumb.wikimedia.org',
  'https://tile.loc.gov',
  'https://www.archives.gov',
];
const ARCHIVAL_MEDIA_SRC = ['https://tile.loc.gov'];
const BOOK_COVER_IMG_SRC = [
  'https://covers.openlibrary.org',
  'https://archive.org',
  'https://*.us.archive.org',
];
const VERCEL_ANALYTICS_SRC = [
  'https://va.vercel-scripts.com',
  'https://vitals.vercel-insights.com',
];

const DEFAULT_IMG_SRC = [
  "'self'",
  'data:',
  'blob:',
  ...MAP_TILE_SRC,
  ...SATELLITE_TILE_SRC,
  ...PUBLIC_MEDIA_IMG_SRC,
  ...ARTICLE_MEDIA_IMG_SRC,
  ...BOOK_COVER_IMG_SRC,
];
const DEFAULT_CONNECT_SRC = [
  "'self'",
  ...MAP_TILE_SRC,
  ...SATELLITE_TILE_SRC,
  ...VERCEL_ANALYTICS_SRC,
];
const DEFAULT_FONT_SRC = ["'self'", ...MAP_TILE_SRC];

function authConnectOrigin(raw, isDev) {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.hostname.includes('*') || url.search || url.hash)
      return undefined;
    if (url.protocol !== 'https:' && !(isDev && loopback && url.protocol === 'http:'))
      return undefined;
    if (!isDev && loopback) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function buildContentSecurityPolicy(options = {}) {
  const {
    allowInlineStyles = true,
    enforceTrustedTypes = false,
    imgSrc = DEFAULT_IMG_SRC,
    connectSrc = DEFAULT_CONNECT_SRC,
    isDev = process.env.NODE_ENV !== 'production',
    nonce,
    authUrl,
  } = options;

  const styleSrc = allowInlineStyles ? ["'self'", "'unsafe-inline'"] : ["'self'"];
  const scriptSrc = nonce
    ? [
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        THEME_BOOTSTRAP_SCRIPT_SHA256,
        ...(isDev ? ["'unsafe-eval'"] : []),
        ...VERCEL_ANALYTICS_SRC,
      ]
    : isDev
      ? ["'self'", "'unsafe-inline'", "'unsafe-eval'", ...VERCEL_ANALYTICS_SRC]
      : ["'self'", "'unsafe-inline'", ...VERCEL_ANALYTICS_SRC];
  const authOrigin = authConnectOrigin(authUrl, isDev);
  const resolvedConnectSrc = [
    ...connectSrc,
    ...(authOrigin ? [authOrigin] : []),
    ...(isDev ? ['ws:', 'wss:'] : []),
  ];

  const directives = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'script-src': scriptSrc,
    'style-src': styleSrc,
    'img-src': imgSrc,
    'media-src': ["'self'", ...ARCHIVAL_MEDIA_SRC],
    'font-src': DEFAULT_FONT_SRC,
    'connect-src': resolvedConnectSrc,
    'frame-src': ["'none'"],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'child-src': ["'self'", 'blob:'],
  };
  if (!isDev) directives['upgrade-insecure-requests'] = [];
  if (enforceTrustedTypes) {
    directives['require-trusted-types-for'] = ["'script'"];
    directives['trusted-types'] = ['blackBookDefault', 'default'];
  }
  return Object.entries(directives)
    .map(([name, values]) => (values.length === 0 ? name : `${name} ${values.join(' ')}`))
    .join('; ');
}

const REFERRER_POLICY = 'strict-origin-when-cross-origin';
const PERMISSIONS_POLICY = [
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

/** @returns {Array<{key:string,value:string}>} */
function buildGlobalSecurityHeaders({ nonce, authUrl } = {}) {
  const csp = buildContentSecurityPolicy({
    allowInlineStyles: true,
    enforceTrustedTypes: false,
    ...(nonce ? { nonce } : {}),
    ...(authUrl ? { authUrl } : {}),
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

module.exports = {
  buildContentSecurityPolicy,
  buildGlobalSecurityHeaders,
  THEME_BOOTSTRAP_SCRIPT_SHA256,
};
