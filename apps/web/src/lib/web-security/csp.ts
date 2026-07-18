/**
 * Content-Security-Policy builder for the public web surface.
 * Strict defaults in production; Next.js MapLibre need limited relaxations in development
 * (inline/eval scripts for hydration + HMR, blob workers for MapLibre GL).
 */

export type CspBuildOptions = {
  /** When true, allow inline styles required by Next.js hydration (default).  */
  allowInlineStyles?: boolean;
  /** When true, emit Trusted Types directives (report-only recommended first).  */
  enforceTrustedTypes?: boolean;
  /** Extra host sources for img/connect (e.g. CDN).  */
  imgSrc?: string[];
  connectSrc?: string[];
  /** Override NODE_ENV detection (tests).  */
  isDev?: boolean;
};

/** MapLibre demo tiles (fallback) + OpenFreeMap streets/fonts for the archive basemap. */
const MAP_TILE_SRC = ['https://demotiles.maplibre.org', 'https://tiles.openfreemap.org'];

const DEFAULT_IMG_SRC = ["'self'", 'data:', 'blob:', ...MAP_TILE_SRC];
const DEFAULT_CONNECT_SRC = ["'self'", ...MAP_TILE_SRC];
const DEFAULT_FONT_SRC = ["'self'", ...MAP_TILE_SRC];

/** Build a semicolon-delimited CSP header value.  */
export function buildContentSecurityPolicy(options: CspBuildOptions = {}): string {
  const {
    allowInlineStyles = true,
    enforceTrustedTypes = false,
    imgSrc = DEFAULT_IMG_SRC,
    connectSrc = DEFAULT_CONNECT_SRC,
    isDev = process.env.NODE_ENV !== 'production',
  } = options;

  const styleSrc = allowInlineStyles ? ["'self'", "'unsafe-inline'"] : ["'self'"];
  // Next.js App Router hydrates via inline bootstrap scripts; webpack HMR needs eval in
  // development. Production stays strict ('self' only) until a nonce pipeline lands.
  const scriptSrc = isDev ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] : ["'self'"];
  const workerSrc = ["'self'", 'blob:'];
  const resolvedConnectSrc = isDev
    ? [...connectSrc, 'ws:', 'wss:']
    : connectSrc;

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'script-src': scriptSrc,
    'style-src': styleSrc,
    'img-src': imgSrc,
    'font-src': DEFAULT_FONT_SRC,
    'connect-src': resolvedConnectSrc,
    'manifest-src': ["'self'"],
    'worker-src': workerSrc,
    'child-src': ["'self'", 'blob:'],
  };

  if (!isDev) {
    directives['upgrade-insecure-requests'] = [];
  }

  if (enforceTrustedTypes) {
    directives['require-trusted-types-for'] = ["'script'"];
    directives['trusted-types'] = ['blackBookDefault', 'default'];
  }

  return Object.entries(directives)
    .map(([name, values]) =>
      values.length === 0 ? name : `${name} ${values.join(' ')}`,
    )
    .join('; ');
}
