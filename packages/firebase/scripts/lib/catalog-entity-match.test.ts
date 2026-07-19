/**
 * Unit tests for catalog-entity-match: non-entity detection and existing-entity
 * collisions (Katherine Johnson, Greenwood, etc.).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCatalogMatchIndex,
  classifyLeadAgainstCatalog,
  normalizePersonOrPlaceName,
  type CatalogEntityRef,
} from './catalog-entity-match.ts';

const FIXTURES: CatalogEntityRef[] = [
  { id: 'ent_katherine_johnson_001', displayName: 'Katherine Johnson', aliases: ['Katherine G. Johnson'] },
  { id: 'ent_mary_jackson_001', displayName: 'Mary Jackson', aliases: ['Mary W. Jackson'] },
  { id: 'ent_dorothy_vaughan_001', displayName: 'Dorothy Vaughan', aliases: [] },
  { id: 'ent_greenwood_district_001', displayName: 'Greenwood District', aliases: ['Black Wall Street'] },
  { id: 'ent_tuskegee_university_001', displayName: 'Tuskegee University', aliases: ['Tuskegee Institute'] },
  { id: 'ent_ellen_eglin_001', displayName: 'Ellen Eglin', aliases: [] },
];

test('normalize strips Wikipedia/NASA suffixes', () => {
  assert.equal(
    normalizePersonOrPlaceName('Katherine Johnson Biography - NASA'),
    'katherine johnson biography',
  );
});

test('lists and indexes classify as non_entity', () => {
  const index = buildCatalogMatchIndex(FIXTURES);
  const result = classifyLeadAgainstCatalog({
    title: 'List of African-American inventors and scientists - Wikipedia',
    index,
  });
  assert.equal(result.kind, 'non_entity');
});

test('Katherine Johnson NASA pages match existing entity', () => {
  const index = buildCatalogMatchIndex(FIXTURES);
  const result = classifyLeadAgainstCatalog({
    title: 'Katherine Johnson Biography - NASA',
    index,
  });
  assert.equal(result.kind, 'existing_match');
  assert.equal(result.matchedEntityId, 'ent_katherine_johnson_001');
});

test('Black Wall Street matches Greenwood', () => {
  const index = buildCatalogMatchIndex(FIXTURES);
  const result = classifyLeadAgainstCatalog({
    title: 'Black Wall Street in Tulsa, OK Destroyed on 6/1/1921 - This Month in ...',
    index,
  });
  assert.equal(result.kind, 'existing_match');
  assert.equal(result.matchedEntityId, 'ent_greenwood_district_001');
});

test('Ellen Eglin is new_candidate when not colliding with lists', () => {
  const index = buildCatalogMatchIndex(
    FIXTURES.filter((entity) => entity.id !== 'ent_ellen_eglin_001'),
  );
  const result = classifyLeadAgainstCatalog({
    title: 'Ellen Eglin - Wikipedia',
    index,
  });
  assert.equal(result.kind, 'new_candidate');
});

test('Ellen Eglin matches after she is in catalog', () => {
  const index = buildCatalogMatchIndex(FIXTURES);
  const result = classifyLeadAgainstCatalog({
    title: 'Ellen Eglin - Wikipedia',
    index,
  });
  assert.equal(result.kind, 'existing_match');
  assert.equal(result.matchedEntityId, 'ent_ellen_eglin_001');
});
