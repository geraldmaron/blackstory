/**
 * RSS export for the public errata log.
 *
 * Entry URLs must be absolute against `NEXT_PUBLIC_SITE_URL`, and this feed is built from the
 * same `listErrataEntries()` list the page renders, per docs/ui/design-direction-v9-surfaces.md
 * §4.5. `NEXT_PUBLIC_SITE_URL` is preferred over the request origin so the feed's canonical
 * identity does not shift with the host a crawler happened to hit.
 */
import { buildErrataRssFeed } from '../../../lib/trust/errata-feed';
import { listErrataEntries } from '../../../lib/trust/errata-seed';
import { TRUST_PATHS, resolveTrustUrl } from '../../../lib/trust/site-identity';

export async function GET(request: Request) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const feedUrl = resolveTrustUrl(TRUST_PATHS.errataFeedRss, origin);
  const entries = listErrataEntries().map((entry) =>
    entry.affectedUrl
      ? { ...entry, affectedUrl: new URL(entry.affectedUrl, origin).toString() }
      : entry,
  );
  const body = buildErrataRssFeed(entries, feedUrl);
  return new Response(body, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
