/**
 * Tests for web trust helpers errata feeds, myth exclusivity, and seed wiring.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildErrataJsonFeed, buildErrataRssFeed } from './errata-feed.js';
import { listErrataEntries } from './errata-seed.js';
import { getMythReview, listMythReviews } from './myths-seed.js';
import { assertClaimReviewPathExclusive, buildMythClaimReviewJsonLd } from './domain-trust.js';

test('errata seed is reverse-chronological and includes fact corrections', () => {
  const entries = listErrataEntries();
  assert.ok(entries.length >= 2);
  for (let i = 1; i < entries.length; i += 1) {
    assert.ok(entries[i - 1]!.timestamp >= entries[i]!.timestamp);
  }
  assert.ok(entries.some((entry) => entry.changeType === 'correction'));
});

test('buildErrataJsonFeed emits JSON Feed 1.1 items with taxonomy tags', () => {
  const entries = listErrataEntries().slice(0, 2);
  const feed = buildErrataJsonFeed(entries, 'https://example.org/errata/feed.json');
  assert.equal(feed.version, 'https://jsonfeed.org/version/1.1');
  assert.equal(feed.items.length, 2);
  assert.ok(feed.items[0]?.tags?.length);
});

test('buildErrataRssFeed emits well-formed RSS with categories', () => {
  const xml = buildErrataRssFeed(listErrataEntries().slice(0, 1), 'https://example.org/errata/feed.xml');
  assert.match(xml, /<rss version="2.0">/);
  assert.match(xml, /<category>Editor&apos;s note<\/category>/);
});

test('myth reviews are the only ClaimReview emitters', () => {
  for (const review of listMythReviews()) {
    assert.doesNotThrow(() => assertClaimReviewPathExclusive(review.pageUrl));
    const jsonLd = buildMythClaimReviewJsonLd(
      {
        ...review,
        pageUrl: `https://example.org${review.pageUrl}`,
      },
      review.pageUrl,
    );
    assert.equal(jsonLd['@type'], 'ClaimReview');
  }
  assert.ok(getMythReview('rosa-parks-was-just-tired'));
});
