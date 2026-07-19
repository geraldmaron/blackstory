/**
 * Proves the RSS discovery scheduled job completes with private leads and publicEffect none semantics.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runRssDiscoveryCampaignJob } from './discovery-campaign-rss.ts';

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'domain',
  'src',
  'adapters',
  'rss',
  'fixtures',
  'historical-society-feed.rss.xml',
);

test('RSS discovery job completes with ranked private leads (publicEffect none)', async () => {
  const xml = readFileSync(FIXTURE, 'utf8');
  const result = await runRssDiscoveryCampaignJob({
    jobRunId: 'rss-discovery-run-1',
    startedAt: '2026-07-19T10:00:00.000Z',
    completedAt: '2026-07-19T10:05:00.000Z',
    feedXmlByFeedId: new Map([['feed_piedmont_historical_society', xml]]),
  });

  assert.equal(result.run.status, 'success');
  assert.equal(result.run.jobId, 'discovery-campaign-rss');
  assert.equal(result.run.itemsExpected, 100);
  assert.equal(result.run.itemsProcessed, result.campaign.ranked.length);
  assert.ok(result.campaign.ranked.length >= 1);
  assert.ok(
    result.campaign.ranked.some((lead) => lead.title?.includes("Freedmen's Bureau")),
    `unexpected ranked titles: ${result.campaign.ranked.map((l) => l.title).join(' | ')}`,
  );
  assert.equal(result.campaign.excludedCuratedFeedIds.length, 0);
});

test('RSS discovery job excludes curated ABS feed by default', async () => {
  const historicalFixture = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    'domain',
    'src',
    'adapters',
    'rss',
    'fixtures',
    'historical-society-feed.rss.xml',
  );
  const absFixture = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    'domain',
    'src',
    'adapters',
    'rss',
    'fixtures',
    'the-american-blackstory.trimmed.rss.xml',
  );
  const result = await runRssDiscoveryCampaignJob({
    jobRunId: 'rss-discovery-run-2',
    startedAt: '2026-07-19T11:00:00.000Z',
    completedAt: '2026-07-19T11:05:00.000Z',
    feedXmlByFeedId: new Map([
      ['feed_piedmont_historical_society', readFileSync(historicalFixture, 'utf8')],
      ['feed_the_american_blackstory', readFileSync(absFixture, 'utf8')],
    ]),
  });

  assert.deepEqual(result.campaign.excludedCuratedFeedIds, ['feed_the_american_blackstory']);
  assert.ok(!result.campaign.feedIds.includes('feed_the_american_blackstory'));
});
