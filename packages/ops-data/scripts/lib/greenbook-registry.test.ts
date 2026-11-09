import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listingClaim,
  listingQuotes,
  listingSummary,
  type ListingFacts,
} from './greenbook-registry.ts';

const pelican: ListingFacts = {
  name: 'Pelican',
  address: '4613 John R. St.',
  category: 'Hotel',
  year: 1947,
  city: 'Detroit',
  state: 'Michigan',
};
const geojson =
  '{"properties": {"name": "Pelican", "address": "4613 John R. St.", "page": 47, ' +
  '"year": 1947, "city": "DETROIT", "state": "MICHIGAN", "category": "Hotel", "x": 1}}';
const rows =
  '{"rows": [["Spencer Hotel", "300 East Garfield Boulevard, Chicago, IL 60615", "Hotel", "1956", [41.79, -87.61]]]}';

test('listingQuotes finds a 1947 listing and returns verbatim passages', () => {
  const quotes = listingQuotes(geojson, pelican);
  assert.ok(quotes);
  for (const quote of quotes) assert.ok(geojson.includes(quote));
});

test('listingQuotes fails closed on a changed fact or a duplicate', () => {
  assert.equal(listingQuotes(geojson, { ...pelican, address: '4614 John R. St.' }), null);
  assert.equal(listingQuotes(geojson, { ...pelican, category: 'Restaurant' }), null);
  assert.equal(listingQuotes(geojson + geojson, pelican), null);
});

test('listingQuotes finds a 1956 row by its street address prefix', () => {
  const facts: ListingFacts = {
    name: 'Spencer Hotel',
    address: '300 East Garfield Boulevard',
    category: 'Hotel',
    year: 1956,
    city: 'Chicago',
    state: 'IL',
  };
  const quotes = listingQuotes(rows, facts);
  assert.ok(quotes && rows.includes(quotes[0] as string));
  assert.equal(
    listingSummary(facts),
    'Spencer Hotel was listed in the 1956 edition of the Negro Motorist Green Book as a hotel at 300 East Garfield Boulevard, Chicago, Illinois.',
  );
  assert.match(listingClaim(facts), /^Listed in the 1956 edition/u);
});

test('listingQuotes matches a 1956 address that contains a quote or a backslash as the file writes it', () => {
  const address = 'Rear of 12 "Old" Road \\ Annex';
  const rows = `{"rows": [["Odd Inn", ${JSON.stringify(`${address}, Erie, PA 16501`)}, "Hotel", "1956", [1, 2]]]}`;
  const facts: ListingFacts = {
    name: 'Odd Inn',
    address,
    category: 'Hotel',
    year: 1956,
    city: 'Erie',
    state: 'PA',
  };
  const quotes = listingQuotes(rows, facts);
  assert.ok(quotes && rows.includes(quotes[0] as string));
});
