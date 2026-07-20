/**
 * Tests for web trust helpers — errata feeds and ClaimReview path exclusivity.
 * Public /myths browse was retired; ClaimReview remains domain-gated to /myths/<slug>
 * so no other surface can emit it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildErrataJsonFeed, buildErrataRssFeed } from './errata-feed';
import { listErrataEntries } from './errata-seed';
import { assertClaimReviewPathExclusive, buildMythClaimReviewJsonLd } from './domain-trust';

test('errata seed is reverse-chronological and includes fact corrections', () => {
  const entries = listErrataEntries();
  assert.ok(entries.length >= 2);
  for (let i = 1; i < entries.length; i += 1) {
    assert.ok(entries[i - 1]!.timestamp >= entries[i]!.timestamp);
  }
  assert.ok(entries.some((entry) => entry.changeType === 'correction'));
  assert.ok(entries.every((entry) => !entry.affectedUrl?.startsWith('/facts')));
});

test('buildErrataJsonFeed emits JSON Feed 1.1 items with taxonomy tags', () => {
  const entries = listErrataEntries().slice(0, 2);
  const feed = buildErrataJsonFeed(entries, 'https://example.org/errata/feed.json');
  assert.equal(feed.version, 'https://jsonfeed.org/version/1.1');
  assert.equal(feed.items.length, 2);
  assert.ok(feed.items[0]?.tags?.length);
});

test('buildErrataRssFeed emits well-formed RSS with categories', () => {
  const xml = buildErrataRssFeed(
    listErrataEntries().slice(0, 1),
    'https://example.org/errata/feed.xml',
  );
  assert.match(xml, /<rss version="2.0">/);
  assert.match(xml, /<category>Editor&apos;s note<\/category>/);
});

test('ClaimReview JSON-LD stays path-exclusive to /myths/<slug>', () => {
  assert.doesNotThrow(() => assertClaimReviewPathExclusive('/myths/sample-claim'));
  assert.throws(() => assertClaimReviewPathExclusive('/methodology'));
  assert.throws(() => assertClaimReviewPathExclusive('/facts/sample'));
  const jsonLd = buildMythClaimReviewJsonLd(
    {
      pageUrl: 'https://example.org/myths/sample-claim',
      datePublished: '2026-07-17',
      claimReviewed: 'Sample circulating claim',
      reviewBody: 'Evidence does not support the circulating framing.',
      claimOrigin: { name: 'Circulating folklore' },
      ratingExplanation: 'Contested by primary records.',
      authorName: 'BlackStory',
    },
    '/myths/sample-claim',
  );
  assert.equal(jsonLd['@type'], 'ClaimReview');
});
