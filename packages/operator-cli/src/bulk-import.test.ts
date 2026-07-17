
/**
 * Verifies CSV/markdown bulk-import parsing and the per-row batch runner.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createInMemoryCorpusVettingStore,
  createInMemorySourceRegistry,
  registerCorpusVetting,
  type CorpusBulkRecordCandidate,
  type RegisterCorpusVettingInput,
} from '@black-book/domain';
import {
  parseLeadsFromCsv,
  parseLeadsFromMarkdown,
  prepareBulkLeadIntake,
  prepareCorpusBulkImportBatch,
  type BulkImportSummary,
} from './bulk-import.ts';
import type { OperatorIntakeContext } from './intake.ts';

const IDENTITY = {
  operatorId: 'operator-gerald',
  sessionId: 'session-bulk-01',
  source: 'cli' as const,
};

function context(): OperatorIntakeContext {
  return {
    identity: IDENTITY,
    privacyPepper: 'test-only-pepper',
    nowMs: Date.parse('2026-07-17T04:00:00.000Z'),
  };
}

const CSV = [
  'title,description,url,location,era',
  '"Douglass Ave office","A photo shows the mutual-aid office plaque, dated 1962.",https://archive.example.org/a,Douglass Avenue,1960s',
  ',"A second lead with no title field, but a valid description of sufficient length.",https://archive.example.org/b,,',
].join('\n');

test('parses a CSV bulk-import batch into LeadInput rows', () => {
  const leads = parseLeadsFromCsv(CSV);
  assert.equal(leads.length, 2);
  assert.equal(leads[0]?.title, 'Douglass Ave office');
  assert.equal(leads[0]?.url, 'https://archive.example.org/a');
  assert.equal(leads[0]?.location, 'Douglass Avenue');
  assert.equal(leads[1]?.title, undefined);
  assert.equal(leads[1]?.url, 'https://archive.example.org/b');
});

const MARKDOWN = `# Operator lead batch

### Douglass Ave office
Description: A photo shows the mutual-aid office plaque, dated 1962.
It was found in a digitized 1962 city newspaper archive.
Source: https://archive.example.org/a
Location: Douglass Avenue
Era: 1960s

### Second lead
Description: A second lead with a valid, sufficiently long description of its own.
Source: https://archive.example.org/b
Source: https://archive.example.org/b2
`;

test('parses a markdown bulk-import batch, including multi-line description and repeated sources', () => {
  const leads = parseLeadsFromMarkdown(MARKDOWN);
  assert.equal(leads.length, 2);
  assert.equal(leads[0]?.title, 'Douglass Ave office');
  assert.ok(leads[0]?.description.includes('digitized 1962 city newspaper archive'));
  assert.deepEqual(leads[1]?.sourceUrls, [
    'https://archive.example.org/b',
    'https://archive.example.org/b2',
  ]);
});

test('bulk-import runs every parsed row through the same real intake path, one at a time', () => {
  const leads = parseLeadsFromMarkdown(MARKDOWN);
  const summary: BulkImportSummary = prepareBulkLeadIntake(leads, context());
  assert.equal(summary.total, 2);
  assert.equal(summary.acceptedCount, 2);
  assert.equal(summary.rejectedCount, 0);
  for (const row of summary.rows) {
    assert.equal(row.proposalKind, 'bulk_import_row');
    if (row.accepted) {
      assert.ok(row.researchCase, 'bulk rows open a draft research case, like single leads');
    }
  }
});

test('a bad row in a batch is rejected individually without blocking the rest of the batch', () => {
  const leads = [
    { description: 'Valid lead with a citation.', url: 'https://archive.example.org/ok' },
    { description: 'No citation at all here, should fail BB-029 validation cleanly.' },
  ];
  const summary = prepareBulkLeadIntake(leads, context());
  assert.equal(summary.total, 2);
  assert.equal(summary.acceptedCount, 1);
  assert.equal(summary.rejectedCount, 1);
  assert.equal(summary.rows[0]?.accepted, true);
  assert.equal(summary.rows[1]?.accepted, false);
});

// ---------------------------------------------------------------------------
// prepareCorpusBulkImportBatch — the exclusive vetted-corpus bulk-intake execution
// surface. Domain-layer evaluation logic (evaluateCorpusBulkPromotion,
// the guardrail, budget/gate assertions) is already exhaustively covered by
// packages/domain/src/corpus-vetting.test.ts and promotion/corpus-promotion.test.ts these tests
// exercise only the INTEGRATION surface: gating, idempotency, and routing through real intake.
// ---------------------------------------------------------------------------

function corpusVettingInput(overrides: Partial<RegisterCorpusVettingInput> = {}): RegisterCorpusVettingInput {
  return {
    corpus: 'nrhp',
    corpusDisplayName: 'National Register of Historic Places',
    custodian: 'National Park Service',
    licenseVerdict: 'public-domain',
    licenseNotes: 'Federal public-domain record.',
    authorityTier: 'federal_government',
    provenanceFieldsRetained: ['sourceRecordId', 'retrievalDate', 'sourceUrl'],
    precisionExpectation: 'exact-site',
    refreshCadence: 'annual',
    notabilityCriterion: 'landmark_or_national_register',
    classification: 'government_record',
    rights: {
      defaultStatus: 'public_domain',
      publicationPermissions: ['cite', 'short_excerpt'],
      prohibitedUses: ['biometric_extraction'],
    },
    permittedClaimClasses: ['geographic_fact'],
    stableIdScheme: 'nrhp-ref',
    organizationId: 'org_nps',
    vettedBy: 'operator-gerald',
    vettedAt: '2026-07-17T12:00:00.000Z',
    ...overrides,
  };
}

function corpusCandidate(overrides: Partial<CorpusBulkRecordCandidate> = {}): CorpusBulkRecordCandidate {
  return {
    corpusId: 'nrhp',
    batchId: 'batch-1',
    sourceRecordId: 'nrhp-0001',
    title: 'Example Historic Site',
    citations: [
      {
        sourceName: 'National Register of Historic Places',
        location: { kind: 'url', url: 'https://npgallery.nps.gov/NRHP/example' },
        capture: { captureId: 'cap-nrhp-0001' },
        retrievalDate: '2026-07-17',
      },
    ],
    documentedGeoPrecisionTier: 'exact-site',
    geometryType: 'Point',
    ...overrides,
  };
}

function vettedFixture(vettingOverrides: Partial<RegisterCorpusVettingInput> = {}) {
  const registryStore = createInMemorySourceRegistry();
  const vettingStore = createInMemoryCorpusVettingStore();
  registerCorpusVetting(registryStore, vettingStore, corpusVettingInput(vettingOverrides));
  return { registryStore, vettingStore };
}

test('prepareCorpusBulkImportBatch: fail-closed gate blocks an unvetted corpus before any intake happens', () => {
  const registryStore = createInMemorySourceRegistry();
  const vettingStore = createInMemoryCorpusVettingStore();
  assert.throws(
    () =>
      prepareCorpusBulkImportBatch({
        corpusId: 'never-registered',
        batchId: 'batch-1',
        candidates: [corpusCandidate({ corpusId: 'never-registered' })],
        registryStore,
        vettingStore,
        budget: { maxRecordsPerBatch: 10 },
        alreadyImportedSourceRecordIds: new Set(),
        context: context(),
      }),
    /no vetting record/iu,
  );
});

test('prepareCorpusBulkImportBatch: budget cap rejects an oversized batch before any intake happens', () => {
  const { registryStore, vettingStore } = vettedFixture();
  assert.throws(
    () =>
      prepareCorpusBulkImportBatch({
        corpusId: 'nrhp',
        batchId: 'batch-1',
        candidates: [
          corpusCandidate({ sourceRecordId: 'nrhp-0001' }),
          corpusCandidate({ sourceRecordId: 'nrhp-0002' }),
        ],
        registryStore,
        vettingStore,
        budget: { maxRecordsPerBatch: 1 },
        alreadyImportedSourceRecordIds: new Set(),
        context: context(),
      }),
    /exceeds the per-batch budget cap/iu,
  );
});

test('prepareCorpusBulkImportBatch: a single-candidate batch is guaranteed spot-check-selected on the first pass and demotes to standard_consensus pending a verdict, but still reaches real quarantine intake', () => {
  const { registryStore, vettingStore } = vettedFixture();
  const result = prepareCorpusBulkImportBatch({
    corpusId: 'nrhp',
    batchId: 'batch-1',
    candidates: [corpusCandidate()],
    registryStore,
    vettingStore,
    budget: { maxRecordsPerBatch: 10 },
    alreadyImportedSourceRecordIds: new Set(),
    context: context(),
  });

  assert.equal(result.rows.length, 1);
  const [only] = result.rows;
  assert.equal(only?.row.decision.spotCheckSelected, true, 'a 1-record batch always selects its only record');
  assert.equal(only?.row.decision.lane, 'standard_consensus');
  assert.ok(only?.row.decision.reasons.includes('spot_check_not_yet_sampled'));
  // Demoted to standard_consensus, but NOT dropped it still runs through real quarantine intake,
  // exactly like every fast-tracked record (: no record ever silently publishes OR silently
  // disappears just for needing a human spot-check).
  assert.equal(only?.row.outcome, 'accepted');
  assert.ok(only?.intakeOutcome?.accepted);
  assert.equal(result.report.counts.total, 1);
  assert.equal(result.report.counts.demotedToConsensus, 1);
  assert.equal(result.report.counts.fastTracked, 0);
  assert.equal(result.auditEvent.action, 'research.created');
  assert.equal(result.outboxMessage.topic, 'operator.corpus_bulk_import.batch_completed');
});

test('prepareCorpusBulkImportBatch: a passing spot-check verdict on a second pass promotes the same record to corpus_fast_track', () => {
  const { registryStore, vettingStore } = vettedFixture();
  const result = prepareCorpusBulkImportBatch({
    corpusId: 'nrhp',
    batchId: 'batch-1',
    candidates: [corpusCandidate()],
    registryStore,
    vettingStore,
    budget: { maxRecordsPerBatch: 10 },
    alreadyImportedSourceRecordIds: new Set(),
    spotCheckVerdicts: new Map([['nrhp-0001', 'pass']]),
    context: context(),
  });
  const [only] = result.rows;
  assert.equal(only?.row.decision.lane, 'corpus_fast_track');
  assert.deepEqual(only?.row.decision.reasons, []);
  assert.equal(only?.row.outcome, 'accepted');
});

test('prepareCorpusBulkImportBatch: a failing spot-check verdict keeps the record in standard_consensus', () => {
  const { registryStore, vettingStore } = vettedFixture();
  const result = prepareCorpusBulkImportBatch({
    corpusId: 'nrhp',
    batchId: 'batch-1',
    candidates: [corpusCandidate()],
    registryStore,
    vettingStore,
    budget: { maxRecordsPerBatch: 10 },
    alreadyImportedSourceRecordIds: new Set(),
    spotCheckVerdicts: new Map([['nrhp-0001', 'fail']]),
    context: context(),
  });
  const [only] = result.rows;
  assert.equal(only?.row.decision.lane, 'standard_consensus');
  assert.ok(only?.row.decision.reasons.includes('spot_check_failed'));
});

test('prepareCorpusBulkImportBatch: an already-imported sourceRecordId is skipped as a duplicate and never reaches intake a second time (idempotent re-runs)', () => {
  const { registryStore, vettingStore } = vettedFixture();
  const result = prepareCorpusBulkImportBatch({
    corpusId: 'nrhp',
    batchId: 'batch-2',
    candidates: [
      corpusCandidate({ sourceRecordId: 'nrhp-0001' }),
      corpusCandidate({ sourceRecordId: 'nrhp-0002' }),
    ],
    registryStore,
    vettingStore,
    budget: { maxRecordsPerBatch: 10 },
    alreadyImportedSourceRecordIds: new Set(['nrhp-0001']),
    spotCheckVerdicts: new Map([['nrhp-0002', 'pass']]),
    context: context(),
  });

  const duplicateRow = result.rows.find((row) => row.row.candidate.sourceRecordId === 'nrhp-0001');
  const newRow = result.rows.find((row) => row.row.candidate.sourceRecordId === 'nrhp-0002');

  assert.equal(duplicateRow?.row.outcome, 'skipped_duplicate');
  assert.equal(duplicateRow?.intakeOutcome, undefined, 'a duplicate never reaches prepareOperatorIntake');
  assert.equal(newRow?.intakeOutcome?.accepted, true);
  assert.equal(result.report.counts.skippedDuplicate, 1);
  assert.equal(result.report.counts.total, 2);
  // Idempotency also means the guaranteed-at-least-1 spot-check sample draws only from the
  // non-duplicate candidates the duplicate is never itself spot-check-selected.
  assert.equal(duplicateRow?.row.decision.spotCheckSelected, false);
});

test('prepareCorpusBulkImportBatch: a citation missing a required field demotes to standard_consensus, independently of (and stricter than) real intake\'s own basic URL check', () => {
  const { registryStore, vettingStore } = vettedFixture();
  // A URL is present (satisfies real quarantine intake, which only requires a valid
  // HTTPS source URL) but `sourceName` is blank, which fails the stricter, corpus-vetting-layer
  // `isCitationStructurallyComplete` check proving the two gates are independent and neither
  // silently bypasses the other.
  const result = prepareCorpusBulkImportBatch({
    corpusId: 'nrhp',
    batchId: 'batch-1',
    candidates: [
      corpusCandidate({
        citations: [
          {
            sourceName: '',
            location: { kind: 'url', url: 'https://npgallery.nps.gov/NRHP/example' },
            capture: { captureId: 'cap-nrhp-0001' },
            retrievalDate: '2026-07-17',
          },
        ],
      }),
    ],
    registryStore,
    vettingStore,
    budget: { maxRecordsPerBatch: 10 },
    alreadyImportedSourceRecordIds: new Set(),
    spotCheckVerdicts: new Map([['nrhp-0001', 'pass']]),
    context: context(),
  });
  const [only] = result.rows;
  assert.equal(only?.row.decision.lane, 'standard_consensus');
  assert.ok(only?.row.decision.reasons.includes('no_structurally_complete_citation'));
  // Real intake only requires a valid source URL (present here) it still accepts the
  // submission into quarantine even though the corpus-vetting layer demoted it. The record is
  // never silently dropped just for missing the stricter, corpus-specific completeness bar.
  assert.equal(only?.row.outcome, 'accepted');
});

test('prepareCorpusBulkImportBatch: zero citations means zero source URLs, so real intake rejects it on its own (independent, real BB-029 validation)', () => {
  const { registryStore, vettingStore } = vettedFixture();
  const result = prepareCorpusBulkImportBatch({
    corpusId: 'nrhp',
    batchId: 'batch-1',
    candidates: [corpusCandidate({ citations: [] })],
    registryStore,
    vettingStore,
    budget: { maxRecordsPerBatch: 10 },
    alreadyImportedSourceRecordIds: new Set(),
    spotCheckVerdicts: new Map([['nrhp-0001', 'pass']]),
    context: context(),
  });
  const [only] = result.rows;
  assert.equal(only?.row.decision.lane, 'standard_consensus');
  assert.ok(only?.row.decision.reasons.includes('no_structurally_complete_citation'));
  assert.equal(only?.row.outcome, 'rejected');
  assert.equal(only?.intakeOutcome?.accepted, false);
});
