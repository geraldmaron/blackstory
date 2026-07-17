/**
 * Content-Security-Policy builder for the public web surface (BB-028).
 * Strict defaults; Next.js may require style-src 'unsafe-inline' until nonce rollout.
 */

export type CspBuildOptions = {
  /** When true, allow inline styles required by Next.js hydration (default). */
  allowInlineStyles?: boolean;
  /** When true, emit Trusted Types directives (report-only recommended first). */
  enforceTrustedTypes?: boolean;
  /** Extra host sources for img/connect (e.g. CDN). */
  imgSrc?: string[];
  connectSrc?: string[];
};

const DEFAULT_IMG_SRC = ["'self'", 'data:'];
const DEFAULT_CONNECT_SRC = ["'self'"];

/** Build a semicolon-delimited CSP header value. */
export function buildContentSecurityPolicy(options: CspBuildOptions = {}): string {
  const {
    allowInlineStyles = true,
    enforceTrustedTypes = false,
    imgSrc = DEFAULT_IMG_SRC,
    connectSrc = DEFAULT_CONNECT_SRC,
  } = options;

  const styleSrc = allowInlineStyles ? ["'self'", "'unsafe-inline'"] : ["'self'"];

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'script-src': ["'self'"],
    'style-src': styleSrc,
    'img-src': imgSrc,
    'font-src': ["'self'"],
    'connect-src': connectSrc,
    'manifest-src': ["'self'"],
    'worker-src': ["'self'"],
    'upgrade-insecure-requests': [],
  };

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
