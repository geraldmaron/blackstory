/**
 * The site's permanent redirect table, kept out of `next.config.mjs` so it can be imported and
 * asserted as data rather than regexed as config source text.
 *
 * Every rule is `permanent: true`, which Next emits as a 308, except the phase 4b rules onto
 * `/archive`, which are temporary until the owner makes them permanent (`archiveRule`, and the
 * two old names of the collections hub). A chain costs a reader two round trips and splits a
 * crawler's link equity across both hops. `redirect-table.test.ts` fails when any rule's
 * destination is itself the source of another rule.
 *
 * ORDER IS SEMANTIC. Next matches top to bottom, so every specific rule must precede the
 * catch-all for its family (`/stories/mosaic-credits` before `/stories/:path*`, the generated
 * theme aliases before `/themes/:path*`).
 *
 * NOT HERE, deliberately:
 * - `/search` has no rule, so the filesystem route runs and maps its params onto `/records` in
 *   one hop. A config rule cannot read a query value, and `q` has to survive.
 * - `/history` has no rule for the same reason: it maps `decade` to `era`, which is a value
 *   transform. A config rule would match first and leave no later hook, so the route stays.
 */

import { ARCHIVE_REDIRECTS_ENABLED } from './archive-redirects.mjs';
import { buildThemeAliasRedirects } from './theme-alias-table.mjs';

/**
 * A retired address that used to 308 onto `/records` or `/explore`. While the phase 4b switch is
 * on it goes straight to its `/archive` address, TEMPORARILY (307), so it is still one hop; with
 * the switch off it is the permanent rule it was.
 */
function archiveRule(source, archive, before) {
  return ARCHIVE_REDIRECTS_ENABLED
    ? { source, destination: archive, permanent: false }
    : { source, destination: before, permanent: true };
}

/**
 * @returns {ReadonlyArray<{ source: string, destination: string, permanent: boolean }>}
 */
export function redirectsForNextConfig() {
  return [
    // Every legacy publication surface folds into /stories, the single long-form index.
    // A chapter is now one kind of story rather than its own surface, so /chapters
    // redirects here too; detail slugs carry over 1:1 because the slug namespace is shared.
    { source: '/chapters/mosaic-credits', destination: '/stories/mosaic-credits', permanent: true },
    { source: '/chapters/:slug', destination: '/stories/:slug', permanent: true },
    { source: '/chapters', destination: '/stories', permanent: true },
    { source: '/articles/:slug', destination: '/stories/:slug', permanent: true },
    { source: '/articles', destination: '/stories', permanent: true },

    { source: '/themes', destination: '/stories', permanent: true },
    // Generated from THEME_CHAPTER_SLUGS — the same table `theme-impact/source.ts` builds its
    // in-app hrefs from, so a new chapter cannot land with a stale redirect behind it.
    ...buildThemeAliasRedirects(),
    { source: '/themes/:path*', destination: '/stories', permanent: true },

    { source: '/topics', destination: '/stories', permanent: true },
    { source: '/topics/:path*', destination: '/stories', permanent: true },

    // Straight to the record index. Routing /facts through /history instead would be a chain,
    // because /history resolves to /records too.
    archiveRule('/facts', '/archive', '/records'),
    archiveRule('/facts/:path*', '/archive', '/records'),

    // A myth correction is a narrative evidence format — the claim, why it is repeated, what
    // the record actually shows — so its home is Stories. It used to land on Methodology, which
    // answers a different question: Methodology is how the archive knows, and a myth correction
    // is whether a historical claim is true. A reader who bookmarked `/myths` wanted the second.
    { source: '/myths', destination: '/stories', permanent: true },
    { source: '/myths/:path*', destination: '/stories', permanent: true },

    { source: '/legal', destination: '/law', permanent: true },
    { source: '/legal/:path*', destination: '/law/:path*', permanent: true },

    // `/map` is the front page. `/explore` has no rule here and must never get a permanent one:
    // Chrome caches RSC navigations (`/explore?_rsc=…`), and a prior permanent fold left the map
    // unreachable (redirect-table.test.ts). Its temporary move to `/archive?view=map` is in the
    // proxy (`archive-routing.ts`), which can rewrite its query.
    { source: '/map', destination: '/', permanent: true },

    // The retired locate page opens the map's place finder. The locate API is separate and is
    // unaffected by this page redirect.
    archiveRule('/locate', '/archive?view=map&find=place', '/explore?find=place'),

    // `/library` and `/rooms` are old names for the collections hub, which is now the Archive's
    // lens chips. Temporary like every other rule onto `/archive`.
    { source: '/library', destination: '/archive', permanent: false },
    { source: '/rooms', destination: '/archive', permanent: false },

    // Retired hub escape hatches. Query strings are preserved by Next when the destination
    // omits its own query, so `/law/browse?q=voting` lands on `/law?q=voting`.
    { source: '/law/browse', destination: '/law', permanent: true },
    { source: '/books/browse', destination: '/books', permanent: true },

    // The inventions index is the Archive's kind filter, not a second catalog.
    archiveRule('/inventions', '/archive?kind=inventions', '/records?kind=inventions'),

    // Preserve the absorbed Tulsa record's published place URL. Entity-id redirects use
    // published.release_entity_redirects; this slug-specific redirect serves the older place
    // URL.
    {
      source: '/place/tulsa-race-massacre--gap_tulsa_race_massacre',
      destination: '/place/tulsa-race-massacre',
      permanent: true,
    },
  ];
}
