/**
 * Public place slugs never carry catalog ids, and Tulsa is detectable as fallback-only.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import {
  atlasWalkHref,
  canStandHere,
  inventionHref,
  isHoldingPlaceHref,
  isInternalRecordLabel,
  isPublicPlaceSlug,
  isTulsaPlace,
  neighborHref,
  placeHref,
  placePageHolds,
  publicPlaceSlug,
  staysOffPublicMap,
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
  assert.equal(isInternalRecordLabel('42Cb1758'), true);
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

test('non-standable neighbors with an id open the entity room, not a fake Place', () => {
  assert.equal(
    neighborHref({
      id: 'ent_dillard_house_001',
      displayName: 'James H. Dillard House',
      kind: 'place',
      summary: 'A private residence kept off the public map.',
    }),
    '/entity/ent_dillard_house_001',
  );
  assert.equal(
    neighborHref({
      id: 'ent_thin_001',
      displayName: 'Thin Record',
      kind: 'organization',
      summary: '',
    }),
    '/entity/ent_thin_001',
  );
});

test('placePageHolds agrees with canStandHere for every seed entity, not a fixture list', () => {
  for (const entity of listPublicEntities()) {
    assert.equal(
      placePageHolds({
        displayName: entity.displayName,
        kind: entity.kind,
        summary: entity.summary,
        locationPrecision: entity.locationPrecision,
        entityId: entity.id,
      }),
      canStandHere(entity),
      `mismatch for ${entity.id}`,
    );
  }
});

test('a live-catalog place with no allowlist entry still holds (Fort Frederik)', () => {
  const fortFrederik = {
    displayName: 'Fort Frederik',
    kind: 'place',
    entityId: 'nrhp-black-heritage-96001073',
    summary:
      'A Danish colonial fort on Saint Croix listed on the National Register of Historic Places.',
    locationPrecision: 'neighborhood',
  };
  assert.equal(placePageHolds(fortFrederik), true);
  assert.equal(atlasWalkHref(fortFrederik), '/place/fort-frederik');
});

test('a record with no summary is not invented into a place page, allowlisted id aside', () => {
  assert.equal(
    placePageHolds({
      displayName: 'A Thin Stub Record',
      kind: 'place',
      entityId: 'ent_thin_stub_002',
    }),
    false,
  );
  assert.equal(
    atlasWalkHref({
      displayName: 'A Thin Stub Record',
      kind: 'place',
      entityId: 'ent_thin_stub_002',
    }),
    undefined,
  );
});

test('the home-map walk uses a holding slug, never a slugified name or /entity/', () => {
  assert.equal(
    atlasWalkHref({
      displayName: 'Paul Laurence Dunbar High School',
      kind: 'organization',
      summary: 'A public high school in Washington, D.C.',
    }),
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
  assert.equal(
    atlasWalkHref({
      displayName: 'Dillard High School, Old',
      kind: 'place',
      entityId: 'nrhp-black-heritage-91000107',
    }),
    '/place/dillard-high-school-old',
  );
  assert.equal(atlasWalkHref({ displayName: 'Dillard University', kind: 'place' }), undefined);
  assert.equal(atlasWalkHref({ displayName: 'James H. Dillard House', kind: 'place' }), undefined);
  assert.equal(staysOffPublicMap({ displayName: 'James H. Dillard House' }), true);
  assert.equal(staysOffPublicMap({ displayName: 'Dillard University' }), false);
  assert.equal(staysOffPublicMap({ displayName: 'Dillard High School, Old' }), false);
  assert.equal(isHoldingPlaceHref('/place/dillard-high-school-old'), true);
  assert.equal(isHoldingPlaceHref('/place/42Cb1758'), false);
  assert.equal(isHoldingPlaceHref('/entity/ent_dunbar_school_001'), false);
});

test('an invention addresses its own family from every door', () => {
  const invention = {
    id: 'inv_banneker_striking_clock',
    displayName: 'Striking Clock',
    kind: 'invention',
    summary: 'A wooden striking clock built without a model to copy.',
  };
  assert.equal(inventionHref('Striking Clock'), '/invention/striking-clock');

  // `canStandHere` still admits an invention — it only asks "not a living private person, with
  // a summary" — so the family branch, not the stand test, is what keeps it off Place.
  assert.equal(canStandHere(invention), true);

  assert.equal(neighborHref(invention), '/invention/striking-clock');
  assert.equal(atlasWalkHref(invention), '/invention/striking-clock');

  // The invention family is not a holding place walk, so a pin can never treat it as one.
  assert.equal(isHoldingPlaceHref('/invention/striking-clock'), false);
});
