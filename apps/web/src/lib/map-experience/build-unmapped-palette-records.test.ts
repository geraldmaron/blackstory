/**
 * `buildUnmappedPaletteRecords` (repo-jnmwu): the Explore palette's corpus must match
 * `/search/api`'s, not just the entities `exploreMapSourceFor` could place on the map.
 *
 * Built over `listPublicEntities()`'s real fixtures rather than hand-rolled minimal objects, per
 * this package's convention (`build-explore-map-source.test.ts`) — spread + override keeps every
 * required `PublicEntityView` field real instead of a test inventing its own stand-in shape.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities, type PublicEntityView } from '../../data/public-seed';
import { buildUnmappedPaletteRecords } from './build-palette-records';

const SEED = listPublicEntities();
const CHURCH = SEED.find((entity) => entity.id === 'ent_15th_st_church_001')!;
const SCHOOL = SEED.find((entity) => entity.id === 'ent_dunbar_school_001')!;
assert.ok(CHURCH && SCHOOL, 'seed fixture ids moved; update this test');

const NOTABLE: PublicEntityView['notabilityBasis'] = [
  { criterion: 'landmark_or_national_register', note: 'test fixture', evidenceIds: [] },
];

test('an entity missing from the mapped set is included when it passes the notability gate', () => {
  const records = buildUnmappedPaletteRecords([{ ...CHURCH, notabilityBasis: NOTABLE }], new Set());
  assert.equal(records.length, 1);
  assert.equal(records[0]!.id, CHURCH.id);
  assert.equal(records[0]!.name, CHURCH.displayName);
});

test('an entity already in the mapped set is never duplicated into this corpus', () => {
  const records = buildUnmappedPaletteRecords(
    [{ ...CHURCH, notabilityBasis: NOTABLE }],
    new Set([CHURCH.id]),
  );
  assert.equal(records.length, 0);
});

test('an entity with zero notabilityBasis records is excluded — same gate the search index build enforces', () => {
  // The bundled seed catalog predates notabilityBasis (see its own doc comment), so CHURCH
  // already carries none — no override needed to exercise the exclusion.
  assert.equal(CHURCH.notabilityBasis, undefined);
  const records = buildUnmappedPaletteRecords([CHURCH], new Set());
  assert.equal(records.length, 0);
});

test('place falls back to jurisdictionLabel, the one location field every entity carries regardless of a map anchor', () => {
  const records = buildUnmappedPaletteRecords(
    [{ ...SCHOOL, notabilityBasis: NOTABLE, jurisdictionLabel: 'Washington, D.C.' }],
    new Set(),
  );
  assert.equal(records[0]!.place, 'Washington, D.C.');
});

test('kind rides along so AtlasExperience can route a fallback open correctly', () => {
  const records = buildUnmappedPaletteRecords([{ ...CHURCH, notabilityBasis: NOTABLE }], new Set());
  assert.equal(records[0]!.kind, CHURCH.kind);
});

test('only the entities missing from the mapped set are returned, in source order', () => {
  const records = buildUnmappedPaletteRecords(
    [
      { ...CHURCH, notabilityBasis: NOTABLE },
      { ...SCHOOL, notabilityBasis: NOTABLE },
    ],
    new Set([SCHOOL.id]),
  );
  assert.deepEqual(
    records.map((record) => record.id),
    [CHURCH.id],
  );
});
