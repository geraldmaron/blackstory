/**
 * Tests for deterministic catalog status derivation.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveCatalogEntityStatus } from './derive-catalog-status.js';

test('events remain statusless', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_event_1',
    kind: 'event',
    summary: 'A sit-in at a lunch counter in 1960.',
  });
  assert.equal(derived.statusHistory, undefined);
  assert.equal(derived.status, undefined);
});

test('laws default to in_force unless text says otherwise', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_law_1',
    kind: 'law',
    displayName: 'Civil Rights Act of 1964',
    summary: 'Passed in 1964, the Act outlawed discrimination.',
    eraBuckets: ['1960s'],
    claims: [{ id: 'c1', predicate: 'enacted_on', object: 'July 2, 1964' }],
  });
  assert.equal(derived.status, 'in_force');
  assert.equal(derived.statusHistory?.[0]?.status, 'in_force');
  assert.equal(derived.statusHistory?.[0]?.validFrom, '1960');
});

test('struck-down language yields struck_down', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_law_2',
    kind: 'law',
    summary: 'The Court struck down the ordinance in 1883.',
  });
  assert.equal(derived.status, 'struck_down');
});

test('place-like historic cues yield historic', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_place_1',
    kind: 'place',
    displayName: 'Fort Mose',
    summary: 'A former free Black settlement; archaeological ruins remain.',
    eraBuckets: ['1730s'],
  });
  assert.equal(derived.status, 'historic');
});

test('universities default active', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_school_1',
    kind: 'school',
    summary: 'Howard University remains a working research university in Washington, D.C.',
    eraBuckets: ['1860s'],
  });
  assert.equal(derived.status, 'active');
});

test('persons derive livingStatus from death cues', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_person_1',
    kind: 'person',
    summary: 'She died in 1913 after a long career as an educator.',
  });
  assert.equal(derived.livingStatus, 'deceased');
  assert.equal(derived.status, 'deceased');
  assert.equal(derived.statusHistory, undefined);
});

test('authored statusHistory is preserved', () => {
  const history = [
    {
      status: 'active' as const,
      validFrom: '1841',
      datePrecision: 'year' as const,
      basisClaimIds: ['c1'],
    },
  ];
  const derived = deriveCatalogEntityStatus({
    id: 'ent_place_2',
    kind: 'place',
    statusHistory: history,
  });
  assert.equal(derived.statusHistory, history);
  assert.equal(derived.status, 'active');
});
