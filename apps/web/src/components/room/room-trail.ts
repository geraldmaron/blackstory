/**
 * The breadcrumb chain, computed once from the destination registry rather than hand-written
 * per page.
 *
 * Design law: docs/ui/design-direction-v9-surfaces.md §4 — "Atlas / <parent chain> / here, every
 * step a real link". The reason this is resolved from a table and not a prop each room fills in
 * is that a hand-written chain drifts: twenty-one screens each typing their own parent is how the
 * v6 edition system ended up with twenty-one different headers.
 *
 * SP-15 (repo-92n2.15) landed the registry and this module's own copy of the route table went
 * with it — labels and parents now come from `lib/nav/destination-registry.ts`, so the breadcrumb,
 * the library hub, the footer, the palette and the sitemap cannot disagree about where a room
 * sits. SP-21 (repo-92n2.29) shipped `/library`, so the reading and utility rooms whose parent
 * was held at `/` now resolve up through it, matching `SURF_PARENT` in the mock.
 */

import {
  destinationFor,
  normalizeDestinationPath,
  parentPathFor,
} from '../../lib/nav/destination-registry';

/** A single step in the chain. `href` is null only for the final, non-clickable step. */
export type RoomCrumb = {
  readonly label: string;
  readonly href: string | null;
};

/** The label for a route, for callers that need one step rather than the whole chain. */
export function roomLabelFor(pathname: string): string | null {
  return destinationFor(pathname)?.label ?? null;
}

/**
 * The chain for a room, ending at `here`.
 *
 * `hereLabel` is the one thing a room supplies, because a record's title is data and cannot live
 * in a static table. Every earlier step is resolved, so no page ever names its own parent.
 *
 * The Atlas root (`/`) is resolved as a parent but not rendered as a step: it is the site itself,
 * it is already the brand mark and the first item in the nav bar, and a crumb that reads
 * "Atlas /" on all thirteen surfaces carries no information about where the reader is.
 */
export function resolveTrail(pathname: string, hereLabel?: string): readonly RoomCrumb[] {
  const path = normalizeDestinationPath(pathname);
  const here = hereLabel ?? roomLabelFor(path) ?? path;

  const ancestors: string[] = [];
  let cursor = parentPathFor(path);
  // The chain is finite by construction, but a malformed table must not hang a render.
  let guard = 0;
  while (cursor !== null && guard < 16) {
    ancestors.unshift(cursor);
    cursor = parentPathFor(cursor);
    guard += 1;
  }

  const steps: RoomCrumb[] = ancestors
    .filter((ancestor) => ancestor !== '/')
    .map((ancestor) => ({
      label: roomLabelFor(ancestor) ?? ancestor,
      href: ancestor,
    }));

  if (path !== '/') steps.push({ label: here, href: null });
  else if (steps.length === 0) steps.push({ label: here, href: null });

  return steps;
}
