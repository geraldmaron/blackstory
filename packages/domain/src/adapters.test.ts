/**
 * Domain tests for source registry, adapter contract, run health, drift, and fixtures (BB-037).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import type { EvidenceSource } from './provenance/source.js';
import {
  ADAPTER_CANDIDATE_SCHEMA_VERSION,
  approveSourcePolicy,
  assertAdapterMayRun,
  buildParserDriftMetric,
  canAdapterRun,
  createDriftAccumulator,
  createInMemoryDriftMetricStore,
  createInMemorySourceRegistry,
  evaluateRunHealth,
  getSourceEntry,
  isCanaryMode,
  listSourceEntries,
  parseCandidateFixture,
  parseCandidateFixtureBatch,
  recordFieldObservation,
  registerSource,
  selectCanaryRecordIndices,
  setRegistryState,
  shouldDeadLetterRun,
  shouldQuarantineRun,
  stampCandidateProvenance,
  type SourceAdapterContract,
  type SourceRegistryEntry,
} from './adapters/index.js';

const FIXED_NOW = '2026-07-16T20:00:00.000Z';
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'adapters', 'fixtures');

function sampleContract(overrides: Partial<SourceAdapterContract> = {}): SourceAdapterContract {
  return {
    adapterId: 'nara-catalog-v1',
    parserVersion: 'parser-1.2.0',
    displayName: 'NARA Catalog',
    classification: 'primary_archival',
    stableIdScheme: 'nara-naid',
    policy: {
      snapshotMode: 'selective',
      rights: {
        defaultStatus: 'public_domain',
        publicationPermissions: ['cite', 'short_excerpt'],
        prohibitedUses: ['biometric_extraction'],
      },
      permittedClaimClasses: ['biographical_fact'],
      refreshSchedule: '0 6 * * 1',
    },
    rights: {
      defaultStatus: 'public_domain',
      publicationPermissions: ['cite', 'short_excerpt'],
      prohibitedUses: ['biometric_extraction'],
    },
    permittedClaimClasses: ['biographical_fact'],
    refreshSchedule: '0 6 * * 1',
    rateLimits: { requestsPerMinute: 30, burst: 5 },
    volume: { expectedRecordsPerRun: 100, countToleranceFraction: 0.15 },
    geographicCoverage: { countries: ['US'] },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    ...overrides,
  };
}

function sampleEvidenceSource(overrides: Partial<EvidenceSource> = {}): EvidenceSource {
  return {
    id: 'src_nara',
    organizationId: 'org_nara',
    displayName: 'NARA Catalog',
    classification: 'primary_archival',
    adapterId: 'nara-catalog-v1',
    stableIdScheme: 'nara-naid',
    policy: sampleContract().policy,
    adapterEnabled: true,
    killSwitchId: 'source-adapter-nara-catalog-v1',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

function approvedEntry(overrides: Partial<SourceRegistryEntry> = {}): SourceRegistryEntry {
  return {
    id: 'reg_nara',
    contract: sampleContract(),
    evidenceSource: sampleEvidenceSource(),
    registryState: 'approved',
    approvedAt: FIXED_NOW,
    approvedBy: 'admin@blackbook.local',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

test('source registry register/get/list/approve policy', () => {
  const store = createInMemorySourceRegistry();
  const registered = registerSource(store, {
    id: 'reg_nara',
    contract: sampleContract(),
    evidenceSource: sampleEvidenceSource(),
    createdAt: FIXED_NOW,
  });
  assert.equal(registered.registryState, 'disabled');
  assert.equal(getSourceEntry(store, 'reg_nara')?.id, 'reg_nara');

  const approved = approveSourcePolicy(store, {
    id: 'reg_nara',
    approvedBy: 'admin@blackbook.local',
    approvedAt: FIXED_NOW,
    registryState: 'approved',
  });
  assert.equal(approved.registryState, 'approved');
  assert.equal(listSourceEntries(store, { registryState: 'approved' }).length, 1);
});

test('no adapter runs without approved source policy', () => {
  const store = createInMemorySourceRegistry();
  registerSource(store, {
    id: 'reg_nara',
    contract: sampleContract(),
    evidenceSource: sampleEvidenceSource(),
    createdAt: FIXED_NOW,
  });
  const disabled = getSourceEntry(store, 'reg_nara')!;
  assert.equal(canAdapterRun(disabled), false);
  assert.throws(() => assertAdapterMayRun(disabled), /cannot run in registry state "disabled"/);

  approveSourcePolicy(store, {
    id: 'reg_nara',
    approvedBy: 'admin@blackbook.local',
    approvedAt: FIXED_NOW,
  });
  const approved = getSourceEntry(store, 'reg_nara')!;
  assert.doesNotThrow(() => assertAdapterMayRun(approved));

  setRegistryState(store, {
    id: 'reg_nara',
    registryState: 'approved',
    updatedAt: FIXED_NOW,
  });
  const missingApproval = {
    ...getSourceEntry(store, 'reg_nara')!,
    approvedAt: undefined,
    approvedBy: undefined,
  };
  assert.throws(() => assertAdapterMayRun(missingApproval), /no approved source policy/);

  setRegistryState(store, {
    id: 'reg_nara',
    registryState: 'disabled',
    updatedAt: FIXED_NOW,
  });
  const disabledEntry = getSourceEntry(store, 'reg_nara')!;
  assert.throws(() => assertAdapterMayRun(disabledEntry), /cannot run in registry state "disabled"/);

  setRegistryState(store, {
    id: 'reg_nara',
    registryState: 'canary',
    updatedAt: FIXED_NOW,
  });
  approveSourcePolicy(store, {
    id: 'reg_nara',
    approvedBy: 'admin@blackbook.local',
    approvedAt: FIXED_NOW,
    registryState: 'canary',
  });
  assert.equal(isCanaryMode(getSourceEntry(store, 'reg_nara')!), true);
});

test('kill switch blocks approved adapter runs', () => {
  const entry = approvedEntry();
  assert.throws(
    () =>
      assertAdapterMayRun(entry, {
        id: entry.evidenceSource.killSwitchId!,
        enabled: true,
      }),
    /cannot create candidates/,
  );
});

test('canary mode selects a sample fraction of records', () => {
  const indices = selectCanaryRecordIndices(100, 0.1);
  assert.ok(indices.length >= 1 && indices.length <= 15);
  assert.ok(indices.every((index) => index >= 0 && index < 100));
});

test('evaluateRunHealth quarantines on record count and schema drift', () => {
  const healthy = evaluateRunHealth({
    expectedCount: 100,
    actualCount: 105,
    countToleranceFraction: 0.15,
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    observedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
  });
  assert.equal(healthy.outcome, 'success');
  assert.equal(shouldQuarantineRun(healthy), false);

  const countDrift = evaluateRunHealth({
    expectedCount: 100,
    actualCount: 200,
    countToleranceFraction: 0.15,
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    observedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
  });
  assert.equal(countDrift.outcome, 'quarantined');
  assert.ok(countDrift.issues.includes('record_count_drift'));

  const schemaDrift = evaluateRunHealth({
    expectedCount: 100,
    actualCount: 100,
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    observedSchemaVersion: 'candidate-record.v0',
  });
  assert.equal(schemaDrift.outcome, 'quarantined');
  assert.ok(schemaDrift.issues.includes('schema_version_drift'));
  assert.equal(shouldDeadLetterRun(3), true);
});

test('parser drift metrics record null-field rates', () => {
  const accumulator = createDriftAccumulator({
    adapterId: 'nara-catalog-v1',
    parserVersion: 'parser-1.2.0',
    registryEntryId: 'reg_nara',
    runId: 'run_1',
    startedAt: FIXED_NOW,
  });
  recordFieldObservation(accumulator, 'title', false);
  recordFieldObservation(accumulator, 'title', true);
  recordFieldObservation(accumulator, 'title', false);

  const health = evaluateRunHealth({
    expectedCount: 3,
    actualCount: 3,
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    observedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    nullFieldRate: 1 / 3,
    maxNullFieldRate: 0.5,
  });
  const metric = buildParserDriftMetric(
    accumulator,
    {
      expectedCount: 3,
      actualCount: 3,
      expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
      observedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    },
    health,
    FIXED_NOW,
  );
  assert.equal(metric.fieldNullRates.title, 1 / 3);

  const driftStore = createInMemoryDriftMetricStore();
  driftStore.record(metric);
  assert.equal(driftStore.list('nara-catalog-v1').length, 1);
});

test('quarantine and dead-letter registry states block runs', () => {
  const quarantined = approvedEntry({ registryState: 'quarantined', quarantineReason: 'count drift' });
  assert.throws(() => assertAdapterMayRun(quarantined), /quarantined/);

  const deadLetter = approvedEntry({ registryState: 'dead_letter', deadLetterReason: 'repeated drift' });
  assert.throws(() => assertAdapterMayRun(deadLetter), /dead_letter/);
});

test('fixture-based parser tests validate candidate batches', () => {
  const validBatch = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'valid-nara-batch.json'), 'utf8'),
  ) as unknown;
  const candidates = parseCandidateFixtureBatch(validBatch);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.provenance.adapterId, 'nara-catalog-v1');

  const invalid = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'invalid-missing-provenance.json'), 'utf8'),
  ) as unknown;
  assert.throws(() => parseCandidateFixture(invalid), /sourceId is required/);
});

test('stampCandidateProvenance attaches source and parser metadata', () => {
  const entry = approvedEntry();
  const candidate = stampCandidateProvenance(entry, 'run_stamp', FIXED_NOW, {
    stableIdentifier: 'naid-999',
    title: 'Stamped record',
  });
  assert.equal(candidate.provenance.sourceId, 'src_nara');
  assert.equal(candidate.provenance.parserVersion, 'parser-1.2.0');
  assert.equal(candidate.provenance.schemaVersion, ADAPTER_CANDIDATE_SCHEMA_VERSION);
});
