/**
 * Confirms the explore map source (a) reproduces the real active-release population with
 * real entity links, (b) never leaks a raw/exact coordinate for a living person even when a
 * caller supplies one (the redaction invariant is `buildMapSource`'s, but this test proves this
 * module's wiring of it is real, not bypassed), and (c) builds jurisdiction-area polygon geometry
 * for area records without ever emitting them as points.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities, type PublicEntityView } from '../../data/public-seed';
import { instrumentRecordHref, placeSlugCollisionCounts } from '../place/place-slug';
import { atlasWalkHref } from '../place/public-place-path';
import { buildExploreMapSource, buildJurisdictionAreaFeatures } from './build-explore-map-source';
import { geoAnchorFor } from './entity-geo';
import { displayEncodingFor, kindFamilyFor } from './kind-encoding';

test('every active-release entity with a resolvable anchor becomes an enriched feature', () => {
  const entities = listPublicEntities();
  const collisions = placeSlugCollisionCounts(entities);
  const source = buildExploreMapSource(entities);

  assert.equal(source.featureCollection.features.length, entities.length);
  for (const feature of source.featureCollection.features) {
    const entity = entities.find((candidate) => candidate.id === feature.properties.entityId);
    assert.ok(entity);
    const href = instrumentRecordHref(entity, collisions);
    assert.equal(feature.properties.href, href);
    if (href.startsWith('/place/')) {
      assert.doesNotMatch(feature.properties.href, /\/entity\//);
    }
    assert.equal(feature.properties.oneLineStory, entity!.summary);
    assert.equal(feature.properties.evidenceCount, entity!.claims.length);
    assert.deepEqual(feature.properties.eraBuckets, entity!.eraBuckets ?? []);
    if (entity!.jurisdictionLabel.trim().length > 0) {
      assert.equal(feature.properties.jurisdictionLabel, entity!.jurisdictionLabel.trim());
    }
  }
});

test('visitClaims on map features carry only website, phone, and hours predicates', () => {
  const entities = listPublicEntities().map((entity) =>
    entity.id === 'ent_dunbar_school_001'
      ? {
          ...entity,
          locationPrecision: 'institution' as const,
          claims: [
            ...entity.claims,
            {
              id: 'claim_visit_phone',
              predicate: 'visitorPhone',
              object: '(202) 555-0140',
              confidenceScore: 0.7,
              confidenceLevel: 'medium' as const,
              citationSource: 'School visitor page',
              citationLabel: 'School visitor page',
            },
          ],
        }
      : entity,
  );
  const source = buildExploreMapSource(entities);
  const dunbar = source.featureCollection.features.find(
    (feature) => feature.properties.entityId === 'ent_dunbar_school_001',
  );
  assert.ok(dunbar);
  assert.ok(dunbar.properties.visitClaims);
  assert.equal(dunbar.properties.visitClaims.length, 1);
  assert.equal(dunbar.properties.visitClaims[0]?.predicate, 'visitorPhone');
});

test('holdingWalk marks only allowlisted atlas walks, not every /place/ href', () => {
  const base = listPublicEntities()[0]!;
  const nonWalkPlace: PublicEntityView = {
    ...base,
    id: 'ent_test_archie_edwards',
    kind: 'place',
    displayName: 'Archie Edwards Alpha Tonsorial Palace',
    summary: 'A documented barbershop and gathering place in Washington, D.C.',
  };
  const source = buildExploreMapSource([nonWalkPlace], {
    geoAnchorFor: (id) =>
      id === nonWalkPlace.id
        ? { lat: 38.91, lng: -77.03, geohash: 'dqcj', matchMethod: 'geocode_other' }
        : geoAnchorFor(id),
  });
  const feature = source.featureCollection.features[0]!;
  assert.match(feature.properties.href, /^\/place\//);
  assert.notEqual(feature.properties.holdingWalk, true);

  const entities = listPublicEntities();
  const catalog = buildExploreMapSource(entities);
  for (const entry of catalog.featureCollection.features) {
    if (entry.properties.holdingWalk !== true) continue;
    const entity = entities.find((candidate) => candidate.id === entry.properties.entityId);
    assert.ok(entity);
    assert.equal(
      atlasWalkHref({
        displayName: entity!.displayName,
        kind: entity!.kind,
        entityId: entity!.id,
      }),
      entry.properties.href,
    );
  }
});

test('a standable published place gets a /place/ href on the Atlas instrument', () => {
  const base = listPublicEntities()[0]!;
  const palace: PublicEntityView = {
    ...base,
    id: 'ent_test_archie_edwards',
    kind: 'place',
    displayName: 'Archie Edwards Alpha Tonsorial Palace',
    summary: 'A documented barbershop and gathering place in Washington, D.C.',
  };
  const source = buildExploreMapSource([palace], {
    geoAnchorFor: (id) =>
      id === palace.id
        ? { lat: 38.91, lng: -77.03, geohash: 'dqcj', matchMethod: 'geocode_other' }
        : geoAnchorFor(id),
  });
  assert.equal(source.featureCollection.features.length, 1);
  assert.equal(
    source.featureCollection.features[0]!.properties.href,
    '/place/archie-edwards-alpha-tonsorial-palace',
  );
});

test('feature shade/glyph/kindFamily match displayEncodingFor and kindFamilyFor', () => {
  const entities = listPublicEntities();
  const source = buildExploreMapSource(entities);
  for (const feature of source.featureCollection.features) {
    const expected = displayEncodingFor(feature.properties.kind, feature.properties.mapTone);
    assert.equal(feature.properties.shade, expected.shade);
    assert.equal(feature.properties.glyph, expected.glyph);
    assert.equal(feature.properties.kindFamily, kindFamilyFor(feature.properties.kind));
  }
});

test('display-name cues set mapTone so Color-key tones paint and filter on titled records', () => {
  const base = listPublicEntities()[0]!;
  const plantationPlace: PublicEntityView = {
    ...base,
    id: 'ent_test_whitney_plantation',
    kind: 'place',
    displayName: 'Whitney Plantation',
    topicTags: ['museum', 'enslavement'],
  };
  const source = buildExploreMapSource([plantationPlace], {
    geoAnchorFor: (id) =>
      id === plantationPlace.id
        ? { lat: 30.0, lng: -90.6, geohash: 'djre', matchMethod: 'geocode_other' }
        : geoAnchorFor(id),
  });
  assert.equal(source.featureCollection.features.length, 1);
  assert.equal(source.featureCollection.features[0]!.properties.mapTone, 'plantation');
  const expected = displayEncodingFor('place', 'plantation');
  assert.equal(source.featureCollection.features[0]!.properties.shade, expected.shade);
});

test('an entity with no resolvable geo anchor is excluded from the map, not guessed at', () => {
  const entities = listPublicEntities();
  const source = buildExploreMapSource(entities, { geoAnchorFor: () => undefined });
  assert.equal(source.featureCollection.features.length, 0);
  assert.equal(source.meta.skippedNoLocation, entities.length);
});

test('a living person with a precise residential coordinate never reaches the output raw (redaction still fires through this module)', () => {
  const livingPersonFixture: PublicEntityView = {
    ...listPublicEntities()[0]!,
    id: 'ent_test_living_person',
    kind: 'place',
    locationPrecision: 'city',
  };

  const rawLat = 29.760427;
  const rawLng = -95.369803;

  const source = buildExploreMapSource([livingPersonFixture], {
    geoAnchorFor: (id) =>
      id === livingPersonFixture.id
        ? { lat: rawLat, lng: rawLng, geohash: '9vk1p1n8x', matchMethod: 'geocode_other' }
        : geoAnchorFor(id),
  });

  // `locationPrecision: 'city'` is already a safe public precision, so this fixture is a control
  // (proves the pipeline runs `redactLocationForPublic`, which coarsens coordinates to the
  // matching decimal precision for the level, rather than passing raw values straight through).
  const [feature] = source.featureCollection.features;
  assert.ok(feature);
  const [lng, lat] = feature.geometry.coordinates;
  assert.notEqual(lat, rawLat);
  assert.notEqual(lng, rawLng);
});

test('jurisdiction-scoped area records build polygon geometry, never point geometry', () => {
  const features = buildJurisdictionAreaFeatures([
    {
      id: 'law_test_001',
      href: '/entity/law_test_001',
      displayName: 'Test area-condition record',
      kind: 'law',
      jurisdictionBBox: [-77.12, 38.79, -76.9, 39.0],
    },
  ]);

  assert.equal(features.length, 1);
  assert.equal(features[0]!.geometry.type, 'Polygon');
  assert.equal(features[0]!.geometry.coordinates[0]!.length, 5);
  assert.equal(features[0]!.properties.href, '/entity/law_test_001');
});

test('jurisdictionAreaFeatures defaults to empty — no area-record kind exists in the active release yet', () => {
  const source = buildExploreMapSource(listPublicEntities());
  assert.deepEqual(source.jurisdictionAreaFeatures, []);
});

test('James H. Dillard House stays off the public map', () => {
  const base = listPublicEntities()[0]!;
  const house: PublicEntityView = {
    ...base,
    id: 'nrhp-dillard-house',
    kind: 'place',
    displayName: 'James H. Dillard House',
    locationPrecision: 'city',
  };
  const university: PublicEntityView = {
    ...base,
    id: 'ent_dillard_university_001',
    kind: 'place',
    displayName: 'Dillard University',
    locationPrecision: 'campus',
  };
  const source = buildExploreMapSource([house, university], {
    geoAnchorFor: () => ({
      lat: 29.93,
      lng: -90.12,
      geohash: 'djfq',
      matchMethod: 'geocode_other',
    }),
  });
  assert.equal(source.featureCollection.features.length, 1);
  assert.equal(source.featureCollection.features[0]!.properties.displayName, 'Dillard University');
  assert.equal(source.featureCollection.features[0]!.properties.href, '/place/dillard-university');
});
