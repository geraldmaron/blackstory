/**
 * Tests for own time-scoped, evidence-backed place-condition layer records (,,
 * ) \u2014 distinct from statusHistory, distinct vocabularies for sundown-town vs.
 * redlining grade, area-only geometry, and the precision-fidelity rule.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HOLC_GRADES,
  SUNDOWN_TOWN_CONFIDENCE_LEVELS,
  assertAreaConditionGeometryValid,
  assertAreaConditionRenderPrecisionValid,
  assertPlaceConditionDesignationValid,
  createInMemoryPlaceConditionLayerStore,
  currentRedliningGrade,
  currentSundownTownConfidence,
  redliningGradeAsOf,
  sundownTownConfidenceAsOf,
  type RedliningGradeDesignationRecord,
  type SundownTownDesignationRecord,
} from './layer-record.js';

const COUNTY_POLYGON_GEOMETRY = {
  shape: { type: 'Polygon' as const, coordinates: [[-90, 32], [-90, 33], [-89, 33], [-89, 32], [-90, 32]] },
  documentedPrecisionTier: 'county' as const,
  jurisdictionId: 'us-28-001',
};

test('Tougaloo taxonomy is preserved verbatim as possible/probable/surely, never a boolean', () => {
  assert.deepEqual(SUNDOWN_TOWN_CONFIDENCE_LEVELS, ['possible', 'probable', 'surely']);
});

test('HOLC grades are the distinct A-D vocabulary, never the sundown taxonomy', () => {
  assert.deepEqual(HOLC_GRADES, ['A', 'B', 'C', 'D']);
  assert.equal((HOLC_GRADES as readonly string[]).some((g) => (SUNDOWN_TOWN_CONFIDENCE_LEVELS as readonly string[]).includes(g)), false);
});

test('area-condition geometry rejects a Point \u2014 area conditions never render as a point marker (AC9)', () => {
  assert.throws(
    () =>
      assertAreaConditionGeometryValid({
        shape: { type: 'Point', coordinates: [-90, 32] } as never,
        documentedPrecisionTier: 'county',
      }),
    /never a point marker/,
  );
});

test('area-condition geometry accepts a Polygon or BBox', () => {
  assert.doesNotThrow(() => assertAreaConditionGeometryValid(COUNTY_POLYGON_GEOMETRY));
  assert.doesNotThrow(() =>
    assertAreaConditionGeometryValid({
      shape: { type: 'BBox', bbox: [-90, 32, -89, 33] },
      documentedPrecisionTier: 'county',
    }),
  );
});

test('render precision must never be finer than documented precision (AC11)', () => {
  assert.throws(
    () =>
      assertAreaConditionRenderPrecisionValid({
        documentedPrecisionTier: 'county',
        renderPrecisionTier: 'exact-site',
      }),
    /finer than the documented precision/,
  );
  assert.doesNotThrow(() =>
    assertAreaConditionRenderPrecisionValid({ documentedPrecisionTier: 'county', renderPrecisionTier: 'county' }),
  );
  assert.doesNotThrow(() =>
    assertAreaConditionRenderPrecisionValid({ documentedPrecisionTier: 'county', renderPrecisionTier: 'state' }),
  );
});

test('sundown-town designation requires >=1 basisClaimIds \u2014 never an unsourced designation', () => {
  const record: SundownTownDesignationRecord = {
    id: 'stown_1',
    placeEntityId: 'place_1',
    designation: 'sundown_town',
    confidence: 'probable',
    validFrom: '1950',
    datePrecision: 'decade',
    basisClaimIds: [],
    areaGeometry: COUNTY_POLYGON_GEOMETRY,
  };
  assert.throws(() => assertPlaceConditionDesignationValid(record), /basisClaimIds/);
});

test('point-in-time query answers a sundown-town confidence for any covered decade (AC8)', () => {
  const records: SundownTownDesignationRecord[] = [
    {
      id: 'stown_1',
      placeEntityId: 'place_1',
      designation: 'sundown_town',
      confidence: 'possible',
      validFrom: '1920',
      validTo: '1950',
      datePrecision: 'decade',
      basisClaimIds: ['claim_1'],
      areaGeometry: COUNTY_POLYGON_GEOMETRY,
    },
    {
      id: 'stown_2',
      placeEntityId: 'place_1',
      designation: 'sundown_town',
      confidence: 'surely',
      validFrom: '1950',
      validTo: null,
      datePrecision: 'decade',
      basisClaimIds: ['claim_2'],
      areaGeometry: COUNTY_POLYGON_GEOMETRY,
    },
  ];
  assert.equal(sundownTownConfidenceAsOf(records, '1935'), 'possible');
  assert.equal(sundownTownConfidenceAsOf(records, '1980'), 'surely');
  assert.equal(currentSundownTownConfidence(records), 'surely');
});

test('point-in-time query answers a redlining grade for any covered decade (AC8, AC12)', () => {
  const records: RedliningGradeDesignationRecord[] = [
    {
      id: 'holc_1',
      placeEntityId: 'place_2',
      designation: 'redlining_grade',
      grade: 'D',
      validFrom: '1935',
      validTo: '1970',
      datePrecision: 'year',
      basisClaimIds: ['claim_3'],
      areaGeometry: COUNTY_POLYGON_GEOMETRY,
    },
  ];
  assert.equal(redliningGradeAsOf(records, '1940'), 'D');
  assert.equal(redliningGradeAsOf(records, '1990'), undefined);
  assert.equal(currentRedliningGrade(records), undefined);
});

test('in-memory store rejects saving an invalid designation record', () => {
  const store = createInMemoryPlaceConditionLayerStore();
  assert.throws(
    () =>
      store.save({
        id: 'holc_bad',
        placeEntityId: 'place_3',
        designation: 'redlining_grade',
        grade: 'Z' as never,
        datePrecision: 'year',
        basisClaimIds: ['claim_4'],
        areaGeometry: COUNTY_POLYGON_GEOMETRY,
      }),
    /Unknown HOLC grade/,
  );
});

test('in-memory store lists records for a place sorted by validFrom', () => {
  const store = createInMemoryPlaceConditionLayerStore();
  store.save({
    id: 'holc_2',
    placeEntityId: 'place_4',
    designation: 'redlining_grade',
    grade: 'C',
    validFrom: '1940',
    datePrecision: 'year',
    basisClaimIds: ['claim_5'],
    areaGeometry: COUNTY_POLYGON_GEOMETRY,
  });
  store.save({
    id: 'holc_1',
    placeEntityId: 'place_4',
    designation: 'redlining_grade',
    grade: 'D',
    validFrom: '1935',
    datePrecision: 'year',
    basisClaimIds: ['claim_6'],
    areaGeometry: COUNTY_POLYGON_GEOMETRY,
  });
  const listed = store.listForPlace('place_4');
  assert.deepEqual(listed.map((r) => r.id), ['holc_1', 'holc_2']);
});
