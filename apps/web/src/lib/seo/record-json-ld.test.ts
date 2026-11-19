/**
 * Record-page JSON-LD: names the subject, links the jurisdiction, and never publishes a point
 * sharper than the page does.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRecordJsonLd, recordCanonicalPath, serializeJsonLd } from './record-json-ld';

process.env.NEXT_PUBLIC_SITE_URL = 'https://blackbook.example';

test('a place names itself and the jurisdiction it sits in', () => {
  const jsonLd = buildRecordJsonLd({
    family: 'place',
    slug: 'farish-street-neighborhood-historic-district',
    displayName: 'Farish Street Neighborhood Historic District',
    summary: 'An economically independent Black community in Jackson.',
    jurisdictionLabel: 'Jackson, Mississippi',
  });
  assert.equal(jsonLd['@type'], 'Place');
  assert.equal(
    jsonLd['@id'],
    'https://blackbook.example/place/farish-street-neighborhood-historic-district',
  );
  assert.equal(jsonLd.url, jsonLd['@id']);
  assert.deepEqual(jsonLd.containedInPlace, { '@type': 'Place', name: 'Jackson, Mississippi' });
});

test('structured data carries no coordinates and no street address', () => {
  const serialized = serializeJsonLd(
    buildRecordJsonLd({
      family: 'place',
      slug: 'evers-home',
      displayName: 'Evers Home',
      summary: 'A house in Jackson.',
      jurisdictionLabel: 'Jackson, Mississippi',
    }),
  );
  assert.ok(!serialized.includes('"geo"'));
  assert.ok(!serialized.includes('"address"'));
  assert.ok(!serialized.includes('latitude'));
});

test('an invention is a creative work with no place containment', () => {
  const jsonLd = buildRecordJsonLd({
    family: 'invention',
    slug: 'traffic-signal',
    displayName: 'Traffic signal',
    jurisdictionLabel: 'Cleveland, Ohio',
  });
  assert.equal(jsonLd['@type'], 'CreativeWork');
  assert.equal(jsonLd.containedInPlace, undefined);
  assert.equal(jsonLd.description, undefined);
});

test('the canonical keeps a disambiguated slug verbatim', () => {
  assert.equal(recordCanonicalPath('place', 'mount-zion--ent_123'), '/place/mount-zion--ent_123');
});

test('a name cannot close the script element', () => {
  const serialized = serializeJsonLd(
    buildRecordJsonLd({ family: 'place', slug: 'x', displayName: '</script><b>' }),
  );
  assert.ok(!serialized.includes('</script>'));
});
