/**
 * Tests for Census address rescue helpers and Wikidata P625 coordinate extraction.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCensusGeocodeQuery,
  extractStreetAddressCandidate,
  normalizeFractionalHouseNumbers,
} from '../geocode/address-normalize.js';
import { placeTitleCandidateFromLabel, placeTitleCandidatesFromLabel } from './location-audit.js';
import { coordinateFromWikidataEntity } from './wikidata-place-coords.js';
import type { WikidataEntity } from '../adapters/wikimedia/types.js';

test('normalizeFractionalHouseNumbers converts unicode halves', () => {
  assert.equal(
    normalizeFractionalHouseNumbers('110½ East Leigh Street'),
    '110 1/2 East Leigh Street',
  );
});

test('extractStreetAddressCandidate pulls street segment from prose', () => {
  const got = extractStreetAddressCandidate(
    'Maggie L. Walker National Historic Site, 110½ East Leigh Street, Richmond, Virginia',
  );
  assert.ok(got);
  assert.match(got!, /110 1\/2 East Leigh Street/i);
});

test('buildCensusGeocodeQuery prefers street candidate', () => {
  const query = buildCensusGeocodeQuery(
    'Site Name, 454 Dexter Avenue, Montgomery',
    'Montgomery, Alabama',
  );
  assert.match(query, /454 Dexter Avenue/i);
});

test('placeTitleCandidateFromLabel takes head before comma', () => {
  assert.equal(
    placeTitleCandidateFromLabel('Howard University, Washington, D.C.'),
    'Howard University',
  );
});

test('placeTitleCandidatesFromLabel includes parent campus sites', () => {
  const titles = placeTitleCandidatesFromLabel(
    'Launch Complex 39A, Kennedy Space Center, Florida',
  );
  assert.equal(titles[0], 'Launch Complex 39A');
  assert.ok(titles.includes('Kennedy Space Center'));
  assert.ok(!titles.includes('Florida'));
});

test('placeTitleCandidatesFromLabel omits US state jurisdiction tails', () => {
  const titles = placeTitleCandidatesFromLabel(
    'NASA Langley Research Center, Hampton, Virginia',
  );
  assert.ok(titles.includes('NASA Langley Research Center'));
  assert.ok(!titles.includes('Virginia'));
  assert.ok(!titles.includes('Hampton'));
});

test('coordinateFromWikidataEntity reads P625', () => {
  const entity = {
    id: 'Q1068071',
    labels: { en: { language: 'en', value: 'Howard University' } },
    claims: {
      P625: [
        {
          mainsnak: {
            snaktype: 'value',
            property: 'P625',
            datavalue: {
              type: 'globecoordinate',
              value: {
                latitude: 38.9219,
                longitude: -77.0196,
                altitude: null,
                precision: 0.0001,
                globe: 'http://www.wikidata.org/entity/Q2',
              },
            },
          },
          type: 'statement',
          rank: 'normal',
        },
      ],
    },
  } as unknown as WikidataEntity;

  const coord = coordinateFromWikidataEntity(entity, 'Q1068071');
  assert.ok(coord);
  assert.equal(coord!.lat, 38.9219);
  assert.equal(coord!.lng, -77.0196);
  assert.equal(coord!.wikidataId, 'Q1068071');
});
