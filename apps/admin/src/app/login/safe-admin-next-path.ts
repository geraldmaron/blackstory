/**
 * Safe post-login redirect path for the admin portal.
 * Defaults to the operations desk (`/`). Rejects open redirects.
 */
export function safeAdminNextPath(raw: string | null, fallback = '/'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) {
    return fallback;
  }
  return raw;
}
