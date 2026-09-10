/**
 * /.well-known/apple-app-site-association — what iOS fetches to decide whether this app may
 * open blackstory.app links.
 *
 * Apple requires JSON served without a file extension, over HTTPS, with no redirect. The file
 * is fetched by Apple's CDN rather than the device on install, so it is cached aggressively
 * upstream; the short max-age here only bounds how stale an edge copy can be.
 */
import { buildAppleAppSiteAssociation } from '../../../lib/config/app-links';

export function GET(): Response {
  return new Response(JSON.stringify(buildAppleAppSiteAssociation()), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
