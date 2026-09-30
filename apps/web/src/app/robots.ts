/**
 * robots.txt. Standard search engines may index the public corpus;
 * a curated set of AI-training bulk-scraping crawlers are explicitly disallowed. This is a
 * courtesy signal honored only by crawlers that choose to respect it it is not an access
 * control so it is paired with `/ai.txt` (an emerging, narrower AI-specific convention some
 * crawlers check independently) and with real technical controls elsewhere (named-UA deny on
 * expensive origin paths, rate limits, cache-busting normalization; see
 * docs/security/threat-model.md T-19). Update
 * `NEXT_PUBLIC_SITE_URL` once the production domain is live so `sitemap`/host resolve correctly.
 */
import type { MetadataRoute } from 'next';
import { AI_TRAINING_USER_AGENTS, SEO_TOOL_USER_AGENTS } from '../lib/traffic-class/agent-lists';

export { AI_TRAINING_USER_AGENTS };

/**
 * Query shapes the general crawler may not enumerate. Each is a distinct origin render and the
 * combinations are unbounded; on 2026-09-29 /records and /explore variants were 81k of 128k
 * Cloudflare misses in a day (repo-4wb0e). Bare /records, single-facet /records pages and plain
 * pagination stay crawlable (a filtered page is a distinct, useful set); Explore is a map
 * instrument whose variants are not reading pages. `*` wildcards are honored by Google, Bing and
 * the other major crawlers; a crawler that ignores them still meets the edge normalization, the
 * rate limit, the pages' own `noindex, nofollow`, and the Cloudflare crawl-trap challenge
 * (`scripts/cloudflare-bot-rules.mts`).
 */
export const CRAWL_DISALLOWED_QUERY_SHAPES: readonly string[] = [
  '/records?*&',
  '/records?q=',
  '/explore?',
];

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3048';
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: [...CRAWL_DISALLOWED_QUERY_SHAPES] },
      ...[...AI_TRAINING_USER_AGENTS, ...SEO_TOOL_USER_AGENTS].map((userAgent) => ({
        userAgent,
        disallow: '/',
      })),
    ],
    // The two routes kept out of the index — /design-system and /corrections/status/* — say so
    // with noindex instead, which a crawler can only read if it is allowed to fetch the page, so
    // no Disallow above may match them. The /records query shapes also say `noindex, nofollow`
    // on the page (`recordsQueryIndexable`, the inverse of `isRecordsCombinationQuery`, so both
    // cover the same URLs) for crawlers that ignore wildcards; a crawler that honors this file
    // never fetches them, and crawl cost is the point.
    host: siteUrl(),
    // Pointing at the sitemap here is how a crawler finds the registry-derived URL list without
    // having to walk in from Explore.
    sitemap: new URL('/sitemap.xml', siteUrl()).toString(),
  };
}
