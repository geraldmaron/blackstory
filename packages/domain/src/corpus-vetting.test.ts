/**
 * Corpus vetting record model, registry registration, and the fail-closed bulk-import
 * gate.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInMemorySourceRegistry } from './adapters/registry.js';
import {
  assertCorpusNotInExcludedLane,
  assertCorpusVettedForBulkImport,
  assertCorpusVettingRecordValid,
  assertWithinCorpusBulkImportBudget,
  corpusBulkImportKillSwitchId,
  createInMemoryCorpusVettingStore,
  isCorpusVettedForBulkImport,
  parseCorpusBulkImportKillSwitchId,
  registerCorpusVetting,
  type CorpusVettingRecord,
  type RegisterCorpusVettingInput,
} from './corpus-vetting.js';

const NOW = '2026-07-17T12:00:00.000Z';

function baseInput(overrides: Partial<RegisterCorpusVettingInput> = {}): RegisterCorpusVettingInput {
  return {
    corpus: 'test-corpus',
    corpusDisplayName: 'Test Corpus',
    custodian: 'Test Custodian Org',
    licenseVerdict: 'public-domain',
    licenseNotes: 'Federal public-domain record.',
    authorityTier: 'federal_government',
    provenanceFieldsRetained: ['sourceRecordId', 'retrievalDate', 'sourceUrl'],
    precisionExpectation: 'exact-site',
    refreshCadence: 'static',
    notabilityCriterion: 'documented_site',
    classification: 'government_record',
    rights: {
      defaultStatus: 'public_domain',
      publicationPermissions: ['cite', 'short_excerpt'],
      prohibitedUses: ['biometric_extraction'],
    },
    permittedClaimClasses: ['geographic_fact'],
    stableIdScheme: 'test-corpus-ref',
    organizationId: 'org_test',
    vettedBy: 'operator-gerald',
    vettedAt: NOW,
    ...overrides,
  };
}

test('registerCorpusVetting registers a BB-037 registry entry and an approved corpus for a cleared license verdict', () => {
  const registryStore = createInMemorySourceRegistry();
  const vettingStore = createInMemoryCorpusVettingStore();
  const record = registerCorpusVetting(registryStore, vettingStore, baseInput());

  assertCorpusVettingRecordValid(record);
  assert.equal(record.corpus, 'test-corpus');
  assert.equal(record.sourceRegistryEntryId, 'corpus_registry:test-corpus');

  const entry = registryStore.get(record.sourceRegistryEntryId);
  assert.ok(entry, 'registry entry should exist');
  assert.equal(entry?.registryState, 'approved');
  assert.equal(entry?.approvedBy, 'operator-gerald');
  assert.equal(entry?.evidenceSource.killSwitchId, corpusBulkImportKillSwitchId('test-corpus'));

  // The fail-closed gate passes for a vetted, approved, cleared-license corpus.
  const gateResult = assertCorpusVettedForBulkImport(registryStore, vettingStore, 'test-corpus');
  assert.equal(gateResult.vetting.corpus, 'test-corpus');
  assert.equal(isCorpusVettedForBulkImport(registryStore, vettingStore, 'test-corpus'), true);
});

test('bulk batches fail closed against an unvetted corpus (no vetting record at all)', () => {
  const registryStore = createInMemorySourceRegistry();
  const vettingStore = createInMemoryCorpusVettingStore();

  assert.throws(
    () => assertCorpusVettedForBulkImport(registryStore, vettingStore, 'never-registered'),
    /no vetting record/iu,
  );
  assert.equal(isCorpusVettedForBulkImport(registryStore, vettingStore, 'never-registered'), false);
});

test('bulk batches fail closed against a corpus with a deferred-unverified license verdict (e.g. Rosenwald)', () => {
  const registryStore = createInMemorySourceRegistry();
  const vettingStore = createInMemoryCorpusVettingStore();
  registerCorpusVetting(
    registryStore,
    vettingStore,
    baseInput({ corpus: 'deferred-corpus', licenseVerdict: 'deferred-unverified' }),
  );

  // The registry entry was registered but never approved, so registryState stays 'disabled'.
  const entry = registryStore.get('corpus_registry:deferred-corpus');
  assert.equal(entry?.registryState, 'disabled');

  assert.throws(
    () => assertCorpusVettedForBulkImport(registryStore, vettingStore, 'deferred-corpus'),
    /not cleared for bulk import/iu,
  );
  assert.equal(isCorpusVettedForBulkImport(registryStore, vettingStore, 'deferred-corpus'), false);
});

test('bulk batches fail closed against a rejected license verdict', () => {
  const registryStore = createInMemorySourceRegistry();
  const vettingStore = createInMemoryCorpusVettingStore();
  registerCorpusVetting(
    registryStore,
    vettingStore,
    baseInput({ corpus: 'rejected-corpus', licenseVerdict: 'rejected' }),
  );

  assert.throws(
    () => assertCorpusVettedForBulkImport(registryStore, vettingStore, 'rejected-corpus'),
    /not cleared for bulk import/iu,
  );
});

test('bulk batches fail closed when the corpus kill switch is engaged', () => {
  const registryStore = createInMemorySourceRegistry();
  const vettingStore = createInMemoryCorpusVettingStore();
  registerCorpusVetting(registryStore, vettingStore, baseInput({ corpus: 'kill-switched-corpus' }));

  const killSwitchId = corpusBulkImportKillSwitchId('kill-switched-corpus');
  assert.equal(parseCorpusBulkImportKillSwitchId(killSwitchId), 'kill-switched-corpus');

  assert.throws(
    () =>
      assertCorpusVettedForBulkImport(registryStore, vettingStore, 'kill-switched-corpus', {
        id: killSwitchId,
        enabled: true,
      }),
    /disabled and cannot create candidates/iu,
  );
  assert.equal(
    isCorpusVettedForBulkImport(registryStore, vettingStore, 'kill-switched-corpus', {
      id: killSwitchId,
      enabled: true,
    }),
    false,
  );
});

test('bulk batches fail closed when the vetting record points at a missing registry entry', () => {
  const registryStore = createInMemorySourceRegistry();
  const vettingStore = createInMemoryCorpusVettingStore();
  const record = registerCorpusVetting(registryStore, vettingStore, baseInput({ corpus: 'orphaned-corpus' }));
  // Simulate the registry entry disappearing (or never having been registered) independently of
  // the vetting record the gate must still fail closed rather than assume approval.
  const orphaned: CorpusVettingRecord = { ...record, sourceRegistryEntryId: 'corpus_registry:does-not-exist' };
  vettingStore.save(orphaned);

  assert.throws(
    () => assertCorpusVettedForBulkImport(registryStore, vettingStore, 'orphaned-corpus'),
    /missing registry entry/iu,
  );
});

test('assertCorpusNotInExcludedLane rejects statutes/cases (BB-087) and Tougaloo sundown data (BB-082)', () => {
  assert.throws(() => assertCorpusNotInExcludedLane('statutes'), /BB-087/u);
  assert.throws(() => assertCorpusNotInExcludedLane('cases'), /BB-087/u);
  assert.throws(() => assertCorpusNotInExcludedLane('legal-corpus'), /BB-087/u);
  assert.throws(() => assertCorpusNotInExcludedLane('tougaloo-sundown-data'), /BB-082/u);
  assert.throws(() => assertCorpusNotInExcludedLane('tougaloo'), /BB-082/u);
  assert.doesNotThrow(() => assertCorpusNotInExcludedLane('nrhp'));
});

test('registerCorpusVetting refuses to register an excluded-lane corpus', () => {
  const registryStore = createInMemorySourceRegistry();
  const vettingStore = createInMemoryCorpusVettingStore();
  assert.throws(
    () => registerCorpusVetting(registryStore, vettingStore, baseInput({ corpus: 'statutes' })),
    /BB-087/u,
  );
});

test('assertCorpusVettingRecordValid rejects malformed records', () => {
  const registryStore = createInMemorySourceRegistry();
  const vettingStore = createInMemoryCorpusVettingStore();
  const record = registerCorpusVetting(registryStore, vettingStore, baseInput({ corpus: 'valid-corpus' }));

  assert.throws(
    () => assertCorpusVettingRecordValid({ ...record, provenanceFieldsRetained: [] }),
    /provenanceFieldsRetained/u,
  );
  assert.throws(
    () => assertCorpusVettingRecordValid({ ...record, licenseVerdict: 'not-a-real-verdict' as never }),
    /Unknown licenseVerdict/u,
  );
  assert.throws(
    () => assertCorpusVettingRecordValid({ ...record, vettedAt: 'not-a-date' }),
    /vettedAt/u,
  );
});

test('budget caps: a batch larger than maxRecordsPerBatch fails closed', () => {
  assert.throws(
    () =>
      assertWithinCorpusBulkImportBudget({
        budget: { maxRecordsPerBatch: 100 },
        batchRecordCount: 101,
      }),
    /exceeds the per-batch budget cap/iu,
  );
  assert.doesNotThrow(() =>
    assertWithinCorpusBulkImportBudget({
      budget: { maxRecordsPerBatch: 100 },
      batchRecordCount: 100,
    }),
  );
});

test('budget caps: a refresh-window cap blocks a batch that would push the corpus over its window total', () => {
  assert.throws(
    () =>
      assertWithinCorpusBulkImportBudget({
        budget: { maxRecordsPerBatch: 500, maxRecordsPerRefreshWindow: 1000 },
        batchRecordCount: 300,
        priorRecordsInWindow: 800,
      }),
    /refresh-window/iu,
  );
  assert.doesNotThrow(() =>
    assertWithinCorpusBulkImportBudget({
      budget: { maxRecordsPerBatch: 500, maxRecordsPerRefreshWindow: 1000 },
      batchRecordCount: 200,
      priorRecordsInWindow: 800,
    }),
  );
});
