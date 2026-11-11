/**
 * The studio shows a story's server-rendered preview in a same-origin iframe. Everything else
 * keeps the site-wide posture (frame-ancestors 'none', X-Frame-Options DENY, frame-src limited
 * to story video hosts). Two narrow exceptions, both admin-only:
 *
 * - admin pages may frame same-origin documents (`frame-src 'self'`), and
 * - `/admin/stories/<slug>/preview/embed` may be framed by its own origin.
 *
 * Applied in proxy.ts after the global headers. The public edge copy never serves /admin.
 */
const EMBEDDED_PREVIEW = /^\/admin\/stories\/[^/]+\/preview\/embed$/;

export function adminFramingHeaders(
  pathname: string,
  csp: string,
): { csp: string; frameOptions?: string } | null {
  if (pathname !== '/admin' && !pathname.startsWith('/admin/')) return null;
  let next = csp.replace(/frame-src ([^;]*)/, (_, hosts: string) =>
    hosts.split(' ').includes("'self'") ? `frame-src ${hosts}` : `frame-src 'self' ${hosts}`,
  );
  if (EMBEDDED_PREVIEW.test(pathname)) {
    next = next.replace("frame-ancestors 'none'", "frame-ancestors 'self'");
    return { csp: next, frameOptions: 'SAMEORIGIN' };
  }
  return { csp: next };
}
