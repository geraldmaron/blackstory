/**
 * Fixture-first tests for the County Archive Ladder discovery campaign.
 *
 * Proves: finding-aid candidates survive the pipeline, obscurity is attached to ranked leads,
 * the seed ships real archives, and the discovery publish guard holds — all without network I/O
 * or any publish path.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertDiscoveryCannotPublish } from './guard.js';
import {
  COUNTY_ARCHIVE_CAMPAIGN_KIND,
  loadStateArchiveSeed,
  runCountyArchiveCampaign,
} from './county-archive-campaign.js';
import { FINDING_AID_ADAPTER_ID } from '../adapters/finding-aid/index.js';
import type {
  FindingAidAdapter,
  FindingAidCandidateInput,
  FindingAidCollection,
  FindingAidSource,
} from '../adapters/finding-aid/index.js';

const FIXED_NOW = '2026-07-24T12:00:00.000Z';

const INLINE_SOURCES: readonly FindingAidSource[] = [
  {
    id: 'test-al',
    registryEntryId: 'reg_finding_aid_test_al',
    sourceId: 'src_finding_aid_test_al',
    organizationId: 'org_test_al',
    displayName: 'Test Alabama Archive',
    state: 'US-AL',
    findingAidBaseUrl: 'https://example.org/al/',
    protocol: 'ead-xml',
    sourceClass: 'scholarly',
    classification: 'primary_archival',
  },
  {
    id: 'test-ms',
    registryEntryId: 'reg_finding_aid_test_ms',
    sourceId: 'src_finding_aid_test_ms',
    organizationId: 'org_test_ms',
    displayName: 'Test Mississippi Archive',
    state: 'US-MS',
    findingAidBaseUrl: 'https://example.org/ms/',
    protocol: 'ead-xml',
    sourceClass: 'scholarly',
    classification: 'primary_archival',
  },
];

/** Deterministic inline harvester — no network. Keyed by state. */
function inlineAdapter(): FindingAidAdapter {
  const collectionsByState: Record<string, readonly FindingAidCollection[]> = {
    'US-AL': [
      {
        sourceId: 'src_finding_aid_test_al',
        collectionId: 'al-naacp-001',
        title: 'Montgomery County NAACP records',
        repository: 'Test Alabama Archive',
        state: 'US-AL',
        findingAidUrl: 'https://example.org/al/ead/al-naacp-001.xml',
      },
    ],
    'US-MS': [
      {
        sourceId: 'src_finding_aid_test_ms',
        collectionId: 'ms-church-002',
        title: 'Hinds County church leaders papers',
        repository: 'Test Mississippi Archive',
        state: 'US-MS',
        findingAidUrl: 'https://example.org/ms/ead/ms-church-002.xml',
      },
    ],
  };

  const candidatesByCollection: Record<string, readonly FindingAidCandidateInput[]> = {
    'al-naacp-001': [
      {
        title: 'Eliza W. Threadgill, founding secretary, Montgomery County NAACP',
        canonicalUrl: 'https://example.org/al/ead/al-naacp-001.xml#c01',
        repository: 'Test Alabama Archive',
        collectionId: 'al-naacp-001',
        state: 'Alabama',
        summary:
          'Correspondence of a local NAACP founding secretary in Montgomery County, Alabama, 1919-1934.',
        creator: 'Eliza W. Threadgill',
        coveragePeriod: '1919/1934',
        eadComponentId: 'c01',
      },
    ],
    'ms-church-002': [
      {
        title: 'Rev. J. T. Alcorn, pastor and Hinds County school-desegregation plaintiff',
        canonicalUrl: 'https://example.org/ms/ead/ms-church-002.xml#c03',
        repository: 'Test Mississippi Archive',
        collectionId: 'ms-church-002',
        state: 'Mississippi',
        summary:
          'Sermons and legal papers of a church leader named in a Hinds County, Mississippi desegregation suit, 1955-1968.',
        creator: 'Rev. J. T. Alcorn',
        coveragePeriod: '1955/1968',
        eadComponentId: 'c03',
      },
    ],
  };

  return {
    adapterId: FINDING_AID_ADAPTER_ID,
    listCollections(state) {
      return collectionsByState[state] ?? [];
    },
    extractCandidates(collection) {
      return candidatesByCollection[collection.collectionId] ?? [];
    },
  };
}

test('campaign yields finding-aid candidates from seeded archives', async () => {
  const result = await runCountyArchiveCampaign({
    adapter: inlineAdapter(),
    sources: INLINE_SOURCES,
    catalogTitles: ['Rosa Parks', 'Martin Luther King Jr.', 'Buffalo Soldiers'],
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });

  assert.equal(result.kind, COUNTY_ARCHIVE_CAMPAIGN_KIND);
  assert.equal(result.adapterId, FINDING_AID_ADAPTER_ID);
  assert.deepEqual([...result.sourceIds].sort(), [
    'src_finding_aid_test_al',
    'src_finding_aid_test_ms',
  ]);
  assert.ok(result.yield.survivors >= 2, 'expected at least two survivors');
  assert.equal(result.ranked.length, result.yield.survivors);

  const adapterIds = new Set(
    result.campaign.candidates.map((c) => c.adapterRecord.provenance.adapterId),
  );
  assert.ok(adapterIds.has(FINDING_AID_ADAPTER_ID));
});

test('obscurity assessment is attached to every ranked lead', async () => {
  const result = await runCountyArchiveCampaign({
    adapter: inlineAdapter(),
    sources: INLINE_SOURCES,
    catalogTitles: ['Rosa Parks', 'Martin Luther King Jr.'],
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });

  assert.ok(result.ranked.length >= 2);
  for (const lead of result.ranked) {
    assert.equal(lead.obscurity.methodologyVersion, 'obscurity.v1');
    assert.ok(lead.obscurity.score >= 0 && lead.obscurity.score <= 1);
    assert.ok(typeof lead.obscurity.band === 'string');
    assert.equal(lead.obscurity.candidateId, lead.candidateId);
    assert.ok(lead.repository, 'expected repository carried onto lead');
  }
  // Ranked descending by obscurity score.
  for (let i = 1; i < result.ranked.length; i += 1) {
    assert.ok(result.ranked[i - 1]!.obscurity.score >= result.ranked[i]!.obscurity.score);
  }
  assert.equal(result.disclaimer.id, 'methodology_obscurity_heuristic_v1');
});

test('discovery publish guard holds for County Archive Ladder', () => {
  assert.throws(
    () => assertDiscoveryCannotPublish({ operation: 'write_public_projection' }),
    /Discovery cannot publish/,
  );
  assert.throws(
    () => assertDiscoveryCannotPublish({ operation: 'activate_release', target: 'bb_public' }),
    /Discovery cannot publish/,
  );
  // Non-publish operations pass.
  assert.doesNotThrow(() => assertDiscoveryCannotPublish({ operation: 'score_obscurity' }));
});

test('shipped state-archive seed contains at least three real archives', () => {
  const seed = loadStateArchiveSeed();
  assert.ok(seed.length >= 3, 'expected >=3 seeded archives');
  for (const source of seed) {
    assert.equal(source.sourceClass, 'scholarly');
    assert.ok(source.state.startsWith('US-'));
    assert.doesNotThrow(() => new URL(source.findingAidBaseUrl));
  }
});
