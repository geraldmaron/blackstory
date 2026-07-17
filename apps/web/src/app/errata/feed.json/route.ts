/**
 * JSON Feed export for the public errata log.
 */
import { buildErrataJsonFeed } from '../../../lib/trust/errata-feed.js';
import { listErrataEntries } from '../../../lib/trust/errata-seed.js';
import { TRUST_PATHS, resolveTrustUrl } from '../../../lib/trust/site-identity.js';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const feedUrl = resolveTrustUrl(TRUST_PATHS.errataFeedJson, origin);
  const body = buildErrataJsonFeed(listErrataEntries(), feedUrl);
  return Response.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/feed+json; charset=utf-8',
    },
  });
}
