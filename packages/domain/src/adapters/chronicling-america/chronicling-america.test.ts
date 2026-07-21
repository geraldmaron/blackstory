/**
 * Tests for the Chronicling America fixtures-first adapter.
 * Exercises loc.gov JSON search/item parsing, export filtering, retention, and
 * disabled-by-default registry registration. No live LoC network calls.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  approveSourcePolicy,
  createInMemorySourceRegistry,
  type SourceRegistryEntry,
} from '../index.js';
import {
  CHRONICLING_AMERICA_ADAPTER_ID,
  CHRONICLING_AMERICA_CAMPAIGN_BUDGET,
  CHRONICLING_AMERICA_KILL_SWITCH_PREFIX,
  buildChroniclingAmericaSearchUrl,
  chroniclingAmericaAdapterDefinition,
  chroniclingAmericaKillSwitchId,
  createChroniclingAmericaAdapterContract,
  extractLccnFromLocUrl,
  filterLargeExportPayload,
  normalizeChroniclingAmericaBatch,
  parseChroniclingAmericaFixtureBatch,
  parseChroniclingAmericaItemResponse,
  parseChroniclingAmericaKillSwitchId,
  parseChroniclingAmericaSearchFixture,
  parseChroniclingAmericaSearchResponse,
  qualifiesForCandidateRetention,
  registerChroniclingAmericaSource,
} from './index.js';

const FIXED_NOW = '2026-07-21T17:00:00.000Z';
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8')) as T;
}

function approvedRegistryEntry(): SourceRegistryEntry {
  const store = createInMemorySourceRegistry();
  const entry = registerChroniclingAmericaSource(store, { createdAt: FIXED_NOW });
  return approveSourcePolicy(store, {
    id: entry.id,
    approvedBy: 'admin@blackbook.local',
    approvedAt: FIXED_NOW,
  });
}

test('Chronicling America adapter starts disabled by default in the registry', () => {
  const store = createInMemorySourceRegistry();
  const entry = registerChroniclingAmericaSource(store, { createdAt: FIXED_NOW });
  assert.equal(entry.registryState, 'disabled');
  assert.equal(entry.evidenceSource.adapterEnabled, false);
  const approved = approveSourcePolicy(store, {
    id: entry.id,
    approvedBy: 'admin@blackbook.local',
    approvedAt: FIXED_NOW,
  });
  assert.equal(approved.registryState, 'approved');
});

test('Chronicling America adapter id is distinct from the federal LoC adapter id', async () => {
  const federal = await import('../federal/index.js');
  assert.notEqual(CHRONICLING_AMERICA_ADAPTER_ID, federal.LOC_ADAPTER_ID);
  assert.equal(CHRONICLING_AMERICA_ADAPTER_ID, 'chronicling-america-v1');
});

test('Chronicling America adapter exposes contract, rights, rate limits, and kill switch', () => {
  const definition = chroniclingAmericaAdapterDefinition;
  assert.ok(definition.contract.rateLimits.requestsPerMinute > 0);
  assert.ok(definition.rights.publicationPermissions.length > 0);
  assert.ok(definition.killSwitchId.startsWith(CHRONICLING_AMERICA_KILL_SWITCH_PREFIX));
  assert.equal(definition.killSwitchId, chroniclingAmericaKillSwitchId(definition.adapterId));
  assert.equal(parseChroniclingAmericaKillSwitchId(definition.killSwitchId), definition.adapterId);
  assert.equal(createChroniclingAmericaAdapterContract().adapterId, CHRONICLING_AMERICA_ADAPTER_ID);
});

test('parses loc.gov search fixture and rejects non-qualifying records', () => {
  const batch = parseChroniclingAmericaSearchResponse(loadFixture('search-response-sample.json'));
  assert.equal(batch.docs.length, 1);
  assert.equal(batch.docs[0]?.lccn, 'sn83045462');
  assert.equal(batch.docs[0]?.publicationTitle, 'The Chicago Defender');
  assert.equal(batch.rejected.length, 1);
  assert.equal(batch.rejected[0]?.reason, 'missing_canonical_url');
  assert.equal(batch.paginationTotal, 42);
});

test('parses loc.gov item fixture into a normalized doc', () => {
  const batch = parseChroniclingAmericaItemResponse(loadFixture('item-response-sample.json'));
  assert.equal(batch.docs.length, 1);
  assert.equal(batch.docs[0]?.title, 'The Chicago defender.');
  assert.equal(batch.docs[0]?.lccn, 'sn83045462');
  assert.equal(batch.docs[0]?.canonicalUrl, 'https://www.loc.gov/item/sn83045462/');
});

test('search URL builder targets the chronicling-america collection with json format', () => {
  const url = buildChroniclingAmericaSearchUrl('african american newspaper');
  assert.ok(url.startsWith('https://www.loc.gov/collections/chronicling-america/'));
  assert.ok(url.includes('fo=json'));
  assert.ok(url.includes('q=african+american+newspaper'));
});

test('extracts LCCN from loc.gov resource and item URLs', () => {
  assert.equal(
    extractLccnFromLocUrl('https://www.loc.gov/resource/sn83045462/1922-12-26/ed-1/?sp=22'),
    'sn83045462',
  );
  assert.equal(extractLccnFromLocUrl('https://www.loc.gov/item/sn83045462/'), 'sn83045462');
});

test('export batch parser strips OCR bulk and rejects short titles', () => {
  const entry = approvedRegistryEntry();
  const result = parseChroniclingAmericaFixtureBatch(
    chroniclingAmericaAdapterDefinition,
    entry,
    'run_ca',
    FIXED_NOW,
    loadFixture('export-batch-sample.json'),
  );

  assert.equal(result.candidates.length, 1);
  assert.equal(result.filteredExportCount, 1);
  assert.equal(result.candidates[0]?.payload?.full_text, undefined);
  assert.equal(result.candidates[0]?.stableIdentifier, 'ca:sn83045462:1922-12-26:ed-1:sp=22');
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0]?.reason, 'title_too_short');
});

test('search fixture end-to-end produces stamped candidates without OCR bulk', () => {
  const entry = approvedRegistryEntry();
  const result = parseChroniclingAmericaSearchFixture(
    chroniclingAmericaAdapterDefinition,
    entry,
    'run_ca_search',
    FIXED_NOW,
    loadFixture('search-response-sample.json'),
  );

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.provenance.adapterId, CHRONICLING_AMERICA_ADAPTER_ID);
  assert.equal(result.candidates[0]?.payload?.full_text, undefined);
  assert.ok(result.rejected.some((record) => record.reason === 'missing_canonical_url'));
});

test('normalizer stamps AdapterCandidateRecord with capped summary', () => {
  const entry = approvedRegistryEntry();
  const batch = parseChroniclingAmericaSearchResponse(loadFixture('search-response-sample.json'));
  const candidates = normalizeChroniclingAmericaBatch({
    docs: batch.docs,
    registryEntry: entry,
    runId: 'run_norm',
    capturedAt: FIXED_NOW,
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.payload.schemaVersion, 'chronicling-america-payload.v1');
  assert.ok((candidates[0]?.payload.summary?.length ?? 0) <= 320);
});

test('retention gate rejects records missing required canonical URL', () => {
  const gate = qualifiesForCandidateRetention(
    { stableIdentifier: 'ca:x', title: 'Valid title', classification: 'primary_archival' },
    chroniclingAmericaAdapterDefinition.retention,
  );
  assert.equal(gate.qualified, false);
  if (!gate.qualified) {
    assert.equal(gate.reason, 'missing_canonical_url');
  }
});

test('export filter policy strips configured bulk keys', () => {
  const filtered = filterLargeExportPayload(
    {
      stableIdentifier: 'ca:test',
      title: 'Sample',
      canonicalUrl: 'https://www.loc.gov/item/sn83045462/',
      full_text: 'x'.repeat(10_000),
      lccn: 'sn83045462',
    },
    chroniclingAmericaAdapterDefinition.exportFilter,
  );
  assert.equal(filtered.filtered, true);
  assert.equal(filtered.payload.full_text, undefined);
  assert.equal(filtered.payload.lccn, 'sn83045462');
});

test('campaign budget defaults align with discovery roster caps (500 / 40 / 10 / retries 2)', () => {
  assert.equal(CHRONICLING_AMERICA_CAMPAIGN_BUDGET.maxCandidates, 500);
  assert.equal(CHRONICLING_AMERICA_CAMPAIGN_BUDGET.maxQuarantined, 40);
  assert.equal(CHRONICLING_AMERICA_CAMPAIGN_BUDGET.maxDeadLetter, 10);
  assert.equal(CHRONICLING_AMERICA_CAMPAIGN_BUDGET.maxRetriesPerCandidate, 2);
});
