/**
 * Public place slugs never carry catalog ids, and Tulsa is detectable as fallback-only.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import {
  atlasWalkHref,
  canStandHere,
  isInternalRecordLabel,
  isPublicPlaceSlug,
  isTulsaPlace,
  neighborHref,
  placeHref,
  placePageHolds,
  publicPlaceSlug,
  SEED_HOLDING_PLACE_SLUGS,
} from './public-place-path';

test('slug comes from the published name, never the catalog id', () => {
  assert.equal(
    publicPlaceSlug('Paul Laurence Dunbar High School'),
    'paul-laurence-dunbar-high-school',
  );
  assert.equal(
    publicPlaceSlug('Fifteenth Street Presbyterian Church'),
    'fifteenth-street-presbyterian-church',
  );
  assert.equal(
    placeHref('Fifteenth Street Presbyterian Church'),
    '/place/fifteenth-street-presbyterian-church',
  );
  assert.doesNotMatch(placeHref('Vernon AME Church'), /ent_/);
});

test('internal labels and ent_ tokens are not public slugs', () => {
  assert.equal(isInternalRecordLabel('ent_vernon_ame_tulsa_001'), true);
  assert.equal(isPublicPlaceSlug('ent_vernon_ame_tulsa_001'), false);
  assert.equal(isPublicPlaceSlug('ent-vernon-ame-tulsa-001'), false);
  assert.equal(isPublicPlaceSlug('fifteenth-street-presbyterian-church'), true);
  assert.equal(isPublicPlaceSlug('42Cb1758'), false);
});

test('Tulsa / Greenwood is detectable so it can stay last-resort', () => {
  assert.equal(
    isTulsaPlace({
      displayName: 'Greenwood District',
      locationLabel: 'Tulsa, Oklahoma',
    }),
    true,
  );
  assert.equal(
    isTulsaPlace({
      displayName: 'Paul Laurence Dunbar High School',
      locationLabel: 'Washington, D.C.',
    }),
    false,
  );
});

test('a living private person cannot be the stand', () => {
  assert.equal(
    canStandHere({
      displayName: 'A private resident',
      kind: 'person',
      summary: 'A person.',
    }),
    false,
  );
  assert.equal(
    canStandHere({
      displayName: 'Paul Laurence Dunbar High School',
      kind: 'organization',
      summary: 'A public high school in Washington, D.C.',
      locationPrecision: 'locality',
    }),
    true,
  );
});

test('neighbor hrefs stay off internal ids', () => {
  assert.equal(
    neighborHref({ displayName: 'Fifteenth Street Presbyterian Church', kind: 'organization' }),
    '/place/fifteenth-street-presbyterian-church',
  );
  assert.equal(neighborHref({ displayName: 'A named neighbor', kind: 'person' }), '/memorial');
  assert.equal(neighborHref({ displayName: 'A statute on this record', kind: 'law' }), '/law');
});

test('seed holding slugs match the place page seed path, and are not invented', () => {
  const computed = listPublicEntities()
    .filter((entity) => canStandHere(entity))
    .map((entity) => publicPlaceSlug(entity.displayName))
    .sort();
  assert.deepEqual([...SEED_HOLDING_PLACE_SLUGS].sort(), computed);
});

test('the home-map walk uses a holding slug, never a slugified name or /entity/', () => {
  assert.equal(
    atlasWalkHref({ displayName: 'Paul Laurence Dunbar High School', kind: 'organization' }),
    '/place/paul-laurence-dunbar-high-school',
  );
  assert.equal(
    atlasWalkHref({
      displayName: 'African American Research Library and Cultural Center',
      kind: 'place',
      entityId: 'ent_aarlcc_fort_lauderdale_001',
    }),
    '/place/african-american-research-library-and-cultural-center',
  );
  assert.equal(
    atlasWalkHref({
      displayName: 'Archie Edwards Alpha Tonsorial Palace',
      kind: 'place',
    }),
    undefined,
  );
  assert.equal(atlasWalkHref({ displayName: 'Barnett Aden Gallery', kind: 'place' }), undefined);
  assert.equal(atlasWalkHref({ displayName: 'A named neighbor', kind: 'person' }), '/memorial');
  assert.equal(atlasWalkHref({ displayName: 'ent_dunbar_school_001' }), undefined);
  assert.equal(atlasWalkHref({ displayName: '42Cb1758', kind: 'place' }), undefined);
  assert.equal(placePageHolds({ displayName: 'Industrial Bank of Washington' }), false);
});
