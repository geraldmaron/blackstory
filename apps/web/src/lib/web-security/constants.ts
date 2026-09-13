/**
 * Shared security constants for the public web surface.
 */

/** Incoming request size limits (UTF-8 bytes unless noted).  */
export const REQUEST_SIZE_LIMITS = {
  /** JSON/form POST bodies (e.g. corrections).  */
  jsonBody: 64 * 1024,
  /** Plain-text bodies.  */
  textBody: 64 * 1024,
  /** Sum of header bytes (approximate via Content-Length on body only at edge).  */
  contentLengthHeader: 64 * 1024,
} as const;

export type RequestSizeKind = keyof typeof REQUEST_SIZE_LIMITS;

/** CSRF cookie and header names for double-submit validation.  */
export const CSRF_COOKIE_NAME = '__Host-csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';
export const CSRF_FORM_FIELD = '_csrf';

/**
 * Request header `proxy.ts` sets on every request, carrying the per-request CSP nonce.
 * Server Components read it back with `headers()` (`next/headers`) and pass it to any manual
 * `<script>` tag that needs to satisfy `script-src 'nonce-...' 'strict-dynamic'`. Next's own
 * RSC flight/hydration scripts pick the nonce up automatically once it is present on both the
 * request header and the `Content-Security-Policy` response header.
 */
export const CSP_NONCE_HEADER = 'x-nonce';

/** Same-origin relative paths only for post-login post-form redirects.  */
export const SAFE_REDIRECT_PREFIX = '/';

/** Allowed HTML tags when sanitizing rich text (no scripts, forms, or media).  */
export const RICH_TEXT_ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'ul',
  'ol',
  'li',
  'code',
  'pre',
  'blockquote',
  'a',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

/** Allowed attributes per tag (href/src restricted separately).  */
export const RICH_TEXT_ALLOWED_ATTRS: Readonly<Record<string, ReadonlySet<string>>> = {
  a: new Set(['href', 'title', 'rel']),
  '*': new Set([]),
};

/** URI schemes permitted in sanitized href/src values.  */
export const RICH_TEXT_ALLOWED_URI_SCHEMES = new Set(['http', 'https', 'mailto']);
