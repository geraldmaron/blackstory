/**
 * Tests for the DPLA v2 community discovery adapter. Fixture-driven; every HTTP call
 * goes through a mock SafeHttpClient injected by the test, never a real fetch or a real key.
 * Exercises both DPLA's current response shape and a plausible post-transition (Cleveland
 * Public Library) shape to prove the defensive parser tolerates the coming endpoint churn.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import type { EvidenceSource } from '../../provenance/source.js';
import {
  createInMemoryObligationsRegistry,
  defaultSourceObligationsSeed,
  getSourceObligationsOrThrow,
} from '../../rights/index.js';
import {
  approveSourcePolicy,
  createInMemorySourceRegistry,
  registerSource,
  type SourceRegistryEntry,
} from '../index.js';
import type { SafeHttpResponse } from '../internet-archive/shared/http-port.js';
import {
  buildDplaCanonicalUrl,
  buildDplaSearchUrl,
  createDplaV2AdapterContract,
  DPLA_V2_ADAPTER_ID,
  DPLA_V2_DEFAULT_CLASSIFICATION,
  fetchDplaSearch,
  normalizeDplaBatch,
  parseDplaSearchResponse,
} from './index.js';

const FIXED_NOW = '2026-07-17T20:00:00.000Z';
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const FAKE_API_KEY = 'test-deterministic-dpla-key';

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8')) as T;
}

function dplaRegistryEntry(): SourceRegistryEntry {
  const contract = createDplaV2AdapterContract();
  const evidenceSource: EvidenceSource = {
    id: 'src_dpla_v2',
    organizationId: 'org_community',
    displayName: 'DPLA v2 Discovery',
    classification: contract.classification,
    adapterId: DPLA_V2_ADAPTER_ID,
    stableIdScheme: contract.stableIdScheme,
    policy: contract.policy,
    adapterEnabled: true,
    killSwitchId: 'adapter:dpla',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  return {
    id: 'reg_dpla_v2',
    contract,
    evidenceSource,
    registryState: 'approved',
    approvedAt: FIXED_NOW,
    approvedBy: 'admin@blackbook.local',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

test('DPLA v2 adapter starts disabled by default in the  registry', () => {
  const store = createInMemorySourceRegistry();
  const contract = createDplaV2AdapterContract();
  registerSource(store, {
    id: 'reg_dpla',
    contract,
    evidenceSource: {
      id: 'src_dpla_v2',
      displayName: 'DPLA v2 Discovery',
      classification: contract.classification,
      adapterId: DPLA_V2_ADAPTER_ID,
      stableIdScheme: contract.stableIdScheme,
      policy: contract.policy,
      adapterEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    createdAt: FIXED_NOW,
  });
  assert.equal(store.get('reg_dpla')?.registryState, 'disabled');
  const approved = approveSourcePolicy(store, {
    id: 'reg_dpla',
    approvedBy: 'admin@blackbook.local',
    approvedAt: FIXED_NOW,
  });
  assert.equal(approved.registryState, 'approved');
});

test('DPLA v2 adapter id is distinct from the fixture-only federal DPLA adapter id', async () => {
  const federal = await import('../federal/index.js');
  assert.notEqual(DPLA_V2_ADAPTER_ID, federal.DPLA_ADAPTER_ID);
});

test('DPLA v2 adapter has a registered  obligations entry', () => {
  const obligationsStore = createInMemoryObligationsRegistry(
    defaultSourceObligationsSeed(FIXED_NOW),
  );
  const obligations = getSourceObligationsOrThrow(obligationsStore, DPLA_V2_ADAPTER_ID);
  assert.equal(obligations.sourceClass, 'dpla');
  assert.equal(obligations.livenessRecheckRequired, true);
});

test('parses the current DPLA v2 response shape (array/object title, date object, subject objects)', () => {
  const batch = parseDplaSearchResponse(loadFixture('search-response-current-shape.json'));
  assert.equal(batch.docs.length, 2);
  assert.equal(batch.docs[0]?.title, 'Piedmont County Colored School, class photograph, 1931');
  assert.equal(batch.docs[0]?.displayDate, '1931');
  assert.deepEqual(batch.docs[0]?.subjects, ['Schools', 'Piedmont County']);
  assert.equal(batch.docs[0]?.providerName, 'State Digital Library');
  assert.equal(
    batch.docs[1]?.title,
    'Rosewood Baptist Church cornerstone dedication program, 1949',
  );
  // doc[1] has neither `provider` nor `dataProvider` in the fixture providerName stays absent.
  assert.equal(batch.docs[1]?.providerName, undefined);
});

test('tolerates a plausible post-transition (Cleveland Public Library) response shape', () => {
  const batch = parseDplaSearchResponse(loadFixture('search-response-post-transition-shape.json'));
  assert.equal(batch.docs.length, 1);
  assert.equal(batch.rejected.length, 1);
  assert.equal(batch.rejected[0]?.reason, 'missing_title');
  assert.equal(batch.docs[0]?.id, 'cpl-0001');
  assert.equal(batch.docs[0]?.title, "Cross County Freedmen's School ledger, 1867-1869");
  assert.equal(
    batch.docs[0]?.isShownAt,
    'https://digital.crosscounty.example.gov/items/freedmens-school-ledger',
  );
  assert.equal(batch.docs[0]?.providerName, 'Cross County Public Library');
});

test('rejects records missing both id fields, and a wholly non-object response throws', () => {
  const batch = parseDplaSearchResponse({ docs: [{ no_id: true, title: 'x' }] });
  assert.equal(batch.docs.length, 0);
  assert.equal(batch.rejected[0]?.reason, 'missing_id');
  assert.throws(() => parseDplaSearchResponse('not an object'), /must be an object/);
});

test('normalizes docs with a reputable_secondary default classification and capped snippet', () => {
  const entry = dplaRegistryEntry();
  const batch = parseDplaSearchResponse(loadFixture('search-response-current-shape.json'));
  const candidates = normalizeDplaBatch({
    docs: batch.docs,
    registryEntry: entry,
    runId: 'run_dpla_1',
    capturedAt: FIXED_NOW,
  });

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.classification, DPLA_V2_DEFAULT_CLASSIFICATION);
  assert.equal(candidates[0]?.canonicalUrl, buildDplaCanonicalUrl(batch.docs[0]!));
  assert.ok(candidates[0]?.payload.summary!.length <= 320);
  assert.equal('fullText' in candidates[0]!.payload, false);
  assert.equal(candidates[0]?.provenance.adapterId, DPLA_V2_ADAPTER_ID);
});

test('canonical URL falls back to a dp.la item page when isShownAt is absent', () => {
  const url = buildDplaCanonicalUrl({ id: 'xyz-123', title: 'Untitled' });
  assert.equal(url, 'https://dp.la/item/xyz-123');
});

test('fetchDplaSearch requires a non-empty API key and never hardcodes one', async () => {
  const entry = dplaRegistryEntry();
  const client = async (): Promise<SafeHttpResponse> => ({
    status: 200,
    headers: { 'content-type': 'application/json' },
    bodyText: JSON.stringify(loadFixture('search-response-current-shape.json')),
    finalUrl: '',
  });
  await assert.rejects(
    () =>
      fetchDplaSearch({
        query: 'x',
        apiKey: '',
        registryEntry: entry,
        runId: 'r',
        capturedAt: FIXED_NOW,
        client,
      }),
    /DPLA_API_KEY is required/,
  );
});

test('fetchDplaSearch goes through the injected SafeHttpClient (mock, no live network) with a deterministic fake key', async () => {
  const entry = dplaRegistryEntry();
  let capturedUrl = '';
  const client = async (request: { url: string }): Promise<SafeHttpResponse> => {
    capturedUrl = request.url;
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify(loadFixture('search-response-current-shape.json')),
      finalUrl: request.url,
    };
  };
  const candidates = await fetchDplaSearch({
    query: 'Piedmont County',
    apiKey: FAKE_API_KEY,
    registryEntry: entry,
    runId: 'run_1',
    capturedAt: FIXED_NOW,
    client,
  });
  assert.equal(candidates.length, 2);
  assert.ok(capturedUrl.includes(`api_key=${FAKE_API_KEY}`));
  assert.equal(new URL(capturedUrl).hostname, 'api.dp.la');
});

test('buildDplaSearchUrl builds a well-formed api.dp.la/v2 URL', () => {
  const url = buildDplaSearchUrl({
    query: 'Rosewood',
    apiKey: FAKE_API_KEY,
    page: 2,
    pageSize: 25,
  });
  const parsed = new URL(url);
  assert.equal(parsed.pathname, '/v2/items');
  assert.equal(parsed.searchParams.get('page'), '2');
  assert.equal(parsed.searchParams.get('page_size'), '25');
});
