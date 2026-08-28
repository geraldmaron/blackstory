/**
 * The surface class registry: which of the four rendered classes a public route belongs to.
 *
 * Design law: `docs/ui/patterns-surface-classes.md` and `design-direction-v9-surfaces.md` §2.
 * Every public rendered route belongs to exactly one class, and the class is the single switch
 * that shell layout, plate posture, keyboard scope and the footer decision all read. Before this
 * module those decisions were made by roughly 25 `:has()` selectors keyed on marker classes a
 * route happened to set (`.ds-explore-stage`, `.ds-home-hero`), which is a rule that silently
 * stops applying the moment the markup changes.
 *
 * The class is resolved from the pathname here and emitted once, on the page-root wrapper in
 * `components/ShellPageTransition.tsx`, so it is present in the server-rendered HTML on first
 * paint. One emission point with an exhaustive table beats an attribute hand-copied onto two
 * dozen `<main>` elements: a new route that nobody classified fails `surface-classes.test.ts`
 * rather than quietly inheriting whatever the last author typed.
 *
 * Endpoints (redirects, JSON, feeds, crawler files) have no class. They render no chrome, so
 * `surfaceClassFor` returns `null` and nothing is emitted.
 *
 * `/` is the one path whose class depends on the query: bare `/` is reading (featured door);
 * `?atlas=1` or a surviving explore filter is the instrument. See `atlas-door.ts`.
 */
import { wantsAtlasInstrument } from './atlas-door';

/** The four rendered surface classes. Endpoints are represented by `null`. */
export type SurfaceClass = 'instrument' | 'reading' | 'record' | 'utility';

/**
 * Exact-path membership. Checked before {@link SURFACE_CLASS_PREFIXES} so that a specific child
 * (`/stories/mosaic-credits` is Utility) can never be swallowed by its parent's prefix rule.
 */
const SURFACE_CLASS_BY_PATH: ReadonlyMap<string, SurfaceClass> = new Map([
  // Front door. Bare `/` is a reading room (featured place). The Atlas instrument is the same
  // path when the URL asks for it (`?atlas=1` or any surviving explore filter); see
  // `surfaceClassFor` and `atlas-door.ts`. Story is a mode of the Atlas, not a path.
  ['/', 'reading'],

  // Reading room — one scrolling, measure-limited column on paper.
  // `/library` is the hub the rest of this list hangs off: it renders cards, not records, but it
  // is the same measure-limited column on paper, so it is a Reading room and not a fifth class.
  ['/library', 'reading'],
  ['/records', 'reading'],
  ['/stories', 'reading'],
  ['/books', 'reading'],
  ['/law', 'reading'],
  ['/data', 'reading'],
  ['/memorial', 'reading'],
  ['/about', 'reading'],
  ['/methodology', 'reading'],
  ['/errata', 'reading'],

  // Utility — task surfaces, finished and left.
  ['/stories/mosaic-credits', 'utility'],
  ['/corrections', 'utility'],
  ['/submit', 'utility'],
  ['/support', 'utility'],
  ['/privacy', 'utility'],
  ['/design-system', 'utility'],
  ['/locate', 'utility'],
]);

/**
 * Prefix membership for dynamic segments, longest first so `/corrections/status/…` resolves
 * before `/corrections/…` and `/stories/mosaic-credits` never reaches `/stories/`.
 */
const SURFACE_CLASS_PREFIXES: readonly (readonly [string, SurfaceClass])[] = [
  ['/corrections/status/', 'utility'],
  // `/corrections/appeal` and `/corrections/abuse` used to be classified here. Neither renders:
  // both are API-only directories, and the appeal and abuse forms are mounted inside the receipt
  // status page. Classifying them promised chrome for two URLs that 404 (SP-19, repo-92n2.19).
  ['/stories/', 'reading'],
  ['/entity/', 'record'],
  ['/books/', 'record'],
  ['/law/', 'record'],
];

/**
 * Public routes that render no chrome: redirects, JSON and text responses, feeds, crawler files.
 * Listed rather than inferred so the coverage test can assert the resolution map is complete —
 * a route that is neither classified nor declared an endpoint is an omission, not a default.
 */
export const ENDPOINT_ROUTES: readonly string[] = [
  '/facts',
  '/search',
  '/map',
  '/explore',
  '/history',
  '/explore/api',
  '/search/api',
  '/locate/api',
  '/submit/api',
  '/corrections/api',
  '/corrections/abuse/api',
  '/corrections/appeal/api',
  '/corrections/status/api',
  '/api/request-integrity',
  '/errata/feed.json',
  '/errata/feed.xml',
  '/ai.txt',
  '/.well-known/security.txt',
  '/robots.txt',
  '/sitemap.xml',
];

const ENDPOINT_ROUTE_SET = new Set(ENDPOINT_ROUTES);

/** Trailing slashes never change a route's class. Query strings do only for `/` (door vs Atlas). */
function normalizePath(pathname: string): string {
  const withoutQuery = pathname.split('?')[0]?.split('#')[0] ?? '/';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) return withoutQuery.slice(0, -1);
  return withoutQuery || '/';
}

function queryFrom(pathname: string, search?: string): string {
  if (search !== undefined && search.length > 0) {
    return search.startsWith('?') ? search.slice(1) : search;
  }
  const qIndex = pathname.indexOf('?');
  if (qIndex === -1) return '';
  return pathname.slice(qIndex + 1).split('#')[0] ?? '';
}

/**
 * Resolve a pathname to its surface class, or `null` for an endpoint or an unknown path.
 *
 * Unknown paths land on the 404, which is a Utility surface, so they resolve to `utility`
 * rather than to nothing: a reader who mistypes a URL still gets the utility chrome instead
 * of a page with no class and therefore no shell rules.
 *
 * Pass `search` when the caller already split the query (client `useSearchParams`). A pathname
 * that still contains `?…` is also accepted so existing tests and logs keep working.
 */
export function surfaceClassFor(pathname: string, search?: string): SurfaceClass | null {
  const path = normalizePath(pathname);
  if (ENDPOINT_ROUTE_SET.has(path)) return null;

  if (path === '/') {
    return wantsAtlasInstrument(queryFrom(pathname, search)) ? 'instrument' : 'reading';
  }

  const exact = SURFACE_CLASS_BY_PATH.get(path);
  if (exact) return exact;

  for (const [prefix, surface] of SURFACE_CLASS_PREFIXES) {
    if (path.startsWith(prefix)) return surface;
  }

  // `/_not-found` and anything genuinely unrecognised.
  return 'utility';
}

/** Every path with an explicit class, for the coverage test and the registry sweep. */
export const CLASSIFIED_PATHS: readonly string[] = [...SURFACE_CLASS_BY_PATH.keys()];
