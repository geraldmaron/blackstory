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
