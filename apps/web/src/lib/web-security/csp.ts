/**
 * Content-Security-Policy builder for the public web surface.
 * Production allows inline scripts for Next.js App Router flight/hydration until a
 * nonce pipeline lands; development also allows eval for HMR. MapLibre needs blob
 * workers and OpenFreeMap / demotiles connect+font+img hosts. Banned-books covers
 * need Open Library + archive.org img hosts (see BOOK_COVER_IMG_SRC).
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

/** Public entity/media objects (GCS dual-serve + Supabase Storage public-media). */
const PUBLIC_MEDIA_IMG_SRC = [
  'https://storage.googleapis.com',
  'https://twykhihqkcldpreuovay.supabase.co',
];

/**
 * Banned-books cover thumbnails: Open Library ISBN URLs redirect to archive.org
 * (and ia*.us.archive.org). Each hop must match img-src or the browser blocks the
 * image and BooksCoverArt falls back to initials placeholders.
 */
export const BOOK_COVER_IMG_SRC = [
  'https://covers.openlibrary.org',
  'https://archive.org',
  'https://*.us.archive.org',
];

const DEFAULT_IMG_SRC = [
  "'self'",
  'data:',
  'blob:',
  ...MAP_TILE_SRC,
  ...PUBLIC_MEDIA_IMG_SRC,
  ...BOOK_COVER_IMG_SRC,
];
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
  // Next.js App Router ships RSC flight data in inline <script> tags without nonces.
  // Production must allow 'unsafe-inline' until a per-request nonce pipeline lands
  // (see tracker follow-up for nonce + strict-dynamic). Dev still needs 'unsafe-eval' for HMR.
  const scriptSrc = isDev ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] : ["'self'", "'unsafe-inline'"];
  const workerSrc = ["'self'", 'blob:'];
  const resolvedConnectSrc = isDev ? [...connectSrc, 'ws:', 'wss:'] : connectSrc;

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
    'frame-src': ["'none'"],
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
    .map(([name, values]) => (values.length === 0 ? name : `${name} ${values.join(' ')}`))
    .join('; ');
}
