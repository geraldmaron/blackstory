/**
 * Tests for the present-day advisory record model including the scoring-exclusion
 * discipline, extending the standing "crime stats never enter the composite" rule
 * from design to advisory data ahead of itself landing.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parseCandidateFixtureBatch } from './adapters/index.js';
import {
  assertClaimEvidenceLinkValid,
  calculateClaimConfidence,
  CONFIDENCE_COMPONENT_WEIGHTS,
  type ClaimEvidenceLink,
} from './claims/index.js';
import { ingestApiCandidate } from './discovery/index.js';
import { parseQueryPackFixture } from './query-packs/index.js';
import {
  evaluateCandidateRelevance,
  RELEVANCE_DIMENSIONS,
  type RelevanceAssessment,
} from './relevance/index.js';
import {
  ADVISORY_CLASSES,
  ADVISORY_CLASS_LABELS,
  ADVISORY_SCORING_BANNED_KEYS,
  ADVISORY_SCORING_TYPE_INVARIANTS,
  AdvisoryValidationError,
  assertAdvisoryAbsentFromScoringInput,
  assertAdvisoryRecordValid,
  assertProceduralAdvisoryLanguage,
  buildAdvisoryStatement,
  isAdvisoryClass,
  PROHIBITED_ADVISORY_LANGUAGE,
  type PlaceAdvisoryRecord,
} from './advisory.js';
import { asEntityId } from './ids.js';

const FIXED_NOW = '2026-07-17T00:00:00.000Z';
const DOMAIN_ROOT = dirname(fileURLToPath(import.meta.url));
const ADAPTER_FIXTURES = join(DOMAIN_ROOT, 'adapters', 'fixtures');
const QUERY_PACK_FIXTURES = join(DOMAIN_ROOT, 'query-packs', 'fixtures');

function baseRecord(overrides: Partial<PlaceAdvisoryRecord> = {}): PlaceAdvisoryRecord {
  return {
    id: 'adv_001',
    placeEntityId: asEntityId('ent_seed_place_001'),
    advisoryClass: 'private_property',
    sourcedClaimIds: ['claim_advisory_001'],
    asOf: '2024-03-01',
    datePrecision: 'day',
    reviewCadence: 'annual',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Vocabulary and validation
// ---------------------------------------------------------------------------

test('advisory class vocabulary matches the BB-095 spec exactly', () => {
  assert.deepEqual(ADVISORY_CLASSES, [
    'private_property',
    'access_restricted',
    'site_lost',
    'verify_before_travel',
    'official_travel_advisory',
  ]);
  for (const advisoryClass of ADVISORY_CLASSES) {
    assert.equal(isAdvisoryClass(advisoryClass), true);
    assert.ok(ADVISORY_CLASS_LABELS[advisoryClass].length > 0);
  }
  assert.equal(isAdvisoryClass('dangerous_today'), false);
});

test('assertAdvisoryRecordValid requires >=1 sourcedClaimId, a non-blank asOf, and reviewCadence', () => {
  assert.doesNotThrow(() => assertAdvisoryRecordValid(baseRecord()));

  assert.throws(
    () => assertAdvisoryRecordValid(baseRecord({ sourcedClaimIds: [] })),
    AdvisoryValidationError,
  );
  assert.throws(
    () => assertAdvisoryRecordValid(baseRecord({ asOf: '' })),
    AdvisoryValidationError,
  );
  assert.throws(
    () => assertAdvisoryRecordValid(baseRecord({ reviewCadence: '' })),
    AdvisoryValidationError,
  );
  assert.throws(
    () =>
      assertAdvisoryRecordValid(
        baseRecord({ advisoryClass: 'evicted_by_state' as unknown as PlaceAdvisoryRecord['advisoryClass'] }),
      ),
    AdvisoryValidationError,
  );
});

// ---------------------------------------------------------------------------
// Copy discipline: dated, cited, procedural never "dangerous today"
// ---------------------------------------------------------------------------

test('buildAdvisoryStatement renders a dated, cited, procedural sentence for every class', () => {
  for (const advisoryClass of ADVISORY_CLASSES) {
    const statement = buildAdvisoryStatement(
      { advisoryClass, asOf: '2024-03-01' },
      'County Assessor parcel record',
    );
    assert.match(statement, /as of 2024-03-01/);
    assert.match(statement, /per County Assessor parcel record\.$/);
  }
});

test('advisory copy never uses "dangerous today" or any danger-framing language', () => {
  for (const phrase of PROHIBITED_ADVISORY_LANGUAGE) {
    assert.throws(() => assertProceduralAdvisoryLanguage(`This place is ${phrase}.`));
  }
  assert.throws(() =>
    buildAdvisoryStatement({ advisoryClass: 'private_property', asOf: '2024' }, 'a dangerous source'),
  );
  // Every rendered ADVISORY_CLASS_LABELS entry itself must already be clean.
  for (const label of Object.values(ADVISORY_CLASS_LABELS)) {
    assert.doesNotThrow(() => assertProceduralAdvisoryLanguage(label));
  }
});

// ---------------------------------------------------------------------------
// Scoring exclusion advisory data never enters any composite/scoring input
// ---------------------------------------------------------------------------

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

// Note: deliberately named without the substring "advisory" these ids end up serialized into
// the composite output, and this test asserts that serialized output contains no "advisory"
// substring anywhere; an id containing that substring would be a false positive, not a real leak.
function buildRealRelevanceAssessment(): RelevanceAssessment {
  const pack = loadQueryPack();
  const base = loadAdapterBatch()[0]!;
  const record = { ...base, title: 'Montgomery civil rights activist during segregation' };
  const candidate = ingestApiCandidate({ record }, pack, { now: FIXED_NOW, candidateId: 'rel_scoring_guard' });
  return evaluateCandidateRelevance({ candidate, assessedAt: FIXED_NOW });
}

function buildRealConfidenceResult() {
  const link: ClaimEvidenceLink = {
    id: 'cel_scoring_guard',
    claimId: 'claim_scoring_guard',
    claimVersionId: 'cver_scoring_guard',
    evidenceId: 'ev_scoring_guard',
    role: 'supporting',
    lineageRootId: 'ev_scoring_guard',
    credible: true,
    sourceClassification: 'primary_archival',
    directness: 0.9,
    temporalProximity: 0.8,
    geographicPrecision: 0.8,
    entityMatchQuality: 0.9,
    extractionQuality: 0.85,
    createdAt: FIXED_NOW,
  };
  assertClaimEvidenceLinkValid(link);
  return calculateClaimConfidence({
    claimClass: 'standard',
    evidenceLinks: [link],
    calculatedAt: FIXED_NOW,
  });
}

test('assertAdvisoryAbsentFromScoringInput throws when a composite/scoring-shaped value is poisoned with advisory data', () => {
  const poisonedFeature = {
    dimension: 'signal_strength',
    value: 1,
    weight: 0.35,
    contribution: 0.35,
    rationale: 'ok',
    advisoryClass: 'private_property',
  };
  assert.throws(() => assertAdvisoryAbsentFromScoringInput(poisonedFeature), AdvisoryValidationError);

  const poisonedNested = {
    schemaVersion: 'relevance-assessment.v1',
    featureValues: [
      { dimension: 'signal_strength', value: 1, weight: 0.35, contribution: 0.35, rationale: 'ok' },
    ],
    modernContext: { sourcedClaimIds: ['claim_x'], reviewCadence: 'annual' },
  };
  assert.throws(() => assertAdvisoryAbsentFromScoringInput(poisonedNested), AdvisoryValidationError);
});

test('the REAL relevance composite (evaluateCandidateRelevance) never carries advisory fields', () => {
  const assessment = buildRealRelevanceAssessment();
  assert.doesNotThrow(() => assertAdvisoryAbsentFromScoringInput(assessment));

  const serialized = JSON.stringify(assessment).toLowerCase();
  assert.equal(serialized.includes('advisory'), false);
  for (const advisoryClass of ADVISORY_CLASSES) {
    assert.equal(serialized.includes(advisoryClass), false);
  }
});

test('the REAL confidence composite (calculateClaimConfidence) never carries advisory fields', () => {
  const result = buildRealConfidenceResult();
  assert.doesNotThrow(() => assertAdvisoryAbsentFromScoringInput(result));

  const serialized = JSON.stringify(result).toLowerCase();
  assert.equal(serialized.includes('advisory'), false);
});

test('RELEVANCE_DIMENSIONS and CONFIDENCE_COMPONENT_WEIGHTS keys never overlap with advisory field names', () => {
  const bannedKeys = new Set(ADVISORY_SCORING_BANNED_KEYS as readonly string[]);
  for (const dimension of RELEVANCE_DIMENSIONS) {
    assert.equal(bannedKeys.has(dimension), false);
  }
  for (const weightKey of Object.keys(CONFIDENCE_COMPONENT_WEIGHTS)) {
    assert.equal(bannedKeys.has(weightKey), false);
  }
});

test('compile-time no-overlap invariants hold (the real gate is `pnpm --filter @blap/domain typecheck`)', () => {
  // These booleans are typed `NoKeyOverlap<...>` in advisory.ts, not plain `boolean` if a
  // future field name collision is ever introduced, advisory.ts itself fails to typecheck before
  // this runtime assertion is even reached.
  assert.equal(ADVISORY_SCORING_TYPE_INVARIANTS.noOverlapWithRelevanceFeatureValue, true);
  assert.equal(ADVISORY_SCORING_TYPE_INVARIANTS.noOverlapWithRelevanceAssessment, true);
  assert.equal(ADVISORY_SCORING_TYPE_INVARIANTS.noOverlapWithConfidenceComponents, true);
});
