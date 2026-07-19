/**
 * Tests for discovery catalog blocking (propose-match) and authority URL harvest.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parseCandidateFixtureBatch } from '../adapters/index.js';
import { parseQueryPackFixture } from '../query-packs/index.js';
import type { CanonicalEntity } from '../entity.js';
import {
  attachCatalogMatch,
  createDiscoveryCampaignConfig,
  harvestAuthorityFollowUpsForCandidate,
  isAuthorityHost,
  normalizeAuthorityUrl,
  runDiscoveryCampaign,
  type DiscoveryCandidateRecord,
} from './index.js';
import type { ResolutionProfile } from '../resolution/index.js';

const FIXED_NOW = '2026-07-18T20:00:00.000Z';
const ROOT = dirname(fileURLToPath(import.meta.url));
const PKG_SRC = join(ROOT, '..');

function loadAdapterBatch() {
  const raw = JSON.parse(
    readFileSync(join(PKG_SRC, 'adapters', 'fixtures', 'valid-nara-batch.json'), 'utf8'),
  );
  return parseCandidateFixtureBatch(raw);
}

function loadQueryPack() {
  const raw = JSON.parse(
    readFileSync(
      join(PKG_SRC, 'query-packs', 'fixtures', 'person-civil-rights-fixture.v1.json'),
      'utf8',
    ),
  );
  return parseQueryPackFixture(raw).pack;
}

function entity(
  id: string,
  kind: CanonicalEntity['kind'],
  displayName: string,
  extra: Partial<CanonicalEntity> = {},
): CanonicalEntity {
  return { id, kind, displayName, createdAt: FIXED_NOW, updatedAt: FIXED_NOW, ...extra };
}

function sampleCampaignConfig() {
  return createDiscoveryCampaignConfig({
    campaignId: 'camp_catalog',
    budget: {
      maxCandidates: 100,
      maxQuarantined: 10,
      maxDeadLetter: 5,
      maxRetriesPerCandidate: 2,
    },
    boundaries: { countries: ['US'] },
    continueOnQuarantine: true,
  });
}

function lowAuthorityCandidate(
  overrides: Partial<DiscoveryCandidateRecord> = {},
): DiscoveryCandidateRecord {
  const [record] = loadAdapterBatch();
  const base: DiscoveryCandidateRecord = {
    schemaVersion: 'discovery-candidate.v1',
    id: 'disc_rss_abs_1',
    identity: {
      identityKey: 'key_abs',
      stableIdentifier: 'rss:abs:buffalo',
      contentHash: {
        algorithm: 'sha256',
        digest: 'b'.repeat(64),
      },
      sourceReferences: [
        {
          sourceId: 'src_rss',
          adapterId: 'rss',
          parserVersion: 'rss-parser-1.0.0',
          registryEntryId: 'reg_rss',
          runId: 'run_1',
          capturedAt: FIXED_NOW,
          stableIdentifier: 'rss:abs:buffalo',
        },
      ],
    },
    adapterRecord: {
      ...record!,
      title: 'DAY 4 — The Buffalo Soldiers',
      canonicalUrl: 'https://theamericanblackstory.com/2025/02/04/d42025/',
      classification: 'self_published',
      stableIdentifier: 'rss:abs:buffalo',
      payload: {
        schemaVersion: 'rss-payload.v1',
        feedId: 'the-american-blackstory',
        feedUrl: 'https://theamericanblackstory.com/feed/',
        feedFormat: 'rss',
        classification: 'self_published',
        summary: 'Buffalo Soldiers in Yosemite and Hawaiʻi.',
        outboundLinkHints: [
          'https://www.nps.gov/yose/learn/historyculture/buffalo-soldiers.htm',
          'https://nmaahc.si.edu/explore/stories/buffalo-soldiers',
          'https://example.com/not-authority',
          'https://instagram.com/theamericanblackstory',
        ],
      },
      provenance: {
        ...record!.provenance,
        adapterId: 'rss',
        sourceId: 'src_rss',
      },
    },
    status: 'accepted',
    ingestMode: 'api',
    signals: {
      strength: 'weak',
      outcome: 'candidate_only',
      matchedClasses: ['geographic'],
      matchedTerms: ['Yosemite'],
      reasons: ['weak geographic match'],
    },
    geographicHints: [{ text: 'Yosemite', kind: 'region', confidence: 0.5 }],
    retryCount: 0,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  return { ...base, ...overrides };
}

test('catalog omitted leaves campaign behavior unchanged (no catalogMatch)', () => {
  const pack = loadQueryPack();
  const result = runDiscoveryCampaign({
    config: sampleCampaignConfig(),
    records: loadAdapterBatch(),
    pack,
    runContext: {
      runId: 'run_no_catalog',
      adapterId: 'nara-catalog-v1',
      startedAt: FIXED_NOW,
    },
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });
  assert.equal(result.catalogMatchSummary, undefined);
  assert.equal(result.reviewQueueItems, undefined);
  for (const candidate of result.candidates) {
    assert.equal(candidate.catalogMatch, undefined);
  }
});

test('catalog propose-match attaches selectedEntityId for a trusted-identifier hit', () => {
  const candidate = lowAuthorityCandidate({
    adapterRecord: {
      ...lowAuthorityCandidate().adapterRecord,
      title: 'Someone Else Entirely',
      classification: 'self_published',
      payload: {
        ...lowAuthorityCandidate().adapterRecord.payload,
        name: 'Jon Smith',
        kind: 'person',
        identifiers: { wikidata: 'Q999' },
      },
    },
  });
  const profiles: readonly ResolutionProfile[] = [
    {
      entity: entity('person-name-lookalike', 'person', 'John Smith', {
        person: { livingStatus: 'unknown' },
      }),
    },
    {
      entity: entity('person-identifier-match', 'person', 'Someone Else Entirely', {
        person: { livingStatus: 'unknown' },
        identifiers: [{ system: 'wikidata', value: 'Q999' }],
      }),
    },
  ];
  const attached = attachCatalogMatch(candidate, { profiles }, FIXED_NOW);
  assert.equal(attached.resolution.outcome, 'proposed_match');
  assert.equal(attached.candidate.catalogMatch?.outcome, 'proposed_match');
  assert.equal(attached.candidate.catalogMatch?.selectedEntityId, 'person-identifier-match');
  assert.equal(attached.reviewItem, undefined);
});

test('attachCatalogMatch never selects an entity on no_match and never publishes', () => {
  const candidate = lowAuthorityCandidate({
    adapterRecord: {
      ...lowAuthorityCandidate().adapterRecord,
      title: 'Completely unrelated newsletter blurb',
      payload: {
        ...lowAuthorityCandidate().adapterRecord.payload,
        name: 'Completely unrelated newsletter blurb',
      },
    },
  });
  const profiles: readonly ResolutionProfile[] = [
    { entity: entity('person-other', 'person', 'Rosa Parks') },
  ];
  const attached = attachCatalogMatch(candidate, { profiles }, FIXED_NOW);
  assert.equal(attached.resolution.outcome, 'no_match');
  assert.equal(attached.candidate.catalogMatch?.outcome, 'no_match');
  assert.equal(attached.candidate.catalogMatch?.selectedEntityId, undefined);
  assert.equal(attached.reviewItem, undefined);
  assert.notEqual(attached.candidate.status, 'published' as never);
});

test('ambiguous catalog matches produce a review queue item without selecting an entity', () => {
  const candidate = lowAuthorityCandidate({
    adapterRecord: {
      ...lowAuthorityCandidate().adapterRecord,
      title: 'Alex Johnson',
      payload: {
        ...lowAuthorityCandidate().adapterRecord.payload,
        name: 'Alex Johnson',
        kind: 'person',
      },
    },
  });
  const profiles: readonly ResolutionProfile[] = [
    { entity: entity('person-alex-a', 'person', 'Alex Johnson') },
    { entity: entity('person-alex-b', 'person', 'Alex Johnson') },
  ];
  const attached = attachCatalogMatch(candidate, { profiles }, FIXED_NOW);
  assert.equal(attached.resolution.outcome, 'review_required');
  assert.equal(attached.candidate.catalogMatch?.selectedEntityId, undefined);
  assert.ok(attached.reviewItem);
  assert.equal(attached.reviewItem!.status, 'pending');
  assert.ok(attached.reviewItem!.proposedEntityIds.length >= 2);
});

test('isAuthorityHost and normalizeAuthorityUrl gate the allowlist', () => {
  assert.equal(isAuthorityHost('www.nps.gov'), true);
  assert.equal(isAuthorityHost('nmaahc.si.edu'), true);
  assert.equal(isAuthorityHost('instagram.com'), false);
  const cleaned = normalizeAuthorityUrl(
    'https://www.nps.gov/yose/learn/historyculture/buffalo-soldiers.htm?utm_source=abs#section',
  );
  assert.ok(cleaned);
  assert.equal(cleaned!.host, 'nps.gov');
  assert.ok(!cleaned!.url.includes('utm_'));
  assert.ok(!cleaned!.url.includes('#'));
  assert.equal(normalizeAuthorityUrl('https://example.com/page'), undefined);
});

test('authority harvest extracts NPS/NMAAHC leads from ABS-shaped low-authority candidate', () => {
  const candidate = lowAuthorityCandidate();
  const leads = harvestAuthorityFollowUpsForCandidate({
    candidate,
    harvestedAt: FIXED_NOW,
    sourceText: `
      <p>Courtesy of the <a href="https://www.nps.gov/havo/learn/historyculture/buffalo-soldiers.htm">National Park Service</a></p>
      <p>Also <a href="https://buffalosoldiersmuseum.org/">museum</a> and <a href="https://twitter.com/x">social</a></p>
    `,
  });
  const hosts = new Set(leads.map((lead) => lead.host));
  assert.ok(hosts.has('nps.gov'));
  assert.ok(hosts.has('nmaahc.si.edu'));
  assert.ok(!hosts.has('instagram.com'));
  assert.ok(!hosts.has('twitter.com'));
  assert.ok(!hosts.has('buffalosoldiersmuseum.org')); // not on curated allowlist
  assert.ok(leads.every((lead) => lead.reason === 'authority_host_allowlist'));
  assert.ok(leads.every((lead) => lead.parentCandidateId === candidate.id));
});

test('authority harvest skips non-low-authority candidates', () => {
  const candidate = lowAuthorityCandidate({
    adapterRecord: {
      ...lowAuthorityCandidate().adapterRecord,
      classification: 'primary_archival',
    },
  });
  const leads = harvestAuthorityFollowUpsForCandidate({
    candidate,
    harvestedAt: FIXED_NOW,
  });
  assert.equal(leads.length, 0);
});

test('campaign with authorityHarvest.enabled returns follow-ups for low-authority survivors', () => {
  const pack = loadQueryPack();
  const candidateRecord = lowAuthorityCandidate().adapterRecord;
  const result = runDiscoveryCampaign({
    config: sampleCampaignConfig(),
    records: [candidateRecord],
    pack,
    runContext: {
      runId: 'run_harvest',
      adapterId: 'rss',
      startedAt: FIXED_NOW,
    },
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
    authorityHarvest: { enabled: true },
  });
  assert.ok(result.authorityFollowUps);
  assert.ok(result.authorityFollowUps!.some((lead) => lead.host === 'nps.gov'));
});
