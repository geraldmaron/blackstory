/**
 * The semantic destination catalog: every public BlackStory destination, once, as product
 * meaning rather than platform layout.
 *
 * WHY THIS IS A CONTRACT. A destination's canonical path is an external commitment. It is the
 * URL a reader bookmarks, the URL a crawler indexes, the deep link a native build registers with
 * the OS, and the link the admin console hands an operator. Those four consumers used to hold
 * four private opinions about the same route, and they disagreed: the shared shell config went on
 * emitting `/chapters` and `/library` months after both became permanent redirects, so the top
 * nav of every page on the site pointed into a 308. One table with one canonical path per
 * destination is what makes that class of drift a test failure instead of a habit.
 *
 * WHAT LIVES HERE. Product semantics only: the stable id, the canonical label, the canonical web
 * path, the legacy aliases that must keep resolving, the semantic family, the semantic icon id,
 * whether the destination is public, and whether it participates in browse and search.
 *
 * WHAT DOES NOT LIVE HERE. Anything a platform decides for itself: menu position, tab order,
 * desktop versus phone presentation, React or React Native components, Expo Router or Next.js
 * route files, CSS classes, card copy, crawl priorities. Web composes primary nav, Rooms, the
 * footer, breadcrumbs, the palette and the sitemap from this table; native composes tabs, More
 * and deep-link normalization from it; admin composes public links from it. A field that only
 * one platform can act on is that platform's business, not this table's.
 *
 * ICON IDS are semantic, never glyph names. `records` is the id; whether that renders as an
 * Ionicon, an SF Symbol or an inline SVG is the platform's choice. See `DestinationIconId`.
 */

/**
 * The four product axes plus the door, in the order a reader meets them.
 *
 * These are distinct jobs, not a route-count optimization:
 * - `door` — what BlackStory is, and why to enter the archive.
 * - `explore` — what happened where, traversed spatially.
 * - `stories` — evidence-supported historical narrative.
 * - `records` — the archive as a findable catalog, no geography required.
 * - `rooms` — the other kinds of knowledge, the trust surfaces, and how to take part.
 */
export const PRODUCT_AXES = ['door', 'explore', 'stories', 'records', 'rooms'] as const;
export type ProductAxis = (typeof PRODUCT_AXES)[number];

/**
 * What sort of destination this is. Families group Rooms and native More; they are the reader's
 * question, not the CMS's taxonomy.
 *
 * - `axis` — a top-level product axis (the five above).
 * - `read` — another way to read the archive: law, data, books, the memorial wall.
 * - `trust` — how the archive decides, and what it got wrong.
 * - `participate` — how a reader adds to it or corrects it.
 * - `policy` — BlackStory's own product policy. Never historical Law; see `/law` versus
 *   `/privacy` in `LEGACY_ALIASES`, and the note on `legal` there.
 * - `record` — a detail surface for one archival record.
 * - `utility` — a task or reference surface that is a real destination but not somewhere a
 *   reader is sent browsing.
 */
export const DESTINATION_FAMILIES = [
  'axis',
  'read',
  'trust',
  'participate',
  'policy',
  'record',
  'utility',
] as const;
export type DestinationFamily = (typeof DESTINATION_FAMILIES)[number];

/**
 * The semantic icon vocabulary (one meaning per id, chosen once).
 *
 * Platforms map these to actual glyphs. Nothing outside a platform's icon adapter may name an
 * Ionicon, an SF Symbol or a Font Awesome glyph — that is how two surfaces end up drawing
 * different pictures for the same idea.
 */
export const DESTINATION_ICON_IDS = [
  // wayfinding
  'home',
  'explore',
  'stories',
  'records',
  'rooms',
  'more',
  'search',
  'filter',
  'locate',
  'external',
  'disclosure',
  'collection',
  // evidence
  'evidence',
  'source',
  'precision',
  'correction',
  'time',
  // entity kinds
  'person',
  'place',
  'school',
  'institution',
  'organization',
  'event',
  'law',
  'case',
  'movement',
  'publication',
  'artifact',
  // rooms
  'data',
  'books',
  'memorial',
  'about',
  'questions',
  'methodology',
  'errata',
  'submit',
  'support',
  'privacy',
  'terms',
  'design',
] as const;
export type DestinationIconId = (typeof DESTINATION_ICON_IDS)[number];

