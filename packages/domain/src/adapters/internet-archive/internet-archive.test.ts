/**
 * Tests for the Internet Archive community discovery adapter (BB-073). Fixture-driven; every
 * HTTP call goes through a mock SafeHttpClient injected by the test, never a real fetch.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import type { EvidenceSource } from '../../provenance/source.js';
import { createInMemoryObligationsRegistry, defaultSourceObligationsSeed, getSourceObligationsOrThrow } from '../../rights/index.js';
import { approveSourcePolicy, createInMemorySourceRegistry, registerSource, type SourceRegistryEntry } from '../index.js';
import type { SafeHttpResponse } from './shared/http-port.js';
import {
  buildAdvancedSearchUrl,
  buildInternetArchiveCanonicalUrl,
  createInternetArchiveAdapterContract,
  fetchAdvancedSearch,
  fetchMetadata,
  fetchScrapeAll,
  hasNextScrapePage,
  INTERNET_ARCHIVE_ADAPTER_ID,
  INTERNET_ARCHIVE_DEFAULT_CLASSIFICATION,
  normalizeInternetArchiveBatch,
  parseAdvancedSearchResponse,
  parseMetadataResponse,
  parseScrapeResponse,
} from './index.js';

const FIXED_NOW = '2026-07-17T20:00:00.000Z';
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8')) as T;
}

function iaRegistryEntry(): SourceRegistryEntry {
  const contract = createInternetArchiveAdapterContract();
  const evidenceSource: EvidenceSource = {
    id: 'src_internet_archive',
    organizationId: 'org_community',
    displayName: 'Internet Archive Discovery',
    classification: contract.classification,
    adapterId: INTERNET_ARCHIVE_ADAPTER_ID,
    stableIdScheme: contract.stableIdScheme,
    policy: contract.policy,
    adapterEnabled: true,
    killSwitchId: 'adapter:internet_archive',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  return {
    id: 'reg_internet_archive',
    contract,
    evidenceSource,
    registryState: 'approved',
    approvedAt: FIXED_NOW,
    approvedBy: 'admin@blackbook.local',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

test('Internet Archive adapter starts disabled by default in the BB-037 registry', () => {
  const store = createInMemorySourceRegistry();
  const contract = createInternetArchiveAdapterContract();
  registerSource(store, {
    id: 'reg_ia',
    contract,
    evidenceSource: {
      id: 'src_internet_archive',
      displayName: 'Internet Archive Discovery',
      classification: contract.classification,
      adapterId: INTERNET_ARCHIVE_ADAPTER_ID,
      stableIdScheme: contract.stableIdScheme,
      policy: contract.policy,
      adapterEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    createdAt: FIXED_NOW,
  });
  assert.equal(store.get('reg_ia')?.registryState, 'disabled');
  const approved = approveSourcePolicy(store, { id: 'reg_ia', approvedBy: 'admin@blackbook.local', approvedAt: FIXED_NOW });
  assert.equal(approved.registryState, 'approved');
});

test('Internet Archive adapter has a registered BB-077 obligations entry', () => {
  const obligationsStore = createInMemoryObligationsRegistry(defaultSourceObligationsSeed(FIXED_NOW));
  const obligations = getSourceObligationsOrThrow(obligationsStore, INTERNET_ARCHIVE_ADAPTER_ID);
  assert.equal(obligations.sourceClass, 'internet_archive');
  assert.equal(obligations.livenessRecheckRequired, true);
  assert.equal(obligations.livenessRecheckIntervalDays, 90);
});

test('parses Advanced Search JSON output', () => {
  const raw = loadFixture('advanced-search-response.json');
  const batch = parseAdvancedSearchResponse(raw);
  assert.equal(batch.docs.length, 2);
  assert.equal(batch.docs[0]?.identifier, 'piedmont-county-directory-1923');
  assert.equal(batch.rejected.length, 0);
});

test('cursor-based Scrape API pagination rejects malformed entries without poisoning the batch', () => {
  const page1 = parseScrapeResponse(loadFixture('scrape-response-page1.json'));
  assert.equal(page1.docs.length, 1);
  assert.equal(page1.rejected.length, 1);
  assert.equal(page1.rejected[0]?.reason, 'missing_identifier');
  assert.equal(page1.cursor, 'cursor_page_2');
  assert.equal(hasNextScrapePage(page1), true);

  const page2 = parseScrapeResponse(loadFixture('scrape-response-page2.json'));
  assert.equal(page2.docs.length, 1);
  assert.equal(hasNextScrapePage(page2), false);
});

test('parses the Metadata API response defensively', () => {
  const doc = parseMetadataResponse(loadFixture('metadata-response.json'));
  assert.ok(doc);
  assert.equal(doc?.identifier, 'piedmont-county-directory-1923');
  assert.equal(parseMetadataResponse({ no: 'metadata key' }), undefined);
  assert.equal(parseMetadataResponse(null), undefined);
});

test('normalizes docs with a low-authority default classification, capped snippet, no full-page fields', () => {
  const entry = iaRegistryEntry();
  const batch = parseAdvancedSearchResponse(loadFixture('advanced-search-response.json'));
  const candidates = normalizeInternetArchiveBatch({
    docs: batch.docs,
    registryEntry: entry,
    runId: 'run_ia_1',
    capturedAt: FIXED_NOW,
  });

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.classification, INTERNET_ARCHIVE_DEFAULT_CLASSIFICATION);
  assert.equal(candidates[0]?.canonicalUrl, buildInternetArchiveCanonicalUrl('piedmont-county-directory-1923'));
  assert.ok(candidates[0]?.payload.summary!.length <= 320);
  assert.equal('fullText' in candidates[0]!.payload, false);
  assert.equal('body' in candidates[0]!.payload, false);
  assert.equal(candidates[0]?.provenance.adapterId, INTERNET_ARCHIVE_ADAPTER_ID);
});

test('buildAdvancedSearchUrl produces a well-formed query URL', () => {
  const url = buildAdvancedSearchUrl('subject:"Piedmont County"', 25, 2);
  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'archive.org');
  assert.equal(parsed.searchParams.get('rows'), '25');
  assert.equal(parsed.searchParams.get('page'), '2');
});

test('fetchAdvancedSearch goes through the injected SafeHttpClient (mock, no live network)', async () => {
  const entry = iaRegistryEntry();
  let calls = 0;
  const client = async (): Promise<SafeHttpResponse> => {
    calls += 1;
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify(loadFixture('advanced-search-response.json')),
      finalUrl: 'https://archive.org/advancedsearch.php?q=test',
    };
  };
  const candidates = await fetchAdvancedSearch({
    query: 'subject:"Piedmont County"',
    registryEntry: entry,
    runId: 'run_1',
    capturedAt: FIXED_NOW,
    client,
  });
  assert.equal(calls, 1);
  assert.equal(candidates.length, 2);
});

test('fetchScrapeAll follows the cursor across pages and stops when the cursor disappears', async () => {
  const entry = iaRegistryEntry();
  const pages = [loadFixture('scrape-response-page1.json'), loadFixture('scrape-response-page2.json')];
  let callIndex = 0;
  const client = async (): Promise<SafeHttpResponse> => {
    const page = pages[callIndex];
    callIndex += 1;
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify(page),
      finalUrl: 'https://archive.org/services/search/v1/scrape',
    };
  };
  const candidates = await fetchScrapeAll({
    query: 'collection:state_library_archive',
    registryEntry: entry,
    runId: 'run_scrape',
    capturedAt: FIXED_NOW,
    client,
  });
  assert.equal(callIndex, 2);
  assert.equal(candidates.length, 2);
});

test('fetchMetadata retries on 429 before succeeding', async () => {
  const entry = iaRegistryEntry();
  let attempts = 0;
  const client = async (): Promise<SafeHttpResponse> => {
    attempts += 1;
    if (attempts < 2) {
      return { status: 429, headers: { 'content-type': 'application/json' }, bodyText: '{}', finalUrl: '' };
    }
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify(loadFixture('metadata-response.json')),
      finalUrl: '',
    };
  };
  const candidate = await fetchMetadata({
    identifier: 'piedmont-county-directory-1923',
    registryEntry: entry,
    runId: 'run_meta',
    capturedAt: FIXED_NOW,
    client,
  });
  assert.equal(attempts, 2);
  assert.equal(candidate?.stableIdentifier, 'internet-archive:piedmont-county-directory-1923');
});

test('rejects a response whose content type is outside the allowlist', async () => {
  const entry = iaRegistryEntry();
  const client = async (): Promise<SafeHttpResponse> => ({
    status: 200,
    headers: { 'content-type': 'text/html' },
    bodyText: '<html></html>',
    finalUrl: '',
  });
  await assert.rejects(
    () => fetchAdvancedSearch({ query: 'x', registryEntry: entry, runId: 'run', capturedAt: FIXED_NOW, client }),
    /content type/,
  );
});
