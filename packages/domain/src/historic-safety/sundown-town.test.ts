/**
 * Tests for Layer 2 \u2014 sundown-town designation history (Tougaloo taxonomy).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SundownTownDesignationRecord } from './layer-record.js';
import { computeSundownTownLayerSignal, SUNDOWN_TOWN_CONFIDENCE_WEIGHTS } from './sundown-town.js';
import type { LayerCitation } from './types.js';

const AREA_GEOMETRY = {
  shape: { type: 'Polygon' as const, coordinates: [[-90, 32], [-90, 33], [-89, 33], [-89, 32], [-90, 32]] },
  documentedPrecisionTier: 'locality' as const,
};

const CITATION: LayerCitation = {
  claimId: 'claim_1',
  sourceLabel: 'Tougaloo College Historical Database of Sundown Towns',
  retrievedAt: '2026-01-01T00:00:00.000Z',
};

test('returns undefined with no designation records for the place', () => {
  const result = computeSundownTownLayerSignal({
    placeEntityId: 'place_1',
    records: [],
    citationsByClaimId: new Map(),
  });
  assert.equal(result, undefined);
});

test('possible/probable/surely map to distinct, ascending published weights', () => {
  assert.ok(SUNDOWN_TOWN_CONFIDENCE_WEIGHTS.possible < SUNDOWN_TOWN_CONFIDENCE_WEIGHTS.probable);
  assert.ok(SUNDOWN_TOWN_CONFIDENCE_WEIGHTS.probable < SUNDOWN_TOWN_CONFIDENCE_WEIGHTS.surely);
  assert.equal(SUNDOWN_TOWN_CONFIDENCE_WEIGHTS.surely, 1);
});

test('computes a layer signal from the current (open-ended) designation and preserves the verbatim label', () => {
  const record: SundownTownDesignationRecord = {
    id: 'stown_1',
    placeEntityId: 'place_1',
    designation: 'sundown_town',
    confidence: 'probable',
    validFrom: '1940',
    validTo: null,
    datePrecision: 'decade',
    basisClaimIds: ['claim_1'],
    areaGeometry: AREA_GEOMETRY,
  };
  const signal = computeSundownTownLayerSignal({
    placeEntityId: 'place_1',
    records: [record],
    citationsByClaimId: new Map([['claim_1', CITATION]]),
  });
  assert.equal(signal?.layerId, 'sundown_town');
  assert.equal(signal?.value, SUNDOWN_TOWN_CONFIDENCE_WEIGHTS.probable);
  assert.equal(signal?.notes, 'Tougaloo confidence: probable');
  assert.match(signal?.methodologyNote.summary ?? '', /possible \/ probable \/ surely/);
});

test('answers a point-in-time query for a decade covered by a closed-window designation', () => {
  const record: SundownTownDesignationRecord = {
    id: 'stown_1',
    placeEntityId: 'place_1',
    designation: 'sundown_town',
    confidence: 'surely',
    validFrom: '1920',
    validTo: '1960',
    datePrecision: 'decade',
    basisClaimIds: ['claim_1'],
    areaGeometry: AREA_GEOMETRY,
  };
  const signal = computeSundownTownLayerSignal({
    placeEntityId: 'place_1',
    records: [record],
    asOf: '1935',
    citationsByClaimId: new Map([['claim_1', CITATION]]),
  });
  assert.equal(signal?.value, SUNDOWN_TOWN_CONFIDENCE_WEIGHTS.surely);
  assert.equal(signal?.asOf, '1935');
});

test('fails closed when a basis claim has no registered citation', () => {
  const record: SundownTownDesignationRecord = {
    id: 'stown_1',
    placeEntityId: 'place_1',
    designation: 'sundown_town',
    confidence: 'possible',
    validFrom: '1940',
    validTo: null,
    datePrecision: 'decade',
    basisClaimIds: ['claim_unresolved'],
    areaGeometry: AREA_GEOMETRY,
  };
  assert.throws(
    () =>
      computeSundownTownLayerSignal({
        placeEntityId: 'place_1',
        records: [record],
        citationsByClaimId: new Map(),
      }),
    /No LayerCitation registered/,
  );
});
