/**
 * Named user-agent tokens used to classify public-web traffic and to write
 * /robots.txt plus /ai.txt. One list per class so those files cannot drift
 * from the classifier.
 */

/**
 * AI crawlers we turn away: training and bulk-ingestion agents, and (by owner decision,
 * 2026-09-30) AI answer/search fetchers too, which cost a function render per page and send
 * almost no readers. Also compiled into the Cloudflare block rule by
 * `scripts/cloudflare-bot-rules.mts`, so the edge, robots.txt and /ai.txt share one list.
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
  // AI answer / search fetchers (blocked by choice, see above).
  'Claude-SearchBot',
  'Amzn-SearchBot',
  'Claude-User',
  'Perplexity-User',
  'DuckAssistBot',
  'MistralAI-User',
  'Meta-ExternalFetcher',
  // Training crawlers added 2026-09-30.
  'Kangaroo Bot',
  'img2dataset',
  'Webzio-Extended',
  'FriendlyCrawler',
  'ICC-Crawler',
  'PanguBot',
];

/** Conventional search and social preview crawlers that we allow to index. */
export const SEARCH_CRAWLER_USER_AGENTS: readonly string[] = [
  'Googlebot',
  'Google-InspectionTool',
  'Bingbot',
  'DuckDuckBot',
  'Slurp',
  'Baiduspider',
  'YandexBot',
  'Applebot',
  'facebookexternalhit',
  'Facebot',
  'LinkedInBot',
  'Twitterbot',
  'Slackbot',
  'Discordbot',
  'Pinterestbot',
  'WhatsApp',
  'TelegramBot',
  'redditbot',
  'Embedly',
  // Archivers: the Wayback Machine keeps a public record of the archive itself.
  'ia_archiver',
  'archive.org_bot',
];

/**
 * Scripted HTTP clients. Tokens include a separator (`/` or `-`) where a bare
 * word would also match ordinary browser UAs (for example `Java` vs `Java/`).
 */
export const TOOL_USER_AGENTS: readonly string[] = [
  'curl/',
  'Wget',
  'python-requests',
  'python-httpx',
  'axios/',
  'Go-http-client',
  'Java/',
  'okhttp',
  'libwww-perl',
  'HTTPie',
  'PostmanRuntime',
  'Insomnia',
  'node-fetch',
  'undici',
  'Apache-HttpClient',
  'scrapy',
  'aiohttp',
];

/** Headless / automation tokens that still claim to be a desktop browser. */
export const AUTOMATED_USER_AGENTS: readonly string[] = [
  'HeadlessChrome',
  'Headless',
  'PhantomJS',
  'Selenium',
  'Playwright',
  'Puppeteer',
];
