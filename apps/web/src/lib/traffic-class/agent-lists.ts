/**
 * Named user-agent tokens used to classify public-web traffic and to write
 * /robots.txt plus /ai.txt. One list per class so those files cannot drift
 * from the classifier.
 */

/** Crawlers that identify themselves as AI-training or bulk-AI-ingestion agents. */
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

/**
 * SEO-tool crawlers: backlink and keyword indexes that send no readers. Disallowed in robots.txt
 * and denied on expensive origin paths. SemrushBot alone caused ~6.5k uncached renders in the
 * 23 h measured on 2026-09-29 (repo-4wb0e).
 */
export const SEO_TOOL_USER_AGENTS: readonly string[] = [
  'SemrushBot',
  'AhrefsBot',
  'MJ12bot',
  'DotBot',
  'BLEXBot',
  'DataForSeoBot',
  'SeekportBot',
  'serpstatbot',
  'Barkrowler',
  'MegaIndex',
];

/**
 * AI answer-engine crawlers that can send readers, so they keep the sitemap and every cached
 * record page. They are denied only on the origin-expensive instruments (/explore, /records,
 * catalog, APIs), and they are deliberately NOT given their own robots.txt group: a crawler that
 * finds a group naming it ignores the `*` group, and with it the query-combination Disallows.
 * Amzn-SearchBot and Claude-SearchBot caused ~13k uncached renders in the same window.
 */
export const AI_SEARCH_USER_AGENTS: readonly string[] = ['Amzn-SearchBot', 'Claude-SearchBot'];

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
