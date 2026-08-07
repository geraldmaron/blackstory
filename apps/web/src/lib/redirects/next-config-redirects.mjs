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

    { source: '/myths', destination: '/methodology', permanent: true },
    { source: '/myths/:path*', destination: '/methodology', permanent: true },

    { source: '/legal', destination: '/law', permanent: true },
    { source: '/legal/:path*', destination: '/law/:path*', permanent: true },

    // Both land on the Atlas, which is `/`. Next carries the query string through a redirect
    // automatically, so an `/explore?state=OK&era=1920s` bookmark keeps its constraints — the
    // param vocabularies are identical because `query-normalization.ts` runs `/` and `/explore`
    // through the same allowlist and the same parse/build pair.
    //
    // Exact `/explore` only, never `/explore/:path*`: `/explore/api` is the Atlas's refine
    // endpoint and must keep answering on its own URL.
    { source: '/explore', destination: '/', permanent: true },
    // A config rule rather than a page-level `redirect()` call: permanent instead of temporary,
    // and one less render.
    { source: '/map', destination: '/', permanent: true },
  ];
}
