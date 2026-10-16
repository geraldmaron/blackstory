/**
 * Crawler classification and the expensive-path deny. Port of
 * apps/web/src/lib/traffic-class/{classify,edge-deny}.ts; the user-agent lists live in
 * agent-lists.json (copied from agent-lists.ts, which also feeds robots.txt, /ai.txt and the
 * Cloudflare block rule until the Next app is removed). A parity test in apps/web keeps the
 * two in step.
 */
const lists = require('./agent-lists.json');

const EXPENSIVE_EXACT = new Set(['/explore', '/records', '/atlas/catalog', '/sitemap.xml']);
const EXPENSIVE_PREFIXES = ['/explore/api', '/search/api', '/locate/api'];

function matchesAny(userAgent, tokens) {
  const haystack = userAgent.toLowerCase();
  return tokens.some((token) => haystack.includes(token.toLowerCase()));
}

function classifyTraffic({ userAgent, acceptLanguage, languages, webdriver }) {
  const ua = userAgent.trim();
  if (ua.length === 0) return 'tool';
  if (matchesAny(ua, lists.AI_TRAINING_USER_AGENTS)) return 'ai_crawler';
  if (matchesAny(ua, lists.SEARCH_CRAWLER_USER_AGENTS)) return 'search_crawler';
  if (matchesAny(ua, lists.TOOL_USER_AGENTS)) return 'tool';
  if (webdriver === true || matchesAny(ua, lists.AUTOMATED_USER_AGENTS)) return 'automated';
  if (languages && languages.length === 0) return 'automated';
  if (acceptLanguage === '') return 'automated';
  return 'likely_human';
}

function normalizePath(pathname) {
  return pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

function isExpensiveOriginPath(pathname) {
  const path = normalizePath(pathname);
  if (EXPENSIVE_EXACT.has(path)) return true;
  return EXPENSIVE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function shouldDenyAiCrawler(pathname, userAgent) {
  if (!isExpensiveOriginPath(pathname)) return false;
  if (classifyTraffic({ userAgent }) === 'ai_crawler') return true;
  return matchesAny(userAgent, lists.SEO_TOOL_USER_AGENTS);
}

/** @returns {{status:number, headers:Record<string,string>, body:string}|null} */
function denyExpensiveAiCrawler({ pathname, headers }) {
  if (!shouldDenyAiCrawler(pathname, headers['user-agent'] ?? '')) return null;
  return {
    status: 403,
    headers: { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' },
    body: 'Not available for automated crawlers.',
  };
}

module.exports = {
  classifyTraffic,
  isExpensiveOriginPath,
  shouldDenyAiCrawler,
  denyExpensiveAiCrawler,
};
