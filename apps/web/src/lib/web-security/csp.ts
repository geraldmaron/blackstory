/**
 * Content-Security-Policy builder for the public web surface.
 * Script-src is nonce-based (`'nonce-<n>' 'strict-dynamic'`) whenever `proxy.ts` supplies a
 * per-request nonce, which is how every real response is built (see CSP_NONCE_HEADER and
 * `proxy.ts`). A caller that omits `nonce` — only unmigrated tests/tooling should — falls back
 * to the old `'unsafe-inline'` allowance for Next.js App Router flight/hydration scripts;
 * production traffic never takes that fallback. Development also allows eval for HMR. MapLibre
 * needs blob workers and OpenFreeMap / demotiles connect+font+img hosts. Banned-books covers
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
  /**
   * Per-request nonce (base64) issued by `proxy.ts`. When present, script-src drops
   * `'unsafe-inline'` for `'nonce-<value>' 'strict-dynamic'` instead — see CSP_NONCE_HEADER.
   * Every production response carries one; omit only in tests exercising the legacy fallback.
   */
  nonce?: string;
};

/**
 * SHA-256 (base64) of `THEME_BOOTSTRAP_SCRIPT` (packages/ui/src/theme/document-theme.ts) — the
 * root layout's blocking pre-paint theme script. That script tag is one of the few CSP must
 * allow without a nonce: `app/layout.tsx` is on the shell resilience test's no-`await` list (see
 * command-bar-search.test.tsx's "awaits no data" checks — an async root layout is a page-level
 * throw no error boundary below it can catch), so it cannot call `next/headers()` for a nonce.
 * A content hash needs no request context and, like a nonce, coexists with `'strict-dynamic'`
 * under CSP3. THEME_BOOTSTRAP_SCRIPT is a fixed compile-time constant, so a static hash is safe
 * — but it must be recomputed if that script's source ever changes; web-security.test.ts checks
 * this constant against the live script content so drift fails a test instead of CSP silently.
 */
export const THEME_BOOTSTRAP_SCRIPT_SHA256 =
  "'sha256-51ZZphqguJf2bHn9CnelhCzdAtWW/oDmMD+ATk0tpAk='";

/** MapLibre demo tiles (fallback) + OpenFreeMap streets/fonts for the archive basemap. */
const MAP_TILE_SRC = ['https://demotiles.maplibre.org', 'https://tiles.openfreemap.org'];

/**
 * USGS National Map aerial imagery — the satellite basemap (`?sat=1`).
 *
 * Kept out of `MAP_TILE_SRC` deliberately: that list also feeds `font-src`, and this host serves
 * raster tiles only. MapLibre fetches raster tiles through the image pipeline, so this needs
 * img-src; it is in connect-src too because the WebGL path reads some tiles via fetch rather
 * than an `Image`, and a miss there fails as a silently blank basemap rather than an error.
 */
const SATELLITE_TILE_SRC = ['https://basemap.nationalmap.gov'];

/** Public entity/media objects (GCS dual-serve + Supabase Storage public-media). */
const PUBLIC_MEDIA_IMG_SRC = [
  'https://storage.googleapis.com',
  'https://twykhihqkcldpreuovay.supabase.co',
];

/**
 * Article hero/inline imagery sourced from public-domain archival collections.
 * Wikimedia Commons serves file bytes from upload.wikimedia.org. Production
 * should re-host these into the Supabase media bucket for durability (see
 * repo issue: re-host article hero images); this host keeps them rendering
 * until that pipeline lands.
 *
 * `commons.wikimedia.org` is here too (repo-4vuf, pin-and-serve): entity mast photos pin a
 * Commons file title and render it via `Special:FilePath/<title>?width=960`, which 302s to
 * `upload.wikimedia.org`. The browser's <img> request starts at commons.wikimedia.org before
 * the redirect, so both hosts must be allowed.
 */
// thumb.wikimedia.org: Commons' Special:Redirect/file now 301s rendered thumbnails to this host
// (observed 2026-09-02), so it is where a pinned photo's final <img> request lands.
const ARTICLE_MEDIA_IMG_SRC = [
  'https://upload.wikimedia.org',
  'https://commons.wikimedia.org',
  'https://thumb.wikimedia.org',
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
  ...SATELLITE_TILE_SRC,
  ...PUBLIC_MEDIA_IMG_SRC,
  ...ARTICLE_MEDIA_IMG_SRC,
  ...BOOK_COVER_IMG_SRC,
];
/** Vercel Web Analytics ingest + script host. */
const VERCEL_ANALYTICS_SRC = [
  'https://va.vercel-scripts.com',
  'https://vitals.vercel-insights.com',
];

const DEFAULT_CONNECT_SRC = [
  "'self'",
  ...MAP_TILE_SRC,
  ...SATELLITE_TILE_SRC,
  ...VERCEL_ANALYTICS_SRC,
];
const DEFAULT_FONT_SRC = ["'self'", ...MAP_TILE_SRC];

/** Build a semicolon-delimited CSP header value.  */
export function buildContentSecurityPolicy(options: CspBuildOptions = {}): string {
  const {
    allowInlineStyles = true,
    enforceTrustedTypes = false,
    imgSrc = DEFAULT_IMG_SRC,
    connectSrc = DEFAULT_CONNECT_SRC,
    isDev = process.env.NODE_ENV !== 'production',
    nonce,
  } = options;

  const styleSrc = allowInlineStyles ? ["'self'", "'unsafe-inline'"] : ["'self'"];
  // With a nonce, Next.js App Router's RSC flight/hydration scripts (and any manual <script>
  // carrying the same nonce — see CSP_NONCE_HEADER) are trusted directly, and 'strict-dynamic'
  // lets them load further scripts without a host allowlist. Dev still needs 'unsafe-eval' for
  // HMR. The host-based VERCEL_ANALYTICS_SRC entries stay for legacy browsers that ignore
  // 'strict-dynamic' and fall back to the plain allowlist.
  //
  // No nonce means an unmigrated caller (tests/tooling only — every real response goes through
  // proxy.ts, which always supplies one): fall back to the pre-nonce 'unsafe-inline' allowance
  // so flight/hydration scripts still run rather than breaking silently.
  const scriptSrc = nonce
    ? [
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        // The root layout's theme-bootstrap script can't carry this nonce (see
        // THEME_BOOTSTRAP_SCRIPT_SHA256's own comment) — its content hash is an equally valid
        // 'strict-dynamic'-compatible trust anchor under CSP3.
        THEME_BOOTSTRAP_SCRIPT_SHA256,
        ...(isDev ? ["'unsafe-eval'"] : []),
        ...VERCEL_ANALYTICS_SRC,
      ]
    : isDev
      ? ["'self'", "'unsafe-inline'", "'unsafe-eval'", ...VERCEL_ANALYTICS_SRC]
      : ["'self'", "'unsafe-inline'", ...VERCEL_ANALYTICS_SRC];
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
