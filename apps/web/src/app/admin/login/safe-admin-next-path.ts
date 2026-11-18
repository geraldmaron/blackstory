/**
 * Safe post-login redirect path for the admin portal.
 * Defaults to the operations desk (`/`). Rejects open redirects.
 */
export function safeAdminNextPath(raw: string | null, fallback = '/admin'): string {
  // `/admin/login` is refused too: landing back here while signed in never leaves the page.
  if (!raw || !/^\/admin(?!\/login(?:[/?#]|$))(?:[/?#]|$)/.test(raw) || raw.includes('://')) {
    return fallback;
  }
  return raw;
}
