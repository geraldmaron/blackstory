/**
 * The site's permanent redirect table, kept out of `next.config.mjs` so it can be imported and
 * asserted as data rather than regexed as config source text.
 *
 * Every rule is `permanent: true`, which Next emits as a 308, so a chain costs a reader two
 * round trips and splits a crawler's link equity across both hops. `redirect-table.test.ts`
 * fails when any rule's destination is itself the source of another rule.
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

import { buildThemeAliasRedirects } from './theme-alias-table.mjs';

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
    { source: '/facts', destination: '/records', permanent: true },
    { source: '/facts/:path*', destination: '/records', permanent: true },

    // A myth correction is a narrative evidence format — the claim, why it is repeated, what
    // the record actually shows — so its home is Stories. It used to land on Methodology, which
    // answers a different question: Methodology is how the archive knows, and a myth correction
    // is whether a historical claim is true. A reader who bookmarked `/myths` wanted the second.
    { source: '/myths', destination: '/stories', permanent: true },
    { source: '/myths/:path*', destination: '/stories', permanent: true },

    { source: '/legal', destination: '/law', permanent: true },
    { source: '/legal/:path*', destination: '/law/:path*', permanent: true },

    // `/map` is the old name for Explore. `/` is the map door; `/explore` still renders it.
    { source: '/map', destination: '/explore', permanent: true },

    // `/library` is the old name for Rooms.
    { source: '/library', destination: '/rooms', permanent: true },

    // The inventions index is the Records kind filter, not a second catalog.
    { source: '/inventions', destination: '/records?kind=inventions', permanent: true },

    // repo-ytq3n: the disc_ and gap_ lanes each produced their own live Tulsa Race Massacre
    // record, so the collision suffix in `place-slug.ts` gave the loser its own public address
    // rather than 404ing outright. The 2026-09-12 owner ruling merged it into
    // disc_tulsa_race_massacre_q1824714 and unpublished it, which turns that address into a 404.
    //
    // ONLY the /place form is here. The /entity form is already handled, and better, by
    // bb_public.release_entity_redirects (repo-n7p6.29): /entity/[id] resolves merged ids
    // through the release, so every future merge redirects with no code change. The slug route
    // cannot use that table today because it resolves by slug rather than entity id, and
    // teaching it to is work that belongs with the /place retirement (repo-giah), not a second
    // redirect mechanism bolted on beside the first.
    {
      source: '/place/tulsa-race-massacre--gap_tulsa_race_massacre',
      destination: '/place/tulsa-race-massacre',
      permanent: true,
    },
  ];
}
