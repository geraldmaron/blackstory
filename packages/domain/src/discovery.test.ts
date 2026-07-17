/**
 * Domain tests for candidate discovery pipeline.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parseCandidateFixtureBatch } from './adapters/index.js';
import {
  assertDiscoveryRunStamped,
  parseQueryPackFixture,
  stampDiscoveryRun,
} from './query-packs/index.js';
import {
  assertDiscoveryCannotPublish,
  areDuplicateCandidates,
  createDiscoveryCampaignConfig,
  hashCandidateContent,
  ingestApiCandidate,
  ingestBulkCandidates,
  mergeDuplicateCandidates,
  runDiscoveryCampaign,
  stampDiscoveryReproducibility,
  type DiscoveryCandidateRecord,
} from './discovery/index.js';
import { buildQueryPack } from './query-packs/index.js';

const FIXED_NOW = '2026-07-16T20:00:00.000Z';
const ADAPTER_FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'adapters', 'fixtures');
const QUERY_PACK_FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  'query-packs',
  'fixtures',
);

function loadAdapterBatch() {
  const raw = JSON.parse(readFileSync(join(ADAPTER_FIXTURES, 'valid-nara-batch.json'), 'utf8'));
  return parseCandidateFixtureBatch(raw);
}

function loadQueryPack() {
  const raw = JSON.parse(
    readFileSync(join(QUERY_PACK_FIXTURES, 'person-civil-rights-fixture.v1.json'), 'utf8'),
  );
  return parseQueryPackFixture(raw).pack;
}

function sampleCampaignConfig(overrides: Partial<Parameters<typeof createDiscoveryCampaignConfig>[0]> = {}) {
  return createDiscoveryCampaignConfig({
    campaignId: 'camp_test',
    budget: {
      maxCandidates: 100,
      maxQuarantined: 10,
      maxDeadLetter: 5,
      maxRetriesPerCandidate: 2,
    },
    boundaries: { countries: ['US'] },
    continueOnQuarantine: true,
    ...overrides,
  });
}

test('assertDiscoveryCannotPublish blocks public entity writes', () => {
  assert.throws(() => assertDiscoveryCannotPublish({ operation: 'write_public_projection' }));
  assert.throws(() => assertDiscoveryCannotPublish({ operation: 'create_public_entity' }));
  assert.doesNotThrow(() => assertDiscoveryCannotPublish({ operation: 'ingest_candidate' }));
});

test('hashCandidateContent uses provenance hashUtf8', () => {
  const [record] = loadAdapterBatch();
  const hash = hashCandidateContent(record!);
  assert.match(hash.digest, /^[a-f0-9]{64}$/);
  assert.equal(hash.algorithm, 'sha256');
});

test('bulk and API ingestion produce discovery candidates with identity and signals', () => {
  const pack = loadQueryPack();
  const batch = loadAdapterBatch();
  const bulk = ingestBulkCandidates({ records: batch }, pack, { now: FIXED_NOW });
  assert.equal(bulk.length, 1);
  assert.equal(bulk[0]?.ingestMode, 'bulk');
  assert.ok(bulk[0]?.identity.sourceReferences.length === 1);
  assert.ok(bulk[0]?.signals.strength);

  const api = ingestApiCandidate({ record: batch[0]! }, pack, { now: FIXED_NOW });
  assert.equal(api.ingestMode, 'api');
  assert.equal(api.identity.stableIdentifier, batch[0]!.stableIdentifier);
});

test('extractGeographicHints finds state references in candidate text', () => {
  const pack = loadQueryPack();
  const record = {
    ...loadAdapterBatch()[0]!,
    title: 'Civil rights activist in Montgomery, AL',
  };
  const candidate = ingestApiCandidate({ record }, pack, { now: FIXED_NOW });
  assert.ok(candidate.geographicHints.some((hint) => hint.text.includes('US-AL')));
  assert.ok(candidate.geographicHints.some((hint) => hint.kind === 'city'));
});

test('weak signals produce candidate-only outcomes via query-pack classification', () => {
  const pack = buildQueryPack({
    id: 'qp-weak',
    displayName: 'Weak only',
    entityKind: 'person',
    theme: 'civil_rights',
    semver: '1.0.0',
    createdAt: FIXED_NOW,
    terms: [{ text: 'Montgomery', termClass: 'geographic' }],
  });
  const record = {
    ...loadAdapterBatch()[0]!,
    title: 'Montgomery community bulletin',
  };
  const candidate = ingestApiCandidate({ record }, pack, { now: FIXED_NOW });
  assert.equal(candidate.signals.strength, 'weak');
  assert.equal(candidate.signals.outcome, 'candidate_only');
});

test('duplicate source records merge without losing provenance', () => {
  const pack = loadQueryPack();
  const base = loadAdapterBatch()[0]!;
  const duplicate = {
    ...base,
    provenance: {
      ...base.provenance,
      runId: 'run_duplicate',
      capturedAt: '2026-07-17T00:00:00.000Z',
    },
  };

  const left = ingestApiCandidate({ record: base }, pack, {
    now: FIXED_NOW,
    candidateId: 'disc_a',
  });
  const right = ingestApiCandidate({ record: duplicate }, pack, {
    now: FIXED_NOW,
    candidateId: 'disc_b',
  });

  assert.ok(areDuplicateCandidates(left, right));
  const { survivors, mergedCount } = mergeDuplicateCandidates([left, right]);
  assert.equal(survivors.length, 1);
  assert.equal(mergedCount, 1);
  assert.equal(survivors[0]?.identity.sourceReferences.length, 2);
  assert.equal(survivors[0]?.status, 'merged');
});

test('failed candidates do not block full campaign (continue-on-quarantine)', () => {
  const pack = loadQueryPack();
  const good = loadAdapterBatch()[0]!;
  const bad = {
    ...good,
    stableIdentifier: 'naid-quarantine-me',
    provenance: {
      ...good.provenance,
      adapterId: 'disallowed-adapter-v1',
      runId: 'run_bad',
    },
  };

  const result = runDiscoveryCampaign({
    config: sampleCampaignConfig({
      boundaries: { countries: ['US'], adapterIds: ['nara-catalog-v1'] },
    }),
    records: [good, bad],
    pack,
    runContext: {
      runId: 'run_campaign',
      adapterId: good.provenance.adapterId,
      startedAt: FIXED_NOW,
      entityKind: 'person',
      theme: 'civil_rights',
    },
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });

  assert.equal(result.candidates.length, 2);
  assert.ok(result.acceptedCount >= 1);
  assert.ok(result.quarantinedCount >= 1);
});

test('campaign output is reproducible from source version and query-pack version', () => {
  const pack = loadQueryPack();
  const records = loadAdapterBatch();
  const runContext = {
    runId: 'run_repro',
    adapterId: records[0]!.provenance.adapterId,
    startedAt: FIXED_NOW,
    entityKind: 'person' as const,
    theme: 'civil_rights' as const,
  };

  const stamped = stampDiscoveryRun(runContext, pack, FIXED_NOW);
  assertDiscoveryRunStamped(stamped);

  const repro = stampDiscoveryReproducibility(
    stamped,
    records.map((record) => record.provenance.parserVersion),
  );
  assert.match(repro.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(repro.queryPackVersionId, pack.versionId);
  assert.equal(repro.queryPackContentHash, pack.version.contentHash);

  const result = runDiscoveryCampaign({
    config: sampleCampaignConfig(),
    records,
    pack,
    runContext,
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });

  assert.equal(result.reproducibility.fingerprint, repro.fingerprint);
  assert.equal(result.run.queryPackVersionId, pack.versionId);
});

test('campaign respects budget boundaries', () => {
  const pack = loadQueryPack();
  const base = loadAdapterBatch()[0]!;
  const records = Array.from({ length: 5 }, (_, index) => ({
    ...base,
    stableIdentifier: `naid-budget-${index}`,
    provenance: { ...base.provenance, runId: `run_${index}` },
  }));

  const result = runDiscoveryCampaign({
    config: sampleCampaignConfig({
      budget: {
        maxCandidates: 2,
        maxQuarantined: 10,
        maxDeadLetter: 5,
        maxRetriesPerCandidate: 2,
      },
    }),
    records,
    pack,
    runContext: {
      runId: 'run_budget',
      adapterId: base.provenance.adapterId,
      startedAt: FIXED_NOW,
    },
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });

  assert.equal(result.candidates.length, 2);
  assert.equal(result.skippedCount, 3);
});

function assertNoPublicProjectionWrites(candidates: readonly DiscoveryCandidateRecord[]): void {
  for (const candidate of candidates) {
    assert.notEqual(candidate.status, 'published' as never);
    assert.ok(candidate.schemaVersion.startsWith('discovery-candidate'));
  }
}

test('discovery pipeline never creates public entities', () => {
  const pack = loadQueryPack();
  const result = runDiscoveryCampaign({
    config: sampleCampaignConfig(),
    records: loadAdapterBatch(),
    pack,
    runContext: {
      runId: 'run_private',
      adapterId: 'nara-catalog-v1',
      startedAt: FIXED_NOW,
    },
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });

  assertNoPublicProjectionWrites(result.candidates);
  assert.throws(() => assertDiscoveryCannotPublish({ operation: 'publish_snapshot' }));
});
