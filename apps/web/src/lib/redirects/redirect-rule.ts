/**
 * The shape of one `next.config.mjs` redirect rule, as the typed side sees it.
 *
 * The table itself is `.mjs` because Node loads `next.config.mjs` directly and cannot import a
 * `.ts` module; this type gives the tests and app code that read it something to check against.
 */
export type RedirectRule = {
  /** Next path pattern, e.g. `/themes/:path*`. */
  readonly source: string;
  readonly destination: string;
  /** Always true here — a permanent rule emits 308 and is what the chain guarantee is about. */
  readonly permanent: boolean;
};
