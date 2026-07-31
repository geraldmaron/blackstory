/**
 * The breadcrumb chain, computed once from a table rather than hand-written per page.
 *
 * Design law: docs/ui/design-direction-v9-surfaces.md §4 — "Atlas / <parent chain> / here,
 * every step a real link". The reason this is a table and not a prop each room fills in is
 * that a hand-written chain drifts: twenty-one screens each typing their own parent is how
 * the v6 edition system ended up with twenty-one different headers.
 *
 * SEAM: SP-15 (repo-92n2.15) builds the destination registry — labels, groups and the palette
 * Go section over the same set of routes. When it lands, {@link ROOM_DESTINATIONS} is replaced
 * by a read of that registry and this module keeps only `resolveTrail`. Nothing outside this
 * file may add a per-page chain in the meantime.
 *
 * PENDING SP-21: the mock parents every reading and utility room to /library, not to the Atlas
 * (`SURF_PARENT` defaults to library). /library does not exist as a route yet, and a breadcrumb
 * whose second step 404s is worse than one step short, so those rooms hang off the Atlas until
 * SP-21 either ships the route or records the decision not to. The switch is one line: change
 * the `parent` of each reading and utility entry below from '/' to '/library'. Record pages are
 * already correct — their parent is their catalogue, and an entity's is the Atlas.
 */

/** A single step in the chain. `href` is null only for the final, non-clickable step. */
export type RoomCrumb = {
  readonly label: string;
  readonly href: string | null;
};

type Destination = {
  /** The label shown in the chain and, once SP-15 lands, in the palette Go section. */
  readonly label: string;
  /** The parent path, or null for the Atlas itself. */
  readonly parent: string | null;
};

/**
 * Every rendered public room and its parent. Dynamic segments are keyed by their prefix in
 * {@link DYNAMIC_PARENTS}; everything else is exact.
 */
const ROOM_DESTINATIONS: ReadonlyMap<string, Destination> = new Map([
  ['/', { label: 'Atlas', parent: null }],
  ['/story', { label: 'Story', parent: '/' }],

  // Reading rooms.
  ['/records', { label: 'Records', parent: '/' }],
  ['/chapters', { label: 'Chapters', parent: '/' }],
  ['/books', { label: 'Books', parent: '/' }],
  ['/law', { label: 'Law', parent: '/' }],
  ['/data', { label: 'Data', parent: '/' }],
  ['/memorial', { label: 'Memorial', parent: '/' }],
  ['/about', { label: 'About', parent: '/' }],
  ['/methodology', { label: 'Methodology', parent: '/' }],
  ['/errata', { label: 'Errata', parent: '/' }],

  // Utility rooms.
  ['/chapters/mosaic-credits', { label: 'Mosaic credits', parent: '/chapters' }],
  ['/corrections', { label: 'Corrections', parent: '/' }],
  ['/corrections/appeal', { label: 'Appeal', parent: '/corrections' }],
  ['/corrections/abuse', { label: 'Report abuse', parent: '/corrections' }],
  ['/submit', { label: 'Submit', parent: '/' }],
  ['/support', { label: 'Support', parent: '/' }],
  ['/privacy', { label: 'Privacy', parent: '/' }],
  ['/design-system', { label: 'Design system', parent: '/' }],
  ['/locate', { label: 'Locate', parent: '/' }],
]);

/**
 * Prefixes for dynamic segments, longest first. A record's parent is its catalogue, which is
 * what makes "every record links back to its place and every place back to its records" hold
 * without any record page knowing where it sits.
 *
 * `/entity/` is the exception, and it goes up to the Atlas rather than to /records. An entity
 * is a point on the map that a reader most likely arrived at *from* the map; /records is one
 * way of listing entities, not the place they live. This matches `SURF_PARENT` in the mock
 * (`entity: 'atlas'`) and the parent chain SP-21 specifies.
 */
const DYNAMIC_PARENTS: readonly (readonly [string, string])[] = [
  ['/corrections/status/', '/corrections'],
  ['/chapters/', '/chapters'],
  ['/entity/', '/'],
  ['/books/', '/books'],
  ['/law/', '/law'],
];

function normalizePath(pathname: string): string {
  const withoutQuery = pathname.split('?')[0]?.split('#')[0] ?? '/';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) return withoutQuery.slice(0, -1);
  return withoutQuery || '/';
}

/** The parent path for any route, dynamic or not. `/` has none. */
function parentOf(path: string): string | null {
  const known = ROOM_DESTINATIONS.get(path);
  if (known) return known.parent;

  for (const [prefix, parent] of DYNAMIC_PARENTS) {
    if (path.startsWith(prefix)) return parent;
  }

  // An unrecognised path is still somewhere: it hangs off the Atlas rather than off nothing.
  return path === '/' ? null : '/';
}

/** The label for a route, for callers that need one step rather than the whole chain. */
export function roomLabelFor(pathname: string): string | null {
  return ROOM_DESTINATIONS.get(normalizePath(pathname))?.label ?? null;
}

/**
 * The full chain for a room, Atlas first and `here` last.
 *
 * `hereLabel` is the one thing a room supplies, because a record's title is data and cannot
 * live in a static table. Every earlier step is resolved, so no page ever names its own parent.
 */
export function resolveTrail(pathname: string, hereLabel?: string): readonly RoomCrumb[] {
  const path = normalizePath(pathname);
  const here = hereLabel ?? roomLabelFor(path) ?? path;

  const ancestors: string[] = [];
  let cursor = parentOf(path);
  // The chain is finite by construction, but a malformed table must not hang a render.
  let guard = 0;
  while (cursor !== null && guard < 16) {
    ancestors.unshift(cursor);
    cursor = parentOf(cursor);
    guard += 1;
  }

  const steps: RoomCrumb[] = ancestors.map((ancestor) => ({
    label: roomLabelFor(ancestor) ?? ancestor,
    href: ancestor,
  }));

  if (path !== '/') steps.push({ label: here, href: null });
  else if (steps.length === 0) steps.push({ label: here, href: null });

  return steps;
}
