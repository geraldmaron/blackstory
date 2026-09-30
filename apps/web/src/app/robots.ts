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
import { AI_TRAINING_USER_AGENTS } from '../lib/traffic-class/agent-lists';

export { AI_TRAINING_USER_AGENTS };

/**
 * Query-string URL spaces that are unbounded for a crawler: free-text `/records?q=`, any
 * `/records` narrowing with two or more params, and every parameterized `/explore` view. Each
 * distinct URL misses the edge cache and renders in a Vercel function; on 2026-09-30 crawlers
 * walking them were most of the web project's function CPU. Bare `/records`, single-facet
 * narrowings (`/records?state=OK`) and bare `/explore` stay crawlable. The pages themselves also
 * say `noindex` (see `recordsQueryIndexable` and the Explore page's metadata) for crawlers that
 * ignore this file's wildcards.
 */
export const CRAWL_TRAP_DISALLOWS = Object.freeze([
  '/records?q=',
  '/records?*&',
  '/explore?',
] as const);

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3048';
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: [...CRAWL_TRAP_DISALLOWS] },
      ...AI_TRAINING_USER_AGENTS.map((userAgent) => ({
        userAgent,
        disallow: '/',
      })),
    ],
    // Beyond the AI-training agents above, only the query-string crawl traps are disallowed.
    // The two routes kept out of the index — /design-system and /corrections/status/* — say so
    // with noindex instead, which a crawler can only read if it is allowed to fetch the page.
    host: siteUrl(),
    // Pointing at the sitemap here is how a crawler finds the registry-derived URL list without
    // having to walk in from Explore.
    sitemap: new URL('/sitemap.xml', siteUrl()).toString(),
  };
}