export type SemanticDestination = {
  /** Stable across renames and route moves. Platforms key their adapters on this, not on path. */
  readonly id: string;
  /** The canonical public label. Short: it appears mid-sentence in a breadcrumb chain. */
  readonly label: string;
  /** The one canonical web path. Product code generates this and never an alias. */
  readonly path: string;
  /** The canonical parent for breadcrumb chains. `null` only for the door. */
  readonly parent: string | null;
  readonly family: DestinationFamily;
  /** Present exactly when {@link SemanticDestination.family} is `axis`. */
  readonly axis?: ProductAxis;
  readonly icon: DestinationIconId;
  /** False for surfaces that render but are deliberately not advertised to readers. */
  readonly isPublic: boolean;
  /** Whether a reader browsing or searching the site should be offered this destination. */
  readonly browsable: boolean;
  /**
   * One line, shared across platforms. Two lines is a summary, and a card is not a summary.
   * Absent when the platforms genuinely say different things (a phone row and a desktop card
   * have different room), in which case each platform owns its own copy.
   */
  readonly description?: string;
};

/**
 * Every public destination, in product order: the axes first, then the rooms by family.
 *
 * PARENTS ENCODE THE PRODUCT, NOT THE OLD MENU. Stories and Records are top-level axes, so they
 * parent to the door and not to Rooms — modeling them as Rooms children was the old Library
 * hierarchy surviving inside a renamed surface, and it told a reader that the archive index was
 * a supporting page.
 */
