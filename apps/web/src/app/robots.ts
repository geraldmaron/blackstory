/**
 * robots.txt. Standard search engines may index the public corpus;
 * a curated set of AI-training bulk-scraping crawlers are explicitly disallowed. This is a
 * courtesy signal honored only by crawlers that choose to respect it it is not an access
 * control so it is paired with `/ai.txt` (an emerging, narrower AI-specific convention some
 * crawlers check independently) and with real technical controls elsewhere (rate limits, App
 * Check, cache-busting normalization; see docs/security/threat-model.md T-19). Update
 * `NEXT_PUBLIC_SITE_URL` once the production domain is live so `sitemap`/host resolve correctly.
 */
import type { MetadataRoute } from 'next';

/**
 * Crawlers that identify themselves as AI-training or bulk-AI-ingestion agents.
 * Not exhaustive and not guaranteed to be honored see the file header note above.
 * Review periodically (fold into scheduled maintenance) as new agents appear.
 */
export const AI_TRAINING_USER_AGENTS: readonly string[] = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'CCBot',
  'Google-Extended',
  'GoogleOther',
  'Bytespider',
  'PetalBot',
  'Amazonbot',
  'Applebot-Extended',
  'FacebookBot',
  'Meta-ExternalAgent',
  'meta-externalagent',
  'Diffbot',
  'ImagesiftBot',
  'Omgilibot',
  'Omgili',
  'cohere-ai',
  'cohere-training-data-crawler',
  'PerplexityBot',
  'YouBot',
  'Timpibot',
  'Ai2Bot',
];

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3048';
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      ...AI_TRAINING_USER_AGENTS.map((userAgent) => ({
        userAgent,
        disallow: '/',
      })),
    ],
    host: siteUrl(),
  };
}
