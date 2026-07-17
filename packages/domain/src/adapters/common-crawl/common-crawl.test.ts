/**
 * Tests for the Common Crawl retrospective discovery adapter. Fixture-driven; every
 * HTTP call goes through a mock SafeHttpClient injected by the test, never a real fetch. Common
 * Crawl needs no storage-rights gate (unlike ../web-search/), but still starts disabled by
 * default in the registry and still routes discovered URLs through the Wayback capture
 * gate before ingestion.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import type { EvidenceSource } from '../../provenance/source.js';
import { buildQueryPack, parseQueryPackFixture } from '../../query-packs/pack.js';
import type { QueryPack } from '../../query-packs/types.js';
import { approveSourcePolicy, createInMemorySourceRegistry, registerSource, type SourceRegistryEntry } from '../index.js';
import type { SafeHttpRequest, SafeHttpResponse } from '../internet-archive/shared/http-port.js';
import {
  assertFilterPatternHasNoResearchOnlyOffensiveTerms,
  assertSeedGeographicLabelMatchesPack,
  buildCdxIndexUrl,
  buildCommonCrawlFilterPattern,
  buildCommonCrawlQueries,
  COMMON_CRAWL_ADAPTER_ID,
  COMMON_CRAWL_DEFAULT_CLASSIFICATION,
  createCommonCrawlAdapterContract,
  fetchCommonCrawlCdx,
  fetchCommonCrawlCdxBatch,
  ingestCommonCrawlCandidatesThroughPipeline,
  normalizeCdxRecord,
  parseCdxResponse,
  stampCommonCrawlQueryProvenance,
  COMMON_CRAWL_TERMS_VERSION,
} from './index.js';

const FIXED_NOW = '2026-07-17T20:00:00.000Z';
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixtureText(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf8');
}

function loadPack(): QueryPack {
  const raw = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'query-packs', 'fixtures', 'person-civil-rights-fixture.v1.json'),
      'utf8',
    ),
  ) as unknown;
  return parseQueryPackFixture(raw).pack;
}

function commonCrawlRegistryEntry(): SourceRegistryEntry {
  const contract = createCommonCrawlAdapterContract();
  const evidenceSource: EvidenceSource = {
    id: 'src_common_crawl',
    organizationId: 'org_community',
    displayName: 'Common Crawl Retrospective Discovery',
    classification: contract.classification,
    adapterId: COMMON_CRAWL_ADAPTER_ID,
    stableIdScheme: contract.stableIdScheme,
    policy: contract.policy,
    adapterEnabled: true,
    killSwitchId: 'adapter:common_crawl',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  return {
    id: 'reg_common_crawl',
    contract,
    evidenceSource,
    registryState: 'approved',
    approvedAt: FIXED_NOW,
    approvedBy: 'admin@blackbook.local',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

// ---------------------------------------------------------------------------------------------
// registry gate
// ---------------------------------------------------------------------------------------------

test('Common Crawl adapter starts disabled by default in the BB-037 registry', () => {
  const store = createInMemorySourceRegistry();
  const contract = createCommonCrawlAdapterContract();
  registerSource(store, {
    id: 'reg_cc',
    contract,
    evidenceSource: {
      id: 'src_common_crawl',
      displayName: 'Common Crawl Retrospective Discovery',
      classification: contract.classification,
      adapterId: COMMON_CRAWL_ADAPTER_ID,
      stableIdScheme: contract.stableIdScheme,
      policy: contract.policy,
      adapterEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    createdAt: FIXED_NOW,
  });
  assert.equal(store.get('reg_cc')?.registryState, 'disabled');
  const approved = approveSourcePolicy(store, { id: 'reg_cc', approvedBy: 'admin@blackbook.local', approvedAt: FIXED_NOW });
  assert.equal(approved.registryState, 'approved');
});

// ---------------------------------------------------------------------------------------------
// CDX client: URL building and defensive NDJSON parsing
// ---------------------------------------------------------------------------------------------

test('buildCdxIndexUrl produces a well-formed CDX query URL and requires crawlId/host', () => {
  const url = buildCdxIndexUrl({
    crawlId: 'CC-MAIN-2016-07',
    seed: { host: 'piedmontcountyhistory.example.org', matchType: 'domain', geographicLabel: 'Montgomery' },
    limit: 500,
    filterPattern: 'freedom|rider',
  });
  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'index.commoncrawl.org');
  assert.equal(parsed.pathname, '/CC-MAIN-2016-07-index');
  assert.equal(parsed.searchParams.get('url'), 'piedmontcountyhistory.example.org');
  assert.equal(parsed.searchParams.get('matchType'), 'domain');
  assert.equal(parsed.searchParams.get('output'), 'json');
  assert.equal(parsed.searchParams.get('filter'), '~url:freedom|rider');

  assert.throws(
    () => buildCdxIndexUrl({ crawlId: '', seed: { host: 'x', matchType: 'domain', geographicLabel: 'x' } }),
    /crawlId is required/,
  );
});

test('parseCdxResponse parses valid NDJSON lines, rejects malformed lines without throwing', () => {
  const batch = parseCdxResponse(loadFixtureText('cdx-response.ndjson'));
  assert.equal(batch.records.length, 2);
  assert.equal(batch.records[0]?.url, 'https://piedmontcountyhistory.example.org/freedom-riders');
  assert.equal(batch.rejected.length, 1);
  assert.equal(batch.rejected[0]?.reason, 'missing_required_field');
});

test('parseCdxResponse treats a "no captures found" response as zero records, not an error', () => {
  const batch = parseCdxResponse('No captures found for piedmontcountyhistory.example.org');
  assert.deepEqual(batch, { records: [], rejected: [] });
  const empty = parseCdxResponse('   ');
  assert.deepEqual(empty, { records: [], rejected: [] });
});

// ---------------------------------------------------------------------------------------------
// Query generation from packs -- researchOnlyOffensive filter
// ---------------------------------------------------------------------------------------------

test('buildCommonCrawlFilterPattern includes public-safe positive/alias/geographic terms and never a researchOnlyOffensive term', () => {
  const pack = loadPack();
  const pattern = buildCommonCrawlFilterPattern(pack);
  assert.ok(pattern);
  assert.match(pattern!, /montgomery/);
  assert.equal(pattern!.toLowerCase().includes('colored school'), false);
});

test('buildCommonCrawlFilterPattern excludes a researchOnlyOffensive term even when its class would otherwise qualify it', () => {
  // Unlike the gold fixture's `historical`-classed offensive term, this one is `geographic`-classed
  // -- geographic terms ARE included in the filter pattern by class, so this proves the
  // researchOnlyOffensive filter itself is doing the exclusion, not just class filtering.
  const pack = buildQueryPack({
    id: 'qp-offensive-geographic-class-test',
    displayName: 'Offensive geographic-class term test pack',
    entityKind: 'place',
    theme: 'historical_place',
    semver: '1.0.0',
    terms: [
      { text: 'Piedmont County', termClass: 'geographic' },
      { text: 'sundown town', termClass: 'geographic', researchOnlyOffensive: true },
    ],
    createdAt: FIXED_NOW,
  });
  const pattern = buildCommonCrawlFilterPattern(pack)!;
  assert.equal(pattern.toLowerCase().includes('sundown town'), false);
  assert.match(pattern, /piedmont county/);
});

test('assertFilterPatternHasNoResearchOnlyOffensiveTerms throws when offensive text is present', () => {
  const pack = loadPack();
  assert.throws(
    () => assertFilterPatternHasNoResearchOnlyOffensiveTerms('freedom|rider|colored school', pack),
    /researchOnlyOffensive term/,
  );
  assert.doesNotThrow(() => assertFilterPatternHasNoResearchOnlyOffensiveTerms('freedom|rider|montgomery', pack));
});

test('assertSeedGeographicLabelMatchesPack requires the seed to match a geographic term in the pack', () => {
  const pack = loadPack();
  assert.doesNotThrow(() =>
    assertSeedGeographicLabelMatchesPack({ host: 'x.example.org', matchType: 'domain', geographicLabel: 'Montgomery' }, pack),
  );
  assert.throws(
    () => assertSeedGeographicLabelMatchesPack({ host: 'x.example.org', matchType: 'domain', geographicLabel: 'Nowhereville' }, pack),
    /does not match any geographic term/,
  );
});

test('buildCommonCrawlQueries builds one query per crawlId x seedTarget pair', () => {
  const pack = loadPack();
  const queries = buildCommonCrawlQueries({
    pack,
    seedTargets: [
      { host: 'piedmontcountyhistory.example.org', matchType: 'domain', geographicLabel: 'Montgomery' },
      { host: 'alabamaarchives.example.gov', matchType: 'domain', geographicLabel: 'Alabama' },
    ],
    crawlIds: ['CC-MAIN-2016-07', 'CC-MAIN-2020-05'],
  });
  assert.equal(queries.length, 4);
  assert.ok(queries.every((query) => query.filterPattern && !query.filterPattern.toLowerCase().includes('colored school')));
});

function sampleQueryProvenance() {
  return stampCommonCrawlQueryProvenance({
    query: {
      crawlId: 'CC-MAIN-2016-07',
      seed: { host: 'piedmontcountyhistory.example.org', matchType: 'domain', geographicLabel: 'Montgomery' },
      limit: 500,
      filterPattern: 'freedom|rider',
    },
    executedAt: FIXED_NOW,
  });
}

// ---------------------------------------------------------------------------------------------
// Provenance stamping
// ---------------------------------------------------------------------------------------------

test('stampCommonCrawlQueryProvenance stamps API name, query text, timestamp, and plan/terms version', () => {
  const stamped = sampleQueryProvenance();
  assert.equal(stamped.apiName, 'Common Crawl CDX Index');
  assert.match(stamped.queryText, /crawlId=CC-MAIN-2016-07/);
  assert.match(stamped.queryText, /host=piedmontcountyhistory.example.org/);
  assert.match(stamped.queryText, /filter=freedom\|rider/);
  assert.equal(stamped.executedAt, FIXED_NOW);
  assert.equal(stamped.planTermsVersion, COMMON_CRAWL_TERMS_VERSION);
});

// ---------------------------------------------------------------------------------------------
// Normalizer (no storage-rights gate)
// -----------------------------------------------------------------------------

test('normalizeCdxRecord produces a candidate with query provenance stamped and no full-page fields', () => {
  const entry = commonCrawlRegistryEntry();
  const batch = parseCdxResponse(loadFixtureText('cdx-response.ndjson'));
  const candidate = normalizeCdxRecord({
    record: batch.records[0]!,
    crawlId: 'CC-MAIN-2016-07',
    geographicLabel: 'Montgomery',
    filterPattern: 'freedom|rider',
    queryProvenance: sampleQueryProvenance(),
    registryEntry: entry,
    runId: 'run_1',
    capturedAt: FIXED_NOW,
  });
  assert.equal(candidate.provenance.adapterId, COMMON_CRAWL_ADAPTER_ID);
  assert.equal(candidate.classification, COMMON_CRAWL_DEFAULT_CLASSIFICATION);
  assert.equal(candidate.payload.geographicLabel, 'Montgomery');
  assert.equal(candidate.payload.query.apiName, 'Common Crawl CDX Index');
  assert.equal(candidate.payload.query.executedAt, FIXED_NOW);
  assert.equal(candidate.canonicalUrl, 'https://piedmontcountyhistory.example.org/freedom-riders');
  assert.equal('fullText' in candidate.payload, false);
  assert.equal('body' in candidate.payload, false);
});

// ---------------------------------------------------------------------------------------------
// fetchCommonCrawlCdx fetchCommonCrawlCdxBatch: injected SafeHttpClient
// ---------------------------------------------------------------------------------------------

test('fetchCommonCrawlCdx goes through the injected SafeHttpClient (mock, no live network)', async () => {
  const entry = commonCrawlRegistryEntry();
  const requests: SafeHttpRequest[] = [];
  const client = async (request: SafeHttpRequest): Promise<SafeHttpResponse> => {
    requests.push(request);
    return { status: 200, headers: { 'content-type': 'text/plain' }, bodyText: loadFixtureText('cdx-response.ndjson'), finalUrl: request.url };
  };
  const candidates = await fetchCommonCrawlCdx({
    query: {
      crawlId: 'CC-MAIN-2016-07',
      seed: { host: 'piedmontcountyhistory.example.org', matchType: 'domain', geographicLabel: 'Montgomery' },
      limit: 500,
      filterPattern: 'freedom|rider',
    },
    registryEntry: entry,
    runId: 'run_1',
    capturedAt: FIXED_NOW,
    client,
  });
  assert.equal(requests.length, 1);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.payload.query.apiName, 'Common Crawl CDX Index');
  assert.equal(candidates[0]?.payload.query.executedAt, FIXED_NOW);
});

test('fetchCommonCrawlCdxBatch fans out across queries with bounded concurrency', async () => {
  const entry = commonCrawlRegistryEntry();
  let calls = 0;
  const client = async (): Promise<SafeHttpResponse> => {
    calls += 1;
    return { status: 200, headers: { 'content-type': 'text/plain' }, bodyText: loadFixtureText('cdx-response.ndjson'), finalUrl: '' };
  };
  const candidates = await fetchCommonCrawlCdxBatch({
    queries: [
      { crawlId: 'CC-MAIN-2016-07', seed: { host: 'a.example.org', matchType: 'domain', geographicLabel: 'Montgomery' }, limit: 100 },
      { crawlId: 'CC-MAIN-2020-05', seed: { host: 'b.example.org', matchType: 'domain', geographicLabel: 'Montgomery' }, limit: 100 },
    ],
    registryEntry: entry,
    runId: 'run_1',
    capturedAt: FIXED_NOW,
    client,
  });
  assert.equal(calls, 2);
  assert.equal(candidates.length, 4);
});

test('fetchCommonCrawlCdx rejects a response whose content type is outside the allowlist', async () => {
  const entry = commonCrawlRegistryEntry();
  const client = async (): Promise<SafeHttpResponse> => ({ status: 200, headers: { 'content-type': 'text/html' }, bodyText: '<html></html>', finalUrl: '' });
  await assert.rejects(
    () =>
      fetchCommonCrawlCdx({
        query: { crawlId: 'CC-MAIN-2016-07', seed: { host: 'x.example.org', matchType: 'domain', geographicLabel: 'Montgomery' }, limit: 100 },
        registryEntry: entry,
        runId: 'run_1',
        capturedAt: FIXED_NOW,
        client,
      }),
    /content type/,
  );
});

// ---------------------------------------------------------------------------------------------
// Pipeline integration: Wayback capture gate -> ingestApiCandidate
// ---------------------------------------------------------------------------------------------

test('ingestCommonCrawlCandidatesThroughPipeline routes candidates through the Wayback capture gate before BB-039 ingestion', async () => {
  const entry = commonCrawlRegistryEntry();
  const pack = loadPack();
  const batch = parseCdxResponse(loadFixtureText('cdx-response.ndjson'));
  const candidate = normalizeCdxRecord({
    record: batch.records[0]!,
    crawlId: 'CC-MAIN-2016-07',
    geographicLabel: 'Montgomery',
    queryProvenance: sampleQueryProvenance(),
    registryEntry: entry,
    runId: 'run_1',
    capturedAt: FIXED_NOW,
  });

  let submitCount = 0;
  const client = async (request: SafeHttpRequest): Promise<SafeHttpResponse> => {
    if (request.url === 'https://web.archive.org/save') {
      submitCount += 1;
      return { status: 200, headers: { 'content-type': 'application/json' }, bodyText: JSON.stringify({ job_id: 'job-1' }), finalUrl: '' };
    }
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify({ status: 'success', timestamp: '20260717140512', original_url: candidate.canonicalUrl }),
      finalUrl: '',
    };
  };

  const ingested = await ingestCommonCrawlCandidatesThroughPipeline({
    candidates: [candidate],
    client,
    credentials: { accessKey: 'ak', secretKey: 'sk' },
    pack,
    now: FIXED_NOW,
  });

  assert.equal(submitCount, 1, 'the discovered URL must go through a real Wayback capture before ingestion');
  assert.equal(ingested.length, 1);
  assert.equal(ingested[0]?.ingestMode, 'api');
  assert.equal(ingested[0]?.adapterRecord.provenance.adapterId, COMMON_CRAWL_ADAPTER_ID);
});