const DESTINATIONS: readonly SemanticDestination[] = [
  /* ---------- the axes ---------- */
  {
    id: 'home',
    label: 'Home',
    path: '/',
    parent: null,
    family: 'axis',
    axis: 'door',
    icon: 'home',
    isPublic: true,
    browsable: false,
  },
  {
    id: 'explore',
    label: 'Explore',
    path: '/explore',
    parent: '/',
    family: 'axis',
    axis: 'explore',
    icon: 'explore',
    isPublic: true,
    browsable: true,
    description: 'The map.',
  },
  {
    id: 'stories',
    label: 'Stories',
    path: '/stories',
    parent: '/',
    family: 'axis',
    axis: 'stories',
    icon: 'stories',
    isPublic: true,
    browsable: true,
    description:
      'The archive argued rather than listed. Sourced narrative that names the records it rests on.',
  },
  {
    id: 'records',
    label: 'Records',
    path: '/records',
    parent: '/',
    family: 'axis',
    axis: 'records',
    icon: 'records',
    isPublic: true,
    browsable: true,
    description: 'The archive as a list.',
  },
  {
    id: 'rooms',
    label: 'Rooms',
    path: '/rooms',
    parent: '/',
    family: 'axis',
    axis: 'rooms',
    icon: 'rooms',
    isPublic: true,
    browsable: true,
    description: 'The rooms.',
  },

  /* ---------- read deeper ---------- */
  {
    id: 'law',
    label: 'Law',
    path: '/law',
    parent: '/rooms',
    family: 'read',
    icon: 'law',
    isPublic: true,
    browsable: true,
    description:
      'The statutes and rulings that shaped what could be built, owned, attended and voted for.',
  },
  {
    id: 'data',
    label: 'Data',
    path: '/data',
    parent: '/rooms',
    family: 'read',
    icon: 'data',
    isPublic: true,
    browsable: true,
    description:
      'National series with their sources attached, and a plain account of what each one cannot tell you.',
  },
  {
    id: 'books',
    label: 'Banned books',
    path: '/books',
    parent: '/rooms',
    family: 'read',
    icon: 'books',
    isPublic: true,
    browsable: true,
    description: 'Documented challenges to titles, recorded as challenges rather than as verdicts.',
  },
  {
    id: 'memorial',
    label: 'Memorial',
    path: '/memorial',
    parent: '/rooms',
    family: 'read',
    icon: 'memorial',
    isPublic: true,
    browsable: true,
    description: 'Names, held quietly. No imagery of harm, no counts presented as a score.',
  },

  /* ---------- understand / trust ---------- */
  {
    id: 'about',
    label: 'About',
    path: '/about',
    parent: '/rooms',
    family: 'trust',
    icon: 'about',
    isPublic: true,
    browsable: true,
    description: 'What this is for, who it is for, and what it refuses to do.',
  },
  {
    id: 'faq',
    label: 'Questions',
    path: '/faq',
    parent: '/rooms',
    family: 'trust',
    icon: 'questions',
    isPublic: true,
    browsable: true,
    description:
      'Who runs this, how AI is and is not used, what a grade means, and what to do when a record is wrong.',
  },
  {
    id: 'methodology',
    label: 'Methodology',
    path: '/methodology',
    parent: '/rooms',
    family: 'trust',
    icon: 'methodology',
    isPublic: true,
    browsable: true,
    description:
      'How a record gets in, what the evidence grades mean, and why a point is never drawn sharper than its source.',
  },
  {
    id: 'errata',
    label: 'Errata',
    path: '/errata',
    parent: '/rooms',
    family: 'trust',
    icon: 'errata',
    isPublic: true,
    browsable: true,
    description:
      'The mistakes the archive found and fixed, published rather than quietly overwritten.',
  },

  /* ---------- take part ---------- */
  {
    id: 'submit',
    label: 'Submit',
    path: '/submit',
    parent: '/rooms',
    family: 'participate',
    icon: 'submit',
    isPublic: true,
    browsable: true,
    description:
      'Point the archive at something it has missed. Leads are reviewed, not published on arrival.',
  },
  {
    id: 'corrections',
    label: 'Corrections',
    path: '/corrections',
    parent: '/rooms',
    family: 'participate',
    icon: 'correction',
    isPublic: true,
    browsable: true,
    description: 'Tell the archive it is wrong. You get a receipt code and a tracked outcome.',
  },
  {
    id: 'support',
    label: 'Support',
    path: '/support',
    parent: '/rooms',
    family: 'participate',
    icon: 'support',
    isPublic: true,
    browsable: true,
    description: 'How to get an answer, and how long it should take.',
  },

  /* ---------- product policy ----------
   * Policy is not Law. `/law` is historical statute and ruling; `/privacy` is what BlackStory
   * does with a reader's data. They are different domains with different readers, and the old
   * `/legal` name — which meant policy — is why a policy link could land in historical Law.
   */
  {
    id: 'privacy',
    label: 'Privacy',
    path: '/privacy',
    parent: '/rooms',
    family: 'policy',
    icon: 'privacy',
    isPublic: true,
    browsable: false,
    description: 'What this archive collects, what it does not, and how to ask.',
  },

  /* ---------- real destinations, not somewhere a reader is sent browsing ---------- */
  {
    id: 'locate',
    label: 'Locate',
    path: '/locate',
    parent: '/rooms',
    family: 'utility',
    icon: 'locate',
    isPublic: true,
    browsable: false,
  },
  {
    id: 'mosaic-credits',
    label: 'Mosaic credits',
    path: '/stories/mosaic-credits',
    parent: '/stories',
    family: 'utility',
    icon: 'source',
    isPublic: true,
    browsable: false,
  },
  {
    id: 'design-system',
    label: 'Design system',
    path: '/design-system',
    parent: '/rooms',
    family: 'utility',
    icon: 'design',
    isPublic: false,
    browsable: false,
  },
];

/**
 * Legacy public addresses that must keep resolving, mapped to the destination that now owns
 * their meaning.
 *
 * EXTERNAL ONLY. A reader's bookmark, an inbound link and a published deep link are external
 * contracts; internal product code generates canonical paths and nothing else. Platforms turn
 * this table into their own redirect mechanism — Next config rules on web, deep-link
 * normalization on native — so an alias cannot be honored on one platform and dead on the other.
 *
 * Each entry records what the old address actually meant, because "there is already a redirect"
 * is not evidence the redirect is still correct. `/myths` is the worked example: it pointed at
 * `/methodology`, which answers "how does BlackStory know?" A myth correction answers "is this
 * historical claim true?" — a different reader intent, and a Story.
 */
