/**
 * Which routes are the Atlas, for the two shell gates that must not disagree about it.
 *
 * The Atlas supplies its own chrome: `components/shell/CommandBar.tsx` replaces the site header
 * rather than adding to it, and the mega footer is omitted so nothing competes with the plate.
 * Rendering both would put two brand lockups and two navigations on one surface and push the
 * plate down by the header's height on the one route where the map is the product.
 *
 * This predicate is transitional. SP-07's shell slice replaces both gates with the server-emitted
 * `data-surface` attribute, at which point the shell stops asking the router what it is rendering.
 */

/** True for the Atlas. `/explore` is not listed: it 308s to `/` and never renders. */
export function isAtlasShell(pathname: string): boolean {
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return path === '/';
}
