/**
 * Integration tests for generic RSS discovery campaign (hourly lane).
 *
 * Fixture-first: historical-society + library Atom feeds — not ABS (reserved for
 * community-obscurity). Validates curated exclusion, budget cap, editorial hook, and snippet caps.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  addFeedToRegistry,
  createInMemoryFeedRegistry,
} from '../adapters/rss/index.js';
import {
  RSS_DISCOVERY_CAMPAIGN_KIND,
  runRssDiscoveryCampaign,
} from './rss-campaign.js';

const FIXED_NOW = '2026-07-18T21:00:00.000Z';
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'adapters', 'rss', 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

function historicalSocietyFeedRegistry() {
  const store = createInMemoryFeedRegistry();
  addFeedToRegistry(
    store,
    {
      id: 'feed_piedmont_historical_society',
      feedUrl: 'https://www.piedmonthistoricalsociety.example.org/feed.xml',
      displayName: 'Piedmont Historical Society News',
      classification: 'community_oral',
      institutionType: 'historical_society',
    },
    {
      actor: { id: 'operator@blackstory.local', type: 'user' },
      reason: 'Test seed',
      requestId: 'req_rss_1',
      correlationId: 'corr_rss_1',
      now: FIXED_NOW,
    },
  );
  return store;
}

function libraryFeedRegistry() {
  const store = createInMemoryFeedRegistry();
  addFeedToRegistry(
    store,
    {
      id: 'feed_library_digital',
      feedUrl: 'https://digital.crosscountylibrary.example.gov/feed.atom',
      displayName: 'Cross County Public Library — Digital Collections',
      classification: 'news_reportage',
      institutionType: 'library',
    },
    {
      actor: { id: 'operator@blackstory.local', type: 'user' },
      reason: 'Test seed',
      requestId: 'req_rss_2',
      correlationId: 'corr_rss_2',
      now: FIXED_NOW,
    },
  );
  return store;
}

test('historical-society fixture yields survivors with expected titles', async () => {
  const xml = loadFixture('historical-society-feed.rss.xml');
  const result = await runRssDiscoveryCampaign({
    feedXmlByFeedId: new Map([['feed_piedmont_historical_society', xml]]),
    feedRegistry: historicalSocietyFeedRegistry(),
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });

  assert.equal(result.kind, RSS_DISCOVERY_CAMPAIGN_KIND);
  assert.deepEqual(result.feedIds, ['feed_piedmont_historical_society']);
  assert.equal(result.excludedCuratedFeedIds.length, 0);
  assert.ok(result.yield.survivors >= 1);
  assert.ok(result.ranked.length >= 1);

  const titles = result.ranked.map((lead) => lead.title ?? '');
  assert.ok(
    titles.some((title) => title.includes("Freedmen's Bureau")),
    `expected Freedmen's Bureau title, got: ${titles.join(' | ')}`,
  );
  assert.ok(
    titles.some((title) => title.includes('Reconstruction-era churches')),
    `expected lecture series title, got: ${titles.join(' | ')}`,
  );
});

test('curated ABS feed id excluded by default even when XML is provided', async () => {
  const historicalXml = loadFixture('historical-society-feed.rss.xml');
  const absXml = loadFixture('the-american-blackstory.trimmed.rss.xml');
  const result = await runRssDiscoveryCampaign({
    feedXmlByFeedId: new Map([
      ['feed_piedmont_historical_society', historicalXml],
      ['feed_the_american_blackstory', absXml],
    ]),
    feedRegistry: historicalSocietyFeedRegistry(),
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });

  assert.deepEqual(result.feedIds, ['feed_piedmont_historical_society']);
  assert.deepEqual(result.excludedCuratedFeedIds, ['feed_the_american_blackstory']);
  assert.ok(result.ranked.length >= 1);
  assert.ok(
    !result.ranked.some((lead) => lead.title?.includes('Buffalo Soldiers')),
    'ABS items must not appear when curated feeds are excluded',
  );
});

test('maxCandidates cap limits processed records', async () => {
  const historicalXml = loadFixture('historical-society-feed.rss.xml');
  const libraryXml = loadFixture('library-digital-collections.atom.xml');
  const feedRegistry = createInMemoryFeedRegistry();
  addFeedToRegistry(
    feedRegistry,
    {
      id: 'feed_piedmont_historical_society',
      feedUrl: 'https://www.piedmonthistoricalsociety.example.org/feed.xml',
      displayName: 'Piedmont Historical Society News',
      classification: 'community_oral',
      institutionType: 'historical_society',
    },
    {
      actor: { id: 'operator@blackstory.local', type: 'user' },
      reason: 'Test seed',
      requestId: 'req_cap_1',
      correlationId: 'corr_cap_1',
      now: FIXED_NOW,
    },
  );
  addFeedToRegistry(
    feedRegistry,
    {
      id: 'feed_library_digital',
      feedUrl: 'https://digital.crosscountylibrary.example.gov/feed.atom',
      displayName: 'Cross County Library Digital',
      classification: 'news_reportage',
      institutionType: 'library',
    },
    {
      actor: { id: 'operator@blackstory.local', type: 'user' },
      reason: 'Test seed',
      requestId: 'req_cap_2',
      correlationId: 'corr_cap_2',
      now: FIXED_NOW,
    },
  );

  const result = await runRssDiscoveryCampaign({
    feedXmlByFeedId: new Map([
      ['feed_piedmont_historical_society', historicalXml],
      ['feed_library_digital', libraryXml],
    ]),
    feedRegistry,
    maxCandidates: 2,
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });

  assert.equal(result.campaign.skippedCount, 2);
  assert.ok(result.campaign.candidates.length <= 2);
});

test('optional editorial hook is invoked on ranked leads (mock LLM)', async () => {
  const xml = loadFixture('library-digital-collections.atom.xml');
  let invoked = false;
  const result = await runRssDiscoveryCampaign({
    feedXmlByFeedId: new Map([['feed_library_digital', xml]]),
    feedRegistry: libraryFeedRegistry(),
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
    editorialHook: {
      reviewTopN: 2,
      review: (leads) => {
        invoked = true;
        return leads.map((lead) => ({
          candidateId: lead.candidateId,
          decision: 'keep' as const,
          reason: 'mock editorial keep',
        }));
      },
    },
  });

  assert.equal(invoked, true);
  assert.ok(result.editorialResults);
  assert.equal(result.editorialResults!.length, 2);
  assert.equal(result.editorialResults![0]?.decision, 'keep');
});

test('summarizeCampaignYield enforces snippet caps on survivors', async () => {
  const xml = loadFixture('historical-society-feed.rss.xml');
  const result = await runRssDiscoveryCampaign({
    feedXmlByFeedId: new Map([['feed_piedmont_historical_society', xml]]),
    feedRegistry: historicalSocietyFeedRegistry(),
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });

  assert.ok(result.yield.survivors >= 1);
  assert.equal(result.yield.helpersVersion, 'campaign-runner-helpers.v1');
  for (const candidate of result.campaign.candidates.filter(
    (entry) => entry.status === 'accepted' || entry.status === 'merged',
  )) {
    const summary =
      (candidate.adapterRecord.payload as { summary?: string }).summary ??
      candidate.adapterRecord.title ??
      '';
    assert.ok(summary.length <= 320, `summary too long for ${candidate.id}`);
    assert.ok(summary.split(/\s+/u).filter(Boolean).length <= 60);
  }
});
