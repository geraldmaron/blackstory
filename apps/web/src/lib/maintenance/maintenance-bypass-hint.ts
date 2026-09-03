/**
 * Client-readable marker that a maintenance bypass is in effect.
 *
 * The bypass credential itself is HttpOnly and stays that way — it is a shared team secret and
 * script must never be able to read it. But one fetch on the public site deliberately sends no
 * credentials at all: `AtlasLoader` requests `/atlas/catalog` with `credentials: 'omit'`, because
 * that route is CDN-cached public data with no reason to see a cookie. Behind the wall that fetch
 * arrives anonymous, gets a 503, and the operator who just bypassed the wall lands on a homepage
 * whose map cannot load — the bypass restores the page and not the thing on it.
 *
 * This non-secret companion cookie closes that gap without touching the cached path in normal
 * operation. It carries no credential, only the fact that one exists; script reads it and, on that
 * one fetch, opts back into sending same-origin credentials so the real HttpOnly cookie rides
 * along. With the wall down the cookie does not exist, the check is false, and the request is
 * byte-for-byte what it was before.
 *
 * No `next/server` import here on purpose: this module is reachable from a client component.
 */

/** Non-secret companion to `MAINTENANCE_BYPASS_COOKIE`. Value is a constant, never the token. */
export const MAINTENANCE_BYPASS_HINT_COOKIE = 'bs_maint_bypass_hint' as const;

export const MAINTENANCE_BYPASS_HINT_VALUE = '1' as const;

/** True when this browser holds a maintenance bypass. Safe to call during SSR (returns false). */
export function hasMaintenanceBypassHint(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return (
    readCookieValue(document.cookie, MAINTENANCE_BYPASS_HINT_COOKIE) ===
    MAINTENANCE_BYPASS_HINT_VALUE
  );
}

/** Read one cookie out of a `document.cookie` string. Exported for tests. */
export function readCookieValue(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return null;
}
