/**
 * The Footprint aggregate. Label forms are the ones the active release carries (see
 * footprint-attribution.test.ts); coordinates are real places so the projection is exercised.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFootprint } from './footprint.js';
import type { PublishedJurisdictionRow } from './published-jurisdictions.js';

let nextId = 0;
function row(overrides: Partial<PublishedJurisdictionRow>): PublishedJurisdictionRow {
  nextId += 1;
  return {
    entityId: `e${nextId}`,
    jurisdictionLabel: 'Alsip, Illinois',
    kind: 'place',
    recordMaturity: 'minimum_record',
    lat: null,
    lng: null,
    ...overrides,
  };
}

function build(rows: readonly PublishedJurisdictionRow[]) {
  return buildFootprint({ releaseId: 'r1', rows });
}

test('state totals plus unassigned reconcile to the published total', () => {
  const footprint = build([
    row({ jurisdictionLabel: 'Alsip, Illinois' }),
    row({ jurisdictionLabel: 'Selma, AL' }),
    row({ jurisdictionLabel: 'Indiana' }),
    row({ jurisdictionLabel: 'San Juan, Puerto Rico' }),
    row({ jurisdictionLabel: null }),
  ]);
  const stateSum = footprint.states.reduce((sum, state) => sum + state.total, 0);
  assert.equal(footprint.publishedTotal, 5);
  assert.equal(stateSum + footprint.unassigned, footprint.publishedTotal);
  assert.equal(stateSum, 3);
});

test('maturity buckets: minimum, partial, and everything else including null', () => {
  const footprint = build([
    row({ recordMaturity: 'minimum_record' }),
    row({ recordMaturity: 'partial_enrichment' }),
    row({ recordMaturity: null }),
    row({ recordMaturity: 'something_new' }),
  ]);
  const illinois = footprint.states.find((state) => state.postalCode === 'IL');
  assert.equal(illinois?.total, 4);
  assert.equal(illinois?.minimumRecord, 1);
  assert.equal(illinois?.partialEnrichment, 1);
  assert.equal(illinois?.otherMaturity, 2);
  assert.equal(footprint.minimumRecordTotal, 1);
});

test('emptyStates lists states with no rows and omits states with rows', () => {
  const footprint = build([row({ jurisdictionLabel: 'Selma, AL' })]);
  const codes = footprint.emptyStates.map((state) => state.postalCode);
  assert.ok(codes.includes('IL'));
  assert.ok(!codes.includes('AL'));
  assert.equal(footprint.states.length + footprint.emptyStates.length, 51);
});

test('a territory label and a null label both count as unassigned', () => {
  const footprint = build([
    row({ jurisdictionLabel: 'Hagatna, Guam' }),
    row({ jurisdictionLabel: null }),
    row({ jurisdictionLabel: 'Selma, AL' }),
  ]);
  assert.equal(footprint.unassigned, 2);
  assert.equal(footprint.states.length, 1);
});

test('nearby points share one bin; a point outside the projection is off the map', () => {
  const footprint = build([
    row({ lat: 41.88, lng: -87.63 }),
    row({ lat: 41.881, lng: -87.631 }),
    row({ lat: 6.3, lng: -10.8 }),
    row({ lat: null, lng: null }),
  ]);
  assert.equal(footprint.mapBins.length, 1);
  assert.equal(footprint.mapBins[0]?.count, 2);
  assert.equal(footprint.offMap, 2);
  // Every row is drawn or off the map.
  const drawn = footprint.mapBins.reduce((sum, bin) => sum + bin.count, 0);
  assert.equal(drawn + footprint.offMap, footprint.publishedTotal);
});

test('states sort by total then name; kinds by count', () => {
  const footprint = build([
    row({ jurisdictionLabel: 'Selma, AL', kind: 'person' }),
    row({ jurisdictionLabel: 'Alsip, Illinois', kind: 'place' }),
    row({ jurisdictionLabel: 'Chicago, Illinois', kind: 'place' }),
    row({ jurisdictionLabel: 'Indiana', kind: 'place' }),
  ]);
  assert.deepEqual(
    footprint.states.map((state) => state.postalCode),
    ['IL', 'AL', 'IN'],
  );
  assert.deepEqual(footprint.kinds, [
    { kind: 'place', count: 3 },
    { kind: 'person', count: 1 },
  ]);
  const names = footprint.emptyStates.map((state) => state.name);
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b)),
  );
});
