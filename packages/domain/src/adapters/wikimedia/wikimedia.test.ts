/**
 * Tests for Wikimedia discovery adapter. Fixture-driven; no live network.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import type { EvidenceSource } from '../../provenance/source.js';
import type { SourceRegistryEntry } from '../types.js';
import {
  assertCategoryGatePassed,
  assertSearchSnippetsNotCopied,
  buildApiFetchFromFixtures,
  candidatesEquivalent,
  createWikimediaAdapterContract,
  evaluateCategoryGate,
  normalizeWikimediaApiFetch,
  normalizeWikimediaBulkBatch,
  parseMediaWikiSearchResponse,
  parseWikimediaBulkBatch,
  routeExternalReferenceUrl,
  WIKIMEDIA_ADAPTER_ID,
} from './index.js';

const FIXED_NOW = '2026-07-16T20:00:00.000Z';
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8')) as T;
}

function wikimediaRegistryEntry(): SourceRegistryEntry {
  const contract = createWikimediaAdapterContract();
  const evidenceSource: EvidenceSource = {
    id: 'src_wikimedia',
    organizationId: 'org_wikimedia',
    displayName: 'Wikimedia Discovery',
    classification: contract.classification,
    adapterId: WIKIMEDIA_ADAPTER_ID,
    stableIdScheme: contract.stableIdScheme,
    policy: contract.policy,
    adapterEnabled: true,
    killSwitchId: 'source-adapter-wikimedia-discovery-v1',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };

  return {
    id: 'reg_wikimedia',
    contract,
    evidenceSource,
    registryState: 'approved',
    approvedAt: FIXED_NOW,
    approvedBy: 'admin@blackbook.local',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

test('category membership does not automatically include reference-only pages', () => {
  const gate = evaluateCategoryGate({
    pageCategories: ['Category:Births by year'],
  });
  assert.equal(gate.passed, false);
  assert.deepEqual(gate.matchedSeedCategories, []);
  assert.throws(() => assertCategoryGatePassed(gate), /seed category required/);
});

test('seed category membership passes explicit gate', () => {
  const gate = evaluateCategoryGate({
    pageCategories: ['Category:African-American activists', 'Category:Births by year'],
  });
  assert.equal(gate.passed, true);
  assert.ok(gate.matchedSeedCategories.includes('Category:African-American activists'));
  assert.doesNotThrow(() => assertCategoryGatePassed(gate));
});

test('MediaWiki search parsing stays fixture-driven', () => {
  const raw = loadFixture('mediawiki-search-response.json');
  const hits = parseMediaWikiSearchResponse(raw);
  assert.equal(hits.length, 2);
  assert.equal(hits[0]?.pageid, 5045871);
});

test('API and bulk modes produce equivalent normalized contracts', () => {
  const entry = wikimediaRegistryEntry();
  const context = {
    registryEntry: entry,
    runId: 'run_wikimedia_fixture',
    capturedAt: FIXED_NOW,
  };

  const apiFetch = buildApiFetchFromFixtures({
    project: 'en',
    pageRaw: loadFixture('mediawiki-page-response.json'),
    wikidataRaw: loadFixture('wikidata-entity-response.json'),
    wikidataId: 'Q41909',
  });
  const apiCandidate = normalizeWikimediaApiFetch(apiFetch, context);

  const bulkBatch = parseWikimediaBulkBatch(loadFixture('wikimedia-bulk-batch.json'));
  const bulkCandidates = normalizeWikimediaBulkBatch(bulkBatch, context);
  const bulkCandidate = bulkCandidates[0];
  assert.ok(bulkCandidate);

  assert.equal(apiCandidate.payload.ingestMode, 'api');
  assert.equal(bulkCandidate.payload.ingestMode, 'bulk');
  assert.ok(candidatesEquivalent(apiCandidate, bulkCandidate));

  assert.equal(apiCandidate.payload.includeProse, false);
  assertSearchSnippetsNotCopied(apiCandidate.payload as unknown as Record<string, unknown>);
  assert.equal(apiCandidate.payload.revisionId, 1239876543);
  assert.equal(apiCandidate.payload.wikidataId, 'Q41909');
  assert.ok(apiCandidate.payload.externalReferences.some((ref) => ref.system === 'VIAF'));
  assert.ok(apiCandidate.payload.aliases.includes('Rosa Louise McCauley Parks'));
  assert.ok(apiCandidate.payload.locations.length >= 1);
  assert.ok(apiCandidate.payload.relationships.some((rel) => rel.property === 'P737'));
  assert.equal(apiCandidate.provenance.adapterId, WIKIMEDIA_ADAPTER_ID);
});

test('bulk batch retains revision metadata and category gate outcomes', () => {
  const entry = wikimediaRegistryEntry();
  const bulkBatch = parseWikimediaBulkBatch(loadFixture('wikimedia-bulk-batch.json'));
  const candidates = normalizeWikimediaBulkBatch(bulkBatch, {
    registryEntry: entry,
    runId: 'run_bulk',
    capturedAt: FIXED_NOW,
  });

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.payload.categoryGate.passed, true);
  assert.equal(candidates[1]?.payload.categoryGate.passed, false);
  assert.equal(candidates[1]?.payload.revisionId, 555001);
});

test('external reference routing resolves known authority URLs', () => {
  assert.equal(routeExternalReferenceUrl('VIAF', '123456789'), 'https://viaf.org/viaf/123456789/');
  assert.equal(
    routeExternalReferenceUrl('LCCN', 'n79033051'),
    'https://id.loc.gov/authorities/n79033051',
  );
  assert.equal(routeExternalReferenceUrl('Unknown', 'abc'), undefined);
});
