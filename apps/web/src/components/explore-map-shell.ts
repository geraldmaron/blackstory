/**
 * Path helpers for the dedicated `/explore` map shell (header + canvas, no document footer).
 */

/** True for the dedicated `/explore` map surface (not the homepage hero). */
export function isExploreMapShell(pathname: string): boolean {
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return path === '/explore';
}
