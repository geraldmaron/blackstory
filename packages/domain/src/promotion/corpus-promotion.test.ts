/**
 * Streamlined corpus-bulk promotion decision logic and per-batch report.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInMemorySourceRegistry } from '../adapters/registry.js';
import {
  createInMemoryCorpusVettingStore,
  registerCorpusVetting,
  type RegisterCorpusVettingInput,
} from '../corpus-vetting.js';
import {
  buildCorpusBulkImportBatchReport,
  evaluateCorpusBulkPromotion,
  selectSpotCheckSample,
  selectSpotCheckSampleIndices,
  type CorpusBulkImportBatchRow,
  type CorpusBulkRecordCandidate,
} from './corpus-promotion.js';

const NOW = '2026-07-17T12:00:00.000Z';

function vettedRecord(overrides: Partial<RegisterCorpusVettingInput> = {}) {
  const registryStore = createInMemorySourceRegistry();
  const vettingStore = createInMemoryCorpusVettingStore();
  const record = registerCorpusVetting(registryStore, vettingStore, {
    corpus: 'nrhp-fixture',
    corpusDisplayName: 'Fixture NRHP',
    custodian: 'National Park Service (NPS)',
    licenseVerdict: 'public-domain',
    licenseNotes: 'Federal public-domain record.',
    authorityTier: 'federal_government',
    provenanceFieldsRetained: ['nrhpReferenceNumber', 'retrievalDate', 'sourceUrl'],
    precisionExpectation: 'exact-site',
    refreshCadence: 'weekly',
    notabilityCriterion: 'landmark_or_national_register',
    classification: 'government_record',
    rights: {
      defaultStatus: 'public_domain',
      publicationPermissions: ['cite', 'short_excerpt'],
      prohibitedUses: ['biometric_extraction'],
    },
    permittedClaimClasses: ['geographic_fact'],
    stableIdScheme: 'nps-nrhp-ref',
    organizationId: 'org_nps',
    vettedBy: 'operator-gerald',
    vettedAt: NOW,
    ...overrides,
  });
  return record;
}

const COMPLETE_CITATION = {
  sourceName: 'NPS National Register of Historic Places',
  location: { kind: 'url' as const, url: 'https://npgallery.nps.gov/NRHP/GetAsset/NRHP/00000001_text' },
  capture: { captureId: 'capture-1' },
  retrievalDate: NOW,
};

function candidate(overrides: Partial<CorpusBulkRecordCandidate> = {}): CorpusBulkRecordCandidate {
  return {
    corpusId: 'nrhp-fixture',
    batchId: 'batch-2026-07-17',
    sourceRecordId: 'nrhp-00000001',
    title: 'Douglass Avenue Mutual Aid Office',
    citations: [COMPLETE_CITATION],
    documentedGeoPrecisionTier: 'exact-site',
    geometryType: 'Point',
    ...overrides,
  };
}

test('a fully-passing record fast-tracks with an auto-derived notability basis and source-documented precision', () => {
  const vetting = vettedRecord({});
  const result = evaluateCorpusBulkPromotion({
    vetting,
    candidate: candidate(),
    spotCheckSelected: false,
    evidenceIds: ['citation:nrhp-00000001'],
  });

  assert.equal(result.lane, 'corpus_fast_track');
  assert.deepEqual(result.reasons, []);
  assert.equal(result.notabilityBasis.criterion, 'landmark_or_national_register');
  assert.ok(result.notabilityBasis.note.includes('Fixture NRHP'));
  assert.deepEqual(result.notabilityBasis.evidenceIds, ['citation:nrhp-00000001']);
  assert.equal(result.precisionBasis, 'source-documented');
  assert.equal(result.geoPrecisionTier, 'exact-site');
  assert.equal(result.citationComplete, true);
});

test('a record with no structurally complete citation demotes to standard_consensus', () => {
  const vetting = vettedRecord({});
  const result = evaluateCorpusBulkPromotion({
    vetting,
    candidate: candidate({ citations: [] }),
    spotCheckSelected: false,
    evidenceIds: [],
  });
  assert.equal(result.lane, 'standard_consensus');
  assert.ok(result.reasons.includes('no_structurally_complete_citation'));
  assert.equal(result.citationComplete, false);
});

test('a record flagged ambiguous by the importer always demotes, even with a complete citation', () => {
  const vetting = vettedRecord({});
  const result = evaluateCorpusBulkPromotion({
    vetting,
    candidate: candidate({ ambiguousFlag: true, ambiguousReason: 'Two competing address claims' }),
    spotCheckSelected: false,
    evidenceIds: ['citation:x'],
  });
  assert.equal(result.lane, 'standard_consensus');
  assert.ok(result.reasons.includes('flagged_ambiguous'));
});

test('Mapping Inequality-style corpora require Polygon geometry; a Point candidate demotes', () => {
  const vetting = vettedRecord({
    corpus: 'mapping-inequality-fixture',
    precisionExpectation: 'locality',
    requiresPolygonGeometry: true,
    notabilityCriterion: 'documented_site',
  });
  const pointResult = evaluateCorpusBulkPromotion({
    vetting,
    candidate: candidate({ geometryType: 'Point', documentedGeoPrecisionTier: 'locality' }),
    spotCheckSelected: false,
    evidenceIds: [],
  });
  assert.equal(pointResult.lane, 'standard_consensus');
  assert.ok(pointResult.reasons.includes('polygon_geometry_required'));

  const polygonResult = evaluateCorpusBulkPromotion({
    vetting,
    candidate: candidate({ geometryType: 'Polygon', documentedGeoPrecisionTier: 'locality' }),
    spotCheckSelected: false,
    evidenceIds: ['citation:holc-1'],
  });
  assert.equal(polygonResult.lane, 'corpus_fast_track');
});

test('a spot-check-sampled record with a fail verdict demotes; a pass verdict stays fast-tracked', () => {
  const vetting = vettedRecord({});
  const failed = evaluateCorpusBulkPromotion({
    vetting,
    candidate: candidate(),
    spotCheckSelected: true,
    spotCheckVerdict: 'fail',
    evidenceIds: ['citation:x'],
  });
  assert.equal(failed.lane, 'standard_consensus');
  assert.ok(failed.reasons.includes('spot_check_failed'));

  const passed = evaluateCorpusBulkPromotion({
    vetting,
    candidate: candidate(),
    spotCheckSelected: true,
    spotCheckVerdict: 'pass',
    evidenceIds: ['citation:x'],
  });
  assert.equal(passed.lane, 'corpus_fast_track');

  const pendingSample = evaluateCorpusBulkPromotion({
    vetting,
    candidate: candidate(),
    spotCheckSelected: true,
    evidenceIds: ['citation:x'],
  });
  assert.equal(pendingSample.lane, 'standard_consensus');
  assert.ok(pendingSample.reasons.includes('spot_check_not_yet_sampled'));
});

test('selectSpotCheckSample always samples at least one record from a non-empty batch (mandatory per-batch sample)', () => {
  const candidates = Array.from({ length: 3 }, (_, index) => candidate({ sourceRecordId: `rec-${index}` }));
  const sample = selectSpotCheckSample(candidates, 0.1);
  assert.ok(sample.length >= 1);

  const indices = selectSpotCheckSampleIndices(50, 0.1);
  assert.ok(indices.length >= 1);
  assert.equal(new Set(indices).size, indices.length, 'indices should be unique');
});

test('buildCorpusBulkImportBatchReport aggregates counts, precision tiers, spot-check results, and rejects', () => {
  const vetting = vettedRecord({});
  const passingCandidate = candidate({ sourceRecordId: 'rec-1' });
  const passingDecision = evaluateCorpusBulkPromotion({
    vetting,
    candidate: passingCandidate,
    spotCheckSelected: true,
    spotCheckVerdict: 'pass',
    evidenceIds: ['citation:rec-1'],
  });

  const failingCandidate = candidate({ sourceRecordId: 'rec-2', citations: [] });
  const failingDecision = evaluateCorpusBulkPromotion({
    vetting,
    candidate: failingCandidate,
    spotCheckSelected: false,
    evidenceIds: [],
  });

  const duplicateCandidate = candidate({ sourceRecordId: 'rec-3' });
  const duplicateDecision = evaluateCorpusBulkPromotion({
    vetting,
    candidate: duplicateCandidate,
    spotCheckSelected: false,
    evidenceIds: ['citation:rec-3'],
  });

  const rows: readonly CorpusBulkImportBatchRow[] = [
    { candidate: passingCandidate, decision: passingDecision, outcome: 'accepted' },
    {
      candidate: failingCandidate,
      decision: failingDecision,
      outcome: 'rejected',
      rejectionReason: 'no_citation',
    },
    { candidate: duplicateCandidate, decision: duplicateDecision, outcome: 'skipped_duplicate' },
  ];

  const report = buildCorpusBulkImportBatchReport({
    corpusId: 'nrhp-fixture',
    batchId: 'batch-2026-07-17',
    generatedAt: NOW,
    rows,
  });

  assert.equal(report.counts.total, 3);
  assert.equal(report.counts.accepted, 1);
  assert.equal(report.counts.fastTracked, 2, 'passing + duplicate candidates both evaluated as fast-track-eligible');
  assert.equal(report.counts.demotedToConsensus, 1);
  assert.equal(report.counts.rejected, 1);
  assert.equal(report.counts.skippedDuplicate, 1);
  assert.equal(report.precisionTiers['exact-site'], 3);
  assert.equal(report.spotCheck.sampledCount, 1);
  assert.equal(report.spotCheck.passCount, 1);
  assert.equal(report.spotCheck.failCount, 0);
  assert.equal(report.rejects.length, 1);
  assert.equal(report.rejects[0]?.sourceRecordId, 'rec-2');
});
