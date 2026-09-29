/**
 * Edge cheap-deny for named crawlers on expensive origin paths.
 *
 * robots.txt is courtesy. These routes are the ones that actually burn Vercel CPU,
 * Postgres, and CDN origin: the Explore catalog JSON, the sitemap (discovery amplifier),
 * refine/search/geocode APIs, force-dynamic `/explore`, and `/records`, whose filter
 * combinations each render afresh. Search crawlers (Googlebot, Bingbot) are not denied.
 *
 * Who is denied where:
 * - AI-training crawlers and SEO-tool crawlers: every expensive path.
 * - AI answer-engine crawlers (Claude-SearchBot, Amzn-SearchBot): every expensive path except the
 *   sitemap, which is how they reach the cached record pages that can send readers.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { AI_SEARCH_USER_AGENTS, SEO_TOOL_USER_AGENTS } from './agent-lists';
import { classifyTraffic } from './classify';

const EXPENSIVE_EXACT = new Set(['/explore', '/records', '/atlas/catalog', '/sitemap.xml']);
const EXPENSIVE_PREFIXES = ['/explore/api', '/search/api', '/locate/api'] as const;
const SITEMAP_PATH = '/sitemap.xml';

function normalizePath(pathname: string): string {
  return pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

function matchesAny(userAgent: string, tokens: readonly string[]): boolean {
  const haystack = userAgent.toLowerCase();
  return tokens.some((token) => haystack.includes(token.toLowerCase()));
}

export function isExpensiveOriginPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  if (EXPENSIVE_EXACT.has(path)) return true;
  return EXPENSIVE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function shouldDenyAiCrawler(pathname: string, userAgent: string): boolean {
  if (!isExpensiveOriginPath(pathname)) return false;
  if (classifyTraffic({ userAgent }) === 'ai_crawler') return true;
  if (matchesAny(userAgent, SEO_TOOL_USER_AGENTS)) return true;
  return normalizePath(pathname) !== SITEMAP_PATH && matchesAny(userAgent, AI_SEARCH_USER_AGENTS);
}

export function denyExpensiveAiCrawler(request: NextRequest): NextResponse | null {
  const userAgent = request.headers.get('user-agent') ?? '';
  if (!shouldDenyAiCrawler(request.nextUrl.pathname, userAgent)) {
    return null;
  }
  const response = new NextResponse('Not available for automated crawlers.', {
    status: 403,
  });
  // Never cacheable. The CDN keys on URL, not user agent, so a shared-cacheable 403 is one
  // crawler's answer waiting to be served to readers on a cached route like /records. Observed
  // 2026-09-29: Cloudflare stored the old `s-maxage=86400` 403 and only its edge TTL config made
  // the next reader revalidate. The deny runs before any render, so the uncached 403 stays cheap.
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}