export const LEGACY_ALIASES: readonly {
  readonly from: string;
  readonly to: string;
  /** Why the old address meant this destination. Never omit: an unexplained alias cannot be audited. */
  readonly because: string;
  /** True when the alias also covers child paths (`/chapters/:slug`). */
  readonly subtree: boolean;
}[] = [
  {
    from: '/chapters',
    to: '/stories',
    because: 'A chapter is one editorial kind of Story, not its own surface. Slugs carry over 1:1.',
    subtree: true,
  },
  {
    from: '/articles',
    to: '/stories',
    because: 'The short editorial kind, published as Entries under the one Stories index.',
    subtree: true,
  },
  {
    from: '/topics',
    to: '/stories',
    because: 'A topic is a Story browse facet, not a parallel content tree.',
    subtree: true,
  },
  {
    from: '/themes',
    to: '/stories',
    because: 'A theme is a Story tag and collection, not a parallel content tree.',
    subtree: true,
  },
  {
    from: '/myths',
    to: '/stories',
    because:
      'A myth correction is a narrative evidence format — claim, why it is repeated, what the record shows — so it is a Story. It is NOT Methodology: that answers how the archive knows, not whether a historical claim is true.',
    subtree: true,
  },
  {
    from: '/facts',
    to: '/records',
    because: 'Quick facts duplicated the record index rather than being a second archive.',
    subtree: true,
  },
  {
    from: '/library',
    to: '/rooms',
    because: 'Library was the old name for the Rooms hub.',
    subtree: false,
  },
  {
    from: '/map',
    to: '/explore',
    because: 'Map was the old name for the Explore instrument.',
    subtree: false,
  },
  {
    from: '/history',
    to: '/records',
    because:
      'History was find-in-time — a search over the archive, which is what Records is. Chronology survives as an era facet, not as a destination. Value transform: `decade` becomes `era`.',
    subtree: false,
  },
  {
    from: '/search',
    to: '/records',
    because:
      'Search is a capability of the archive, not a parallel ontology. Value transform: `q` must survive.',
    subtree: false,
  },
  {
    from: '/legal',
    to: '/law',
    because:
      'The old `/legal` tree was historical legal reference, which is Law. Product policy was never under it; `/privacy` has always been its own address and must never be routed here.',
    subtree: true,
  },
];

const BY_PATH: ReadonlyMap<string, SemanticDestination> = new Map(
  DESTINATIONS.map((destination) => [destination.path, destination]),
);
const BY_ID: ReadonlyMap<string, SemanticDestination> = new Map(
  DESTINATIONS.map((destination) => [destination.id, destination]),
);

/** Every semantic destination, in product order. */
export function allSemanticDestinations(): readonly SemanticDestination[] {
  return DESTINATIONS;
}

export function semanticDestinationById(id: string): SemanticDestination | undefined {
  return BY_ID.get(id);
}

export function semanticDestinationByPath(path: string): SemanticDestination | undefined {
  return BY_PATH.get(normalizeDestinationPath(path));
}

/** The destinations in one family, in product order. */
export function semanticDestinationsInFamily(
  family: DestinationFamily,
): readonly SemanticDestination[] {
  return DESTINATIONS.filter((destination) => destination.family === family);
}

/**
 * The four product axes a platform builds primary navigation from, in order.
 *
 * The door is deliberately absent: it is reached through the brand lockup, not through a nav
 * item, on every platform. Adding a fifth primary destination because a desktop viewport has
 * room is how the last generation of this menu grew an About tab.
 */
export function primaryAxes(): readonly SemanticDestination[] {
  return (['explore', 'stories', 'records', 'rooms'] as const).map((axis) => {
    const found = DESTINATIONS.find((destination) => destination.axis === axis);
    /* istanbul ignore next -- the table above is exhaustive; this is a load-bearing assert. */
    if (!found) throw new Error(`primaryAxes: no destination for axis "${axis}"`);
    return found;
  });
}

/** Trailing slashes and query strings never change a destination's identity. */
export function normalizeDestinationPath(pathname: string): string {
  const withoutQuery = pathname.split('?')[0]?.split('#')[0] ?? '/';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) return withoutQuery.slice(0, -1);
  return withoutQuery || '/';
}

/**
 * The canonical destination for a possibly-legacy path, or `null` when the path is not an alias.
 *
 * Query values are the caller's problem: `/history?decade=1960` and `/search?q=tulsa` both carry
 * state a config-level redirect cannot read, which is why those two aliases are annotated with
 * their value transforms above and are implemented as routes rather than as rules.
 */
export function canonicalPathForLegacy(pathname: string): string | null {
  const path = normalizeDestinationPath(pathname);
  for (const alias of LEGACY_ALIASES) {
    if (path === alias.from) return alias.to;
    if (alias.subtree && path.startsWith(`${alias.from}/`)) return alias.to;
  }
  return null;
}

/** True when a path is a legacy alias rather than a canonical destination. */
export function isLegacyPath(pathname: string): boolean {
  return canonicalPathForLegacy(pathname) !== null;
}
