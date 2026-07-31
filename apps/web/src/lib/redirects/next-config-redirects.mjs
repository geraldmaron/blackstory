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
    // Legacy publication surfaces all fold into /chapters. Article detail slugs carry over 1:1;
    // the theme, story and topic indexes collapse to the chapters index.
    { source: '/articles/:slug', destination: '/chapters/:slug', permanent: true },
    { source: '/articles', destination: '/chapters', permanent: true },
    { source: '/stories', destination: '/chapters', permanent: true },
    // Site-wide atmosphere-tile attribution keeps its own page (moved under /chapters); this
    // specific rule must precede the /stories/:path* catch-all.
    { source: '/stories/mosaic-credits', destination: '/chapters/mosaic-credits', permanent: true },
    { source: '/stories/:path*', destination: '/chapters', permanent: true },

    { source: '/themes', destination: '/chapters', permanent: true },
    // Generated from THEME_CHAPTER_SLUGS — the same table `theme-impact/source.ts` builds its
    // in-app hrefs from, so a new chapter cannot land with a stale redirect behind it.
    ...buildThemeAliasRedirects(),
    { source: '/themes/:path*', destination: '/chapters', permanent: true },

    { source: '/topics', destination: '/chapters', permanent: true },
    { source: '/topics/:path*', destination: '/chapters', permanent: true },

    // Straight to the record index. Routing /facts through /history instead would be a chain,
    // because /history resolves to /records too.
    { source: '/facts', destination: '/records', permanent: true },
    { source: '/facts/:path*', destination: '/records', permanent: true },

    { source: '/myths', destination: '/methodology', permanent: true },
    { source: '/myths/:path*', destination: '/methodology', permanent: true },

    { source: '/legal', destination: '/law', permanent: true },
    { source: '/legal/:path*', destination: '/law/:path*', permanent: true },

    // A config rule rather than a page-level `redirect()` call: permanent instead of temporary,
    // and one less render. The resolution map's end state for /map is `/`, which is only correct
    // once `/` renders the Atlas; while `/` is the hero, sending a /map bookmark there would
    // hand a map reader a marketing page. The chain test is the forcing function — adding an
    // `/explore` -> `/` rule makes this destination a chain and fails the suite until both move
    // together.
    { source: '/map', destination: '/explore', permanent: true },
  ];
}
