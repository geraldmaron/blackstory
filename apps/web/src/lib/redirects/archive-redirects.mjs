/**
 * The one switch for phase 4b's temporary redirects (docs/ui/archive-url-contract.md, 10.4).
 *
 * `true`: `/records`, `/explore`, `/search`, `/history`, `/facts`, `/inventions` and `/locate`
 * answer a 307 to their `/archive` address, and `/archive` is the canonical family.
 * `false`: those addresses answer as they did before the routes collapsed, name themselves as
 * canonical, and the sitemap lists them. `/archive` keeps answering and names the old address as
 * its canonical. ROLLBACK IS THIS ONE LINE. A `.mjs` because `next.config.mjs` reads it too.
 */
export const ARCHIVE_REDIRECTS_ENABLED = true;
