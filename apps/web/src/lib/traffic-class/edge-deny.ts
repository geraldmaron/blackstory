/**
 * Edge cheap-deny for named AI-training crawlers on expensive origin paths.
 *
 * robots.txt is courtesy. These routes are the ones that actually burn Vercel CPU,
 * Postgres, and CDN origin: the Explore catalog JSON, the sitemap (discovery amplifier),
 * refine/search/geocode APIs, and force-dynamic `/explore`. Search crawlers
 * (Googlebot, Bingbot) are not denied.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { classifyTraffic } from './classify';

const EXPENSIVE_EXACT = new Set(['/explore', '/atlas/catalog', '/sitemap.xml']);
const EXPENSIVE_PREFIXES = ['/explore/api', '/search/api', '/locate/api'] as const;

export function isExpensiveOriginPath(pathname: string): boolean {
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (EXPENSIVE_EXACT.has(path)) return true;
  return EXPENSIVE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function shouldDenyAiCrawler(pathname: string, userAgent: string): boolean {
  if (!isExpensiveOriginPath(pathname)) return false;
  return classifyTraffic({ userAgent }) === 'ai_crawler';
}

export function denyExpensiveAiCrawler(request: NextRequest): NextResponse | null {
  const userAgent = request.headers.get('user-agent') ?? '';
  if (!shouldDenyAiCrawler(request.nextUrl.pathname, userAgent)) {
    return null;
  }
  const response = new NextResponse('Not available for automated training crawlers.', {
    status: 403,
  });
  response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=86400');
  response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}
