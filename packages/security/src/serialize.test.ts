
/**
 * Tests for the public serialization choke point: projections, search docs, exports,
 * and the fail-closed safety assertion. Proves stored exact addresses are
 * reduced before publication and prohibited precision can never be returned publicly.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertNoProhibitedPublicPrecision,
  assertPublicProjectionSafe,
  redactForPublicExport,
  toPublicEntityProjection,
  toPublicSearchDocument,
  type PublicSerializableEntity,
} from './index.ts';

const livingPerson: PublicSerializableEntity = {
  id: 'ent_living_001',
  kind: 'person',
  displayName: 'Living Subject',
  livingStatus: 'unknown',
};

const deceasedPerson: PublicSerializableEntity = {
  id: 'ent_deceased_001',
  kind: 'person',
  displayName: 'Historical Subject',
  livingStatus: 'deceased',
};

/** Regression fixture: a stored exact residential address from the evidence tier. */
const storedExactResidence = {
  precision: 'street_address',
  lat: 40.741895,
  lng: -73.989308,
  geohash: 'dr5ru7xy9',
  matchMethod: 'geocode_other',
  label: '20 W 34th St',
};

const LEARNING_SUMMARY =
  'A historically documented public record in the BlackStory learning index, ' +
  'with published claims and provenance suitable for educators and researchers.';

test('public projection reduces a stored exact address before publication (living)', () => {
  const projection = toPublicEntityProjection(livingPerson, {
    releaseId: 'rel_001',
    summary: LEARNING_SUMMARY,
    topicTags: ['community'],
    location: storedExactResidence,
  });

  assert.equal(projection.location?.precision, 'city');
  assert.equal(projection.location?.lat, 40.74);
  assert.equal(projection.location?.lng, -73.99);
  assert.equal(projection.location?.geohash, 'dr5r');
  assert.equal(projection.nameLower, 'living subject');
  assert.equal(projection.summary, LEARNING_SUMMARY);
  assert.deepEqual(projection.topicTags, ['community']);
  // Fail-closed assertion already ran inside the serializer.
  assert.doesNotThrow(() => assertPublicProjectionSafe(projection));
});

test('public projection reduces a deceased historical residence to neighborhood', () => {
  const projection = toPublicEntityProjection(deceasedPerson, {
    releaseId: 'rel_001',
    summary: LEARNING_SUMMARY,
    location: storedExactResidence,
  });
  assert.equal(projection.location?.precision, 'neighborhood');
  assert.equal(projection.location?.geohash?.length, 5);
});

test('public projection rejects summaries below the learning-index minimum', () => {
  assert.throws(
    () =>
      toPublicEntityProjection(livingPerson, {
        releaseId: 'rel_001',
        summary: 'too short',
      }),
    /Learning-index projection rejected/,
  );
});

test('public serializer cannot return prohibited precision', () => {
  assert.throws(() => assertNoProhibitedPublicPrecision('street_address'), /not allowed/);
  assert.throws(
    () => assertNoProhibitedPublicPrecision('residence', { livingStatus: 'unknown' }),
    /not allowed/,
  );
  assert.doesNotThrow(() => assertNoProhibitedPublicPrecision('city'));
  // Neighborhood is allowed publicly even for a living person (it is not residential).
  assert.doesNotThrow(() =>
    assertNoProhibitedPublicPrecision('neighborhood', { livingStatus: 'unknown' }),
  );
});

test('assertPublicProjectionSafe rejects prohibited precision on a model', () => {
  assert.throws(
    () => assertPublicProjectionSafe({ location: { precision: 'street_address' } }),
    /prohibited precision/,
  );
});

test('assertPublicProjectionSafe rejects residential address fields on a model', () => {
  assert.throws(
    () => assertPublicProjectionSafe({ streetAddress: '20 W 34th St' }),
    /prohibited field/,
  );
  assert.throws(() => assertPublicProjectionSafe({ unit: '4B' }), /prohibited field/);
});

test('assertPublicProjectionSafe rejects exact coordinates on a model', () => {
  assert.throws(
    () =>
      assertPublicProjectionSafe({ location: { precision: 'city', lat: 40.741895, lng: -73.98 } }),
    /exact coordinate/,
  );
});

test('assertPublicProjectionSafe rejects address-shaped strings anywhere', () => {
  assert.throws(
    () => assertPublicProjectionSafe({ summary: 'Seen at 742 Evergreen Terrace last year.' }),
    /address-shaped/,
  );
});

test('search documents carry no address fields and only a coarse geohash', () => {
  const doc = toPublicSearchDocument(livingPerson, {
    releaseId: 'rel_001',
    location: storedExactResidence,
  });
  assert.equal(doc.entityId, 'ent_living_001');
  assert.equal(doc.nameLower, 'living subject');
  assert.equal(doc.geohash, 'dr5r');
  assert.equal(doc.precision, 'city');
  // No exact coordinates or address keys on the searchable document.
  assert.equal(Object.hasOwn(doc, 'lat'), false);
  assert.equal(Object.hasOwn(doc, 'lng'), false);
  assert.equal(Object.hasOwn(doc, 'streetAddress'), false);
  assert.doesNotThrow(() => assertPublicProjectionSafe(doc));
});

test('exports strip residential addresses and remain publication-safe', () => {
  const exported = redactForPublicExport({
    id: 'ent_living_001',
    displayName: 'Living Subject',
    streetAddress: '20 W 34th St',
    homeAddress: '20 W 34th St',
    geometry: { type: 'Point', coordinates: [-73.98, 40.74] },
    bio: 'Resided at 20 W 34th St for decades.',
  }) as Record<string, unknown>;

  assert.equal(Object.hasOwn(exported, 'streetAddress'), false);
  assert.equal(Object.hasOwn(exported, 'homeAddress'), false);
  assert.equal(Object.hasOwn(exported, 'geometry'), false);
  assert.match(String(exported.bio), /\[REDACTED\]/);
  assert.equal(exported.displayName, 'Living Subject');
});
