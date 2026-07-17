/**
 * RSS and JSON feed builders for the public errata log.
 */
import { ERRATA_CHANGE_TYPE_LABELS } from './domain-trust.js';
import { TRUST_SITE_NAME } from './site-identity.js';
import type { ErrataEntry } from './errata-seed.js';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildErrataJsonFeed(entries: readonly ErrataEntry[], feedUrl: string) {
  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: `${TRUST_SITE_NAME} errata log`,
    home_page_url: feedUrl.replace(/\/feed\.json$/, ''),
    feed_url: feedUrl,
    items: entries.map((entry) => ({
      id: entry.id,
      date_published: entry.timestamp,
      title: entry.headline,
      summary: entry.summary,
      tags: [ERRATA_CHANGE_TYPE_LABELS[entry.changeType]],
      ...(entry.affectedUrl ? { url: entry.affectedUrl } : {}),
    })),
  };
}

export function buildErrataRssFeed(entries: readonly ErrataEntry[], feedUrl: string): string {
  const channelLink = feedUrl.replace(/\/feed\.xml$/, '');
  const items = entries
    .map(
      (entry) => `<item>
  <title>${escapeXml(entry.headline)}</title>
  <description>${escapeXml(entry.summary)}</description>
  <pubDate>${new Date(entry.timestamp).toUTCString()}</pubDate>
  <guid isPermaLink="false">${escapeXml(entry.id)}</guid>
  ${entry.affectedUrl ? `<link>${escapeXml(entry.affectedUrl)}</link>` : ''}
  <category>${escapeXml(ERRATA_CHANGE_TYPE_LABELS[entry.changeType])}</category>
</item>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(`${TRUST_SITE_NAME} errata log`)}</title>
    <link>${escapeXml(channelLink)}</link>
    <description>Reverse-chronological corrections, clarifications, updates, and editor's notes.</description>
    <lastBuildDate>${entries[0] ? new Date(entries[0].timestamp).toUTCString() : new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
}
