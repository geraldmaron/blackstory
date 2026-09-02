/**
 * Unit tests for the pure SPARQL-binding parsing in backfill-visit-from-wikidata.ts.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeStreetAddress, parseWikidataVisitFields } from './backfill-visit-from-wikidata.ts';

test('parseWikidataVisitFields extracts website/phone/street/postalCode', () => {
  const fields = parseWikidataVisitFields({
    item: { value: 'http://www.wikidata.org/entity/Q123' },
    website: { value: 'https://example.org' },
    phone: { value: '+1-205-555-0100' },
    streetLabel: { value: '6th Avenue North' },
    houseNumber: { value: '1530' },
    postalCode: { value: '35203' },
  });
  assert.equal(fields.website, 'https://example.org');
  assert.equal(fields.phone, '+1-205-555-0100');
  assert.equal(fields.streetLabel, '6th Avenue North');
  assert.equal(fields.houseNumber, '1530');
  assert.equal(fields.postalCode, '35203');
});

test('parseWikidataVisitFields parses a WKT Point coordinate', () => {
  const fields = parseWikidataVisitFields({
    coord: { value: 'Point(-86.812 33.5186)' },
  });
  assert.equal(fields.coordLng, -86.812);
  assert.equal(fields.coordLat, 33.5186);
});

test('parseWikidataVisitFields omits fields with no binding', () => {
  const fields = parseWikidataVisitFields({});
  assert.deepEqual(fields, {});
});

test('composeStreetAddress joins house number and street label', () => {
  assert.equal(
    composeStreetAddress({ houseNumber: '1530', streetLabel: '6th Avenue North' }),
    '1530 6th Avenue North',
  );
});

test('composeStreetAddress falls back to street label alone', () => {
  assert.equal(composeStreetAddress({ streetLabel: '6th Avenue North' }), '6th Avenue North');
});

test('composeStreetAddress returns undefined when neither piece is present', () => {
  assert.equal(composeStreetAddress({}), undefined);
});
