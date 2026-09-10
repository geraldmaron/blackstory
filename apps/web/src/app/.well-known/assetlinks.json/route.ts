/**
 * /.well-known/assetlinks.json — what Android fetches to verify this app as a handler for
 * blackstory.app links.
 *
 * Fails closed with 404 until a real release signing fingerprint is configured. Publishing a
 * placeholder would be actively worse than publishing nothing: Android caches a failed
 * verification, so a bad fingerprint keeps the app from being a candidate handler even after
 * the file is corrected.
 */
import { buildAssetLinks } from '../../../lib/config/app-links';

export function GET(): Response {
  const body = buildAssetLinks();
  if (body === null) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
