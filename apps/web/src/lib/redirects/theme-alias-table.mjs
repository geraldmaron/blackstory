/**
 * The one table mapping a legacy theme id to the chapter that now tells its story.
 *
 * Two consumers read it and they must never drift: `next.config.mjs` generates the
 * `/themes/*` redirect rules from it, and `lib/theme-impact/source.ts` builds in-app chapter
 * hrefs from it. Split across both, adding a chapter means editing a redirect table in a
 * different language and silently shipping a stale alias when that step is missed.
 *
 * Plain ESM, not TypeScript, because `next.config.mjs` is loaded by Node directly and cannot
 * import a `.ts` module — the same reason `web-security/next-config-headers.mjs` is `.mjs`.
 * Tests and app code import it through tsx, which resolves `.mjs` from `.ts` fine.
 */

/**
 * Legacy theme id -> chapter slug. A theme id absent here has no authored chapter yet and
 * falls through to the `/chapters` index via the catch-all, which is why the catch-all stays.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const THEME_CHAPTER_SLUGS = Object.freeze({
  redlining: 'buying-a-home',
  wealth_gap: 'the-gap-that-never-closed',
});

/**
 * Generated `/themes/:id` rules, most specific first.
 *
 * Each id emits two rules: the bare id and its `/:path*` descendants. Both land on the chapter
 * itself rather than the index, because a reader who bookmarked `/themes/redlining/sources` was
 * reading about redlining, not browsing.
 *
 * @returns {ReadonlyArray<{ source: string, destination: string, permanent: boolean }>}
 */
export function buildThemeAliasRedirects() {
  return Object.entries(THEME_CHAPTER_SLUGS).flatMap(([themeId, slug]) => [
    { source: `/themes/${themeId}`, destination: `/chapters/${slug}`, permanent: true },
    { source: `/themes/${themeId}/:path*`, destination: `/chapters/${slug}`, permanent: true },
  ]);
}
