/**
 * Tests for the RSS/Atom community discovery adapter (BB-073). Fixture-driven; no live network —
 * every HTTP call goes through a mock SafeHttpClient injected by the test, never a real fetch.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import type { EvidenceSource } from '../../provenance/source.js';
import { getSourceObligationsOrThrow, defaultSourceObligationsSeed, createInMemoryObligationsRegistry } from '../../rights/index.js';
import { approveSourcePolicy, createInMemorySourceRegistry, registerSource, type SourceRegistryEntry } from '../index.js';
import type { SafeHttpResponse } from '../internet-archive/shared/http-port.js';
import {
  addFeedToRegistry,
  createInMemoryAuditLog,
  createInMemoryFeedRegistry,
  createRssAdapterContract,
  fetchAndNormalizeFeed,
  fetchAndNormalizeFeeds,
  listActiveFeeds,
  normalizeFeedXml,
  parseRssOrAtomFeed,
  removeFeedFromRegistry,
  RSS_ADAPTER_ID,
} from './index.js';

const FIXED_NOW = '2026-07-17T20:00:00.000Z';
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixtureXml(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf8');
}

function rssRegistryEntry(): SourceRegistryEntry {
  const contract = createRssAdapterContract();
  const evidenceSource: EvidenceSource = {
    id: 'src_rss',
    organizationId: 'org_community',
    displayName: 'Community RSS/Atom Discovery',
    classification: contract.classification,
    adapterId: RSS_ADAPTER_ID,
    stableIdScheme: contract.stableIdScheme,
    policy: contract.policy,
    adapterEnabled: true,
    killSwitchId: 'adapter:rss',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  return {
    id: 'reg_rss',
    contract,
    evidenceSource,
    registryState: 'disabled',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

test('RSS adapter starts disabled by default and requires an approved policy to run', () => {
  const store = createInMemorySourceRegistry();
  const entry = rssRegistryEntry();
  registerSource(store, {
    id: entry.id,
    contract: entry.contract,
    evidenceSource: entry.evidenceSource,
    createdAt: FIXED_NOW,
  });
  const registered = store.get('reg_rss');
  assert.equal(registered?.registryState, 'disabled');

  const approved = approveSourcePolicy(store, {
    id: 'reg_rss',
    approvedBy: 'admin@blackbook.local',
    approvedAt: FIXED_NOW,
  });
  assert.equal(approved.registryState, 'approved');
});

test('RSS adapter has a registered BB-077 obligations entry (fail-closed lookup succeeds)', () => {
  const obligationsStore = createInMemoryObligationsRegistry(defaultSourceObligationsSeed(FIXED_NOW));
  const obligations = getSourceObligationsOrThrow(obligationsStore, RSS_ADAPTER_ID);
  assert.equal(obligations.sourceClass, 'rss');
  assert.equal(obligations.attributionRequired, true);
  assert.equal(obligations.livenessRecheckRequired, true);
});

test('parses RSS 2.0 feeds into normalized items', () => {
  const xml = loadFixtureXml('historical-society-feed.rss.xml');
  const parsed = parseRssOrAtomFeed(xml);
  assert.equal(parsed.format, 'rss');
  assert.equal(parsed.items.length, 2);
  assert.equal(
    parsed.items[0]?.title,
    "Oral history collection digitized: Freedmen's Bureau correspondence, 1866-1870",
  );
  assert.equal(parsed.items[0]?.link, 'https://www.piedmonthistoricalsociety.example.org/news/freedmens-bureau-correspondence');
  assert.ok(parsed.items[0]?.summary?.includes('214 letters'));
  assert.equal(parsed.items[0]?.publishedAt, new Date('Wed, 15 Jul 2026 14:00:00 GMT').toISOString());
});

test('parses Atom 1.0 feeds into normalized items', () => {
  const xml = loadFixtureXml('library-digital-collections.atom.xml');
  const parsed = parseRssOrAtomFeed(xml);
  assert.equal(parsed.format, 'atom');
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0]?.title, 'New collection: Rosewood School Photographs, 1948-1965');
  assert.equal(parsed.items[0]?.link, 'https://digital.crosscountylibrary.example.gov/collections/rosewood-school-photographs');
});

test('rejects unrecognized feed formats rather than guessing', () => {
  assert.throws(() => parseRssOrAtomFeed('<html><body>not a feed</body></html>'), /Unrecognized feed format/);
});

test('normalizes feed items into provenance-stamped, syndication-only candidates', () => {
  const entry = { ...rssRegistryEntry(), registryState: 'approved' as const, approvedAt: FIXED_NOW, approvedBy: 'admin@blackbook.local' };
  const feed = {
    id: 'feed_piedmont_historical_society',
    feedUrl: 'https://www.piedmonthistoricalsociety.example.org/feed.xml',
    displayName: 'Piedmont Historical Society News',
    classification: 'community_oral' as const,
    institutionType: 'historical_society' as const,
    status: 'active' as const,
    revision: 1,
    addedAt: FIXED_NOW,
    addedBy: 'admin@blackbook.local',
  };
  const xml = loadFixtureXml('historical-society-feed.rss.xml');
  const candidates = normalizeFeedXml({ feed, xml, registryEntry: entry, runId: 'run_rss_1', capturedAt: FIXED_NOW });

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.provenance.adapterId, RSS_ADAPTER_ID);
  assert.equal(candidates[0]?.classification, 'community_oral');
  assert.ok(candidates[0]?.stableIdentifier.startsWith('rss:feed_piedmont_historical_society:'));
  assert.ok(candidates[0]?.payload.summary!.length <= 320);
  // Never a full page body — only title/link/short summary.
  assert.equal('body' in candidates[0]!.payload, false);
  assert.equal('fullText' in candidates[0]!.payload, false);
});

test('feed registry add/remove is versioned and produces a BB-018 audit event', () => {
  const store = createInMemoryFeedRegistry();
  const auditLog = createInMemoryAuditLog();
  const actor = { id: 'admin@blackbook.local', type: 'user' as const };

  const added = addFeedToRegistry(
    store,
    {
      id: 'feed_piedmont_historical_society',
      feedUrl: 'https://www.piedmonthistoricalsociety.example.org/feed.xml',
      displayName: 'Piedmont Historical Society News',
      classification: 'community_oral',
      institutionType: 'historical_society',
    },
    { actor, reason: 'Curated seed list — vetted historical society.', requestId: 'req_1', correlationId: 'corr_1', now: FIXED_NOW },
  );
  auditLog.append(added.auditEvent);

  assert.equal(added.entry.status, 'active');
  assert.equal(added.entry.revision, 1);
  assert.equal(added.auditEvent.action, 'administrative.configuration_changed');
  assert.equal(added.auditEvent.data?.mutation, 'feed_added');
  assert.equal(listActiveFeeds(store).length, 1);

  assert.throws(
    () =>
      addFeedToRegistry(
        store,
        {
          id: 'feed_piedmont_historical_society',
          feedUrl: 'https://other.example.org/feed.xml',
          displayName: 'dup',
          classification: 'community_oral',
          institutionType: 'historical_society',
        },
        { actor, reason: 'dup', requestId: 'req_2', correlationId: 'corr_2', now: FIXED_NOW },
      ),
    /already exists/,
  );

  const removed = removeFeedFromRegistry(store, 'feed_piedmont_historical_society', {
    actor,
    reason: 'Feed discontinued by publisher.',
    requestId: 'req_3',
    correlationId: 'corr_3',
    now: '2026-07-18T00:00:00.000Z',
  });
  auditLog.append(removed.auditEvent);

  assert.equal(removed.entry.status, 'removed');
  assert.equal(removed.entry.revision, 2);
  assert.equal(listActiveFeeds(store).length, 0);
  assert.equal(auditLog.list().length, 2);
  assert.equal(auditLog.list()[1]?.data?.mutation, 'feed_removed');
});

test('feed registry rejects non-https feed URLs and empty removal reasons', () => {
  const store = createInMemoryFeedRegistry();
  const actor = { id: 'admin@blackbook.local', type: 'user' as const };
  assert.throws(
    () =>
      addFeedToRegistry(
        store,
        { id: 'feed_x', feedUrl: 'http://insecure.example.org/feed.xml', displayName: 'x', classification: 'self_published', institutionType: 'personal_blog' },
        { actor, reason: 'r', requestId: 'req', correlationId: 'corr', now: FIXED_NOW },
      ),
    /must use https/,
  );
});

test('fetchAndNormalizeFeed goes through the injected SafeHttpClient (mock, no live network) and enforces content-type allowlist', async () => {
  const entry = { ...rssRegistryEntry(), registryState: 'approved' as const, approvedAt: FIXED_NOW, approvedBy: 'admin@blackbook.local' };
  const feed = {
    id: 'feed_library',
    feedUrl: 'https://digital.crosscountylibrary.example.gov/feed.atom',
    displayName: 'Cross County Public Library',
    classification: 'news_reportage' as const,
    institutionType: 'library' as const,
    status: 'active' as const,
    revision: 1,
    addedAt: FIXED_NOW,
    addedBy: 'admin@blackbook.local',
  };
  const xml = loadFixtureXml('library-digital-collections.atom.xml');
  let calls = 0;
  const client = async (): Promise<SafeHttpResponse> => {
    calls += 1;
    return {
      status: 200,
      headers: { 'content-type': 'application/atom+xml; charset=utf-8' },
      bodyText: xml,
      finalUrl: feed.feedUrl,
    };
  };

  const candidates = await fetchAndNormalizeFeed({ feed, registryEntry: entry, runId: 'run_1', capturedAt: FIXED_NOW, client });
  assert.equal(calls, 1);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.provenance.sourceId, 'src_rss');
});

test('fetchAndNormalizeFeed retries on 429 and eventually succeeds', async () => {
  const entry = { ...rssRegistryEntry(), registryState: 'approved' as const, approvedAt: FIXED_NOW, approvedBy: 'admin@blackbook.local' };
  const feed = {
    id: 'feed_piedmont',
    feedUrl: 'https://www.piedmonthistoricalsociety.example.org/feed.xml',
    displayName: 'Piedmont Historical Society',
    classification: 'community_oral' as const,
    institutionType: 'historical_society' as const,
    status: 'active' as const,
    revision: 1,
    addedAt: FIXED_NOW,
    addedBy: 'admin@blackbook.local',
  };
  const xml = loadFixtureXml('historical-society-feed.rss.xml');
  let attempts = 0;
  const client = async (): Promise<SafeHttpResponse> => {
    attempts += 1;
    if (attempts < 3) {
      return { status: 429, headers: { 'content-type': 'text/plain' }, bodyText: '', finalUrl: feed.feedUrl };
    }
    return { status: 200, headers: { 'content-type': 'application/rss+xml' }, bodyText: xml, finalUrl: feed.feedUrl };
  };

  const candidates = await fetchAndNormalizeFeed({
    feed,
    registryEntry: entry,
    runId: 'run_retry',
    capturedAt: FIXED_NOW,
    client,
    retries: 5,
  });
  assert.equal(attempts, 3);
  assert.equal(candidates.length, 2);
});

test('fetchAndNormalizeFeeds fans out with modest bounded concurrency', async () => {
  const entry = { ...rssRegistryEntry(), registryState: 'approved' as const, approvedAt: FIXED_NOW, approvedBy: 'admin@blackbook.local' };
  const rssXml = loadFixtureXml('historical-society-feed.rss.xml');
  const atomXml = loadFixtureXml('library-digital-collections.atom.xml');
  const feeds = [
    {
      id: 'feed_a',
      feedUrl: 'https://a.example.org/feed.xml',
      displayName: 'A',
      classification: 'community_oral' as const,
      institutionType: 'historical_society' as const,
      status: 'active' as const,
      revision: 1,
      addedAt: FIXED_NOW,
      addedBy: 'admin@blackbook.local',
    },
    {
      id: 'feed_b',
      feedUrl: 'https://b.example.org/feed.atom',
      displayName: 'B',
      classification: 'news_reportage' as const,
      institutionType: 'library' as const,
      status: 'active' as const,
      revision: 1,
      addedAt: FIXED_NOW,
      addedBy: 'admin@blackbook.local',
    },
  ];
  let inFlight = 0;
  let maxInFlight = 0;
  const client = async (request: { url: string }): Promise<SafeHttpResponse> => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    const isAtom = request.url.endsWith('.atom');
    return {
      status: 200,
      headers: { 'content-type': isAtom ? 'application/atom+xml' : 'application/rss+xml' },
      bodyText: isAtom ? atomXml : rssXml,
      finalUrl: request.url,
    };
  };

  const candidates = await fetchAndNormalizeFeeds({
    feeds,
    registryEntry: entry,
    runId: 'run_fanout',
    capturedAt: FIXED_NOW,
    client,
    concurrency: 2,
  });
  assert.equal(candidates.length, 4);
  assert.ok(maxInFlight <= 2);
});
