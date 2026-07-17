/**
 * Tests for Layer 3 exclusion infrastructure: HOLC A-D grade weights and covenant combination.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RedliningGradeDesignationRecord, RestrictiveCovenantDesignationRecord } from './layer-record.js';
import {
  computeExclusionInfrastructureLayerSignal,
  HOLC_GRADE_WEIGHTS,
  RESTRICTIVE_COVENANT_PRESENCE_WEIGHT,
} from './exclusion-infrastructure.js';
import type { LayerCitation } from './types.js';

const PLACE = 'place_exclusion_1';
const AREA_GEOMETRY = {
  shape: { type: 'Polygon' as const, coordinates: [[-90, 32], [-90, 33], [-89, 33], [-89, 32], [-90, 32]] },
  documentedPrecisionTier: 'locality' as const,
};

const CITATION: LayerCitation = {
  claimId: 'claim_holc_1',
  sourceLabel: 'Mapping Inequality (Univ. of Richmond DSL)',
  retrievedAt: '2026-01-01T00:00:00.000Z',
};

function redliningRecord(grade: RedliningGradeDesignationRecord['grade']): RedliningGradeDesignationRecord {
  return {
    id: `holc_${grade}`,
    placeEntityId: PLACE,
    designation: 'redlining_grade',
    grade,
    validFrom: '1935',
    validTo: null,
    datePrecision: 'year',
    basisClaimIds: ['claim_holc_1'],
    areaGeometry: AREA_GEOMETRY,
  };
}

test('HOLC_GRADE_WEIGHTS maps A-D with D as the most exclusionary designation', () => {
  assert.equal(HOLC_GRADE_WEIGHTS.A, 0);
  assert.equal(HOLC_GRADE_WEIGHTS.B, 0.33);
  assert.equal(HOLC_GRADE_WEIGHTS.C, 0.67);
  assert.equal(HOLC_GRADE_WEIGHTS.D, 1);
  assert.ok(HOLC_GRADE_WEIGHTS.A < HOLC_GRADE_WEIGHTS.B);
  assert.ok(HOLC_GRADE_WEIGHTS.B < HOLC_GRADE_WEIGHTS.C);
  assert.ok(HOLC_GRADE_WEIGHTS.C < HOLC_GRADE_WEIGHTS.D);
});

test('returns undefined when neither redlining nor covenant records exist for the place', () => {
  assert.equal(
    computeExclusionInfrastructureLayerSignal({
      placeEntityId: PLACE,
      redliningRecords: [],
      covenantRecords: [],
      citationsByClaimId: new Map(),
    }),
    undefined,
  );
});

test('each HOLC grade A-D produces the published weight in the layer signal', () => {
  for (const grade of ['A', 'B', 'C', 'D'] as const) {
    const signal = computeExclusionInfrastructureLayerSignal({
      placeEntityId: PLACE,
      redliningRecords: [redliningRecord(grade)],
      covenantRecords: [],
      citationsByClaimId: new Map([['claim_holc_1', CITATION]]),
    });
    assert.equal(signal?.layerId, 'exclusion_infrastructure');
    assert.equal(signal?.value, HOLC_GRADE_WEIGHTS[grade]);
    assert.equal(signal?.notes, `HOLC grade: ${grade}`);
  }
});

test('restrictive covenant presence combines with HOLC grade via a saturating formula', () => {
  const covenant: RestrictiveCovenantDesignationRecord = {
    id: 'cov_1',
    placeEntityId: PLACE,
    designation: 'restrictive_covenant',
    covenantProjectLabel: 'Mapping Prejudice',
    validFrom: '1920',
    validTo: null,
    datePrecision: 'year',
    basisClaimIds: ['claim_cov_1'],
    areaGeometry: AREA_GEOMETRY,
  };
  const holcWeight = HOLC_GRADE_WEIGHTS.C;
  const expected = holcWeight + RESTRICTIVE_COVENANT_PRESENCE_WEIGHT * (1 - holcWeight);

  const signal = computeExclusionInfrastructureLayerSignal({
    placeEntityId: PLACE,
    redliningRecords: [redliningRecord('C')],
    covenantRecords: [covenant],
    citationsByClaimId: new Map([
      ['claim_holc_1', CITATION],
      ['claim_cov_1', { ...CITATION, claimId: 'claim_cov_1' }],
    ]),
  });
  assert.equal(signal?.value, expected);
  assert.ok((signal?.value ?? 0) <= 1);
});

test('fails closed when a basis claim has no registered citation', () => {
  assert.throws(
    () =>
      computeExclusionInfrastructureLayerSignal({
        placeEntityId: PLACE,
        redliningRecords: [redliningRecord('D')],
        covenantRecords: [],
        citationsByClaimId: new Map(),
      }),
    /No LayerCitation registered/,
  );
});
