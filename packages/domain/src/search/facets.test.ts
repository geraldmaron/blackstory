/**
 * Tests for faceting + allowlisted filtering, including the `status` and `era`
 * additions. Fixtures reuse the real status vocabularies and `deriveEraBuckets` era
 * labels rather than inventing parallel vocab.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LAW_STATUSES, MOVEMENT_STATUSES, PLACE_LIKE_STATUSES } from '../entity-status.js';
import { deriveEraBuckets } from '../era.js';
import { applyFilters, computeFacetCounts } from './facets.js';
import type { SearchFilter, SearchableEntityRecord } from './types.js';

function record(
  overrides: Partial<SearchableEntityRecord> & Pick<SearchableEntityRecord, 'id' | 'displayName'>,
): SearchableEntityRecord {
  const displayName = overrides.displayName;
  return {
    kind: 'place',
    aliases: [],
    topicTags: [],
    eraBuckets: [],
    notabilityBasis: [{ criterion: 'documented_site', note: 'basis', evidenceIds: ['ev-1'] }],
    notabilityLabels: ['A documented site.'],
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    relatedCount: 0,
    claimCount: 0,
    ...overrides,
    id: overrides.id,
    displayName,
    nameLower: overrides.nameLower ?? displayName.toLowerCase(),
  };
}

// Era labels sourced from the shared era model, never hand-typed.
const CIVIL_RIGHTS_ERA = deriveEraBuckets({ validFrom: '1955', validTo: '1968', datePrecision: 'year' });
const EIGHTIES = deriveEraBuckets({ validFrom: '1985', datePrecision: 'year' });

test('computeFacetCounts aggregates every dimension, incrementing multi-valued fields per value', () => {
  const records = [
    record({
      id: '1',
      displayName: 'Place One',
      kind: 'place',
      status: PLACE_LIKE_STATUSES[0], // 'active'
      eraBuckets: CIVIL_RIGHTS_ERA, // ['1950s','1960s']
      topicTags: ['education', 'community'],
      jurisdictionState: 'Alabama',
      recordMaturity: 'partial_enrichment',
      researchCoverage: 'substantial',
    }),
    record({
      id: '2',
      displayName: 'Statute Two',
      kind: 'law',
      status: LAW_STATUSES[0], // 'in_force'
      eraBuckets: EIGHTIES, // ['1980s']
      topicTags: ['education'],
      jurisdictionState: 'Georgia',
      recordMaturity: 'minimum_record',
      researchCoverage: 'minimal',
    }),
  ];

  const facets = computeFacetCounts(records);
  assert.deepEqual(facets.kind, { place: 1, law: 1 });
  assert.deepEqual(facets.status, { active: 1, in_force: 1 });
  assert.equal(facets.era['1950s'], 1);
  assert.equal(facets.era['1960s'], 1);
  assert.equal(facets.era['1980s'], 1);
  assert.equal(facets.theme.education, 2);
  assert.equal(facets.theme.community, 1);
  assert.deepEqual(facets.state, { Alabama: 1, Georgia: 1 });
  assert.deepEqual(facets.recordMaturity, { partial_enrichment: 1, minimum_record: 1 });
  assert.deepEqual(facets.researchCoverage, { substantial: 1, minimal: 1 });
});

test('a status filter narrows results using the BB-090 status vocabularies', () => {
  const active = record({ id: 'place', displayName: 'Active Place', status: PLACE_LIKE_STATUSES[0] });
  const inForce = record({ id: 'law', displayName: 'In-Force Statute', kind: 'law', status: LAW_STATUSES[0] });
  const historicMovement = record({
    id: 'movement',
    displayName: 'Historic Movement',
    kind: 'movement',
    status: MOVEMENT_STATUSES[1], // 'historic'
  });

  const filtered = applyFilters([active, inForce, historicMovement], [
    { field: 'status', value: LAW_STATUSES[0] },
  ]);
  assert.deepEqual(
    filtered.map((r) => r.id),
    ['law'],
  );
});

test('an era filter narrows results using deriveEraBuckets labels', () => {
  const civilRights = record({ id: 'cr', displayName: 'Civil Rights Place', eraBuckets: CIVIL_RIGHTS_ERA });
  const eighties = record({ id: 'e80', displayName: 'Eighties Place', eraBuckets: EIGHTIES });

  const filtered = applyFilters([civilRights, eighties], [{ field: 'era', value: '1960s' }]);
  assert.deepEqual(
    filtered.map((r) => r.id),
    ['cr'],
  );
});

test('multiple filters combine with AND semantics across fields', () => {
  const match = record({ id: 'match', displayName: 'M', kind: 'school', status: PLACE_LIKE_STATUSES[0] });
  const wrongKind = record({ id: 'wrong-kind', displayName: 'WK', kind: 'place', status: PLACE_LIKE_STATUSES[0] });
  const wrongStatus = record({ id: 'wrong-status', displayName: 'WS', kind: 'school', status: PLACE_LIKE_STATUSES[1] });

  const filters: readonly SearchFilter[] = [
    { field: 'kind', value: 'school' },
    { field: 'status', value: PLACE_LIKE_STATUSES[0] },
  ];
  const filtered = applyFilters([match, wrongKind, wrongStatus], filters);
  assert.deepEqual(
    filtered.map((r) => r.id),
    ['match'],
  );
});

test('a precision filter is a pass-through no-op and never crashes', () => {
  const a = record({ id: 'a', displayName: 'A' });
  const b = record({ id: 'b', displayName: 'B' });
  const filtered = applyFilters([a, b], [{ field: 'precision', value: 'city' }]);
  assert.deepEqual(
    filtered.map((r) => r.id),
    ['a', 'b'],
  );
});

test('no filters returns the input set unchanged', () => {
  const records = [record({ id: 'a', displayName: 'A' })];
  assert.equal(applyFilters(records, []), records);
});
