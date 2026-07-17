/**
 * RSS export for the public errata log (BB-088).
 */
import { buildErrataRssFeed } from '../../../lib/trust/errata-feed.js';
import { listErrataEntries } from '../../../lib/trust/errata-seed.js';
import { TRUST_PATHS, resolveTrustUrl } from '../../../lib/trust/site-identity.js';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const feedUrl = resolveTrustUrl(TRUST_PATHS.errataFeedRss, origin);
  const body = buildErrataRssFeed(listErrataEntries(), feedUrl);
  return new Response(body, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
