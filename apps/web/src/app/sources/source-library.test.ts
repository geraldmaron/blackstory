import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publisherFor, sourceKindFor, tallySources, titleCase } from './source-library';

test('each record counts once per publisher, and rows sort most cited first', () => {
  const library = tallySources([['nps.gov', 'wikipedia', 'nps.gov'], ['nps.gov', 'loc.gov'], []]);
  assert.deepEqual(
    library.rows.map((row) => [row.key, row.records]),
    [
      ['nps.gov', 2],
      ['loc.gov', 1],
      ['wikipedia', 1],
    ],
  );
  assert.equal(library.citingRecords, 2);
  assert.equal(library.totalRecords, 3);
});

test('kind is read from the address, and only a host name becomes a link', () => {
  assert.equal(sourceKindFor('nps.gov'), 'government');
  assert.equal(sourceKindFor('tpwd.texas.gov'), 'government');
  assert.equal(sourceKindFor('lib.unc.edu'), 'university');
  assert.equal(sourceKindFor('blackpast.org'), 'organization');
  assert.equal(sourceKindFor('wikipedia'), 'reference');
  assert.equal(sourceKindFor('nytimes.com'), 'other');
  assert.equal(sourceKindFor('nara_catalog'), 'other');
  assert.equal(tallySources([['amistad research center']]).rows[0]?.href, undefined);
  assert.equal(tallySources([['loc.gov']]).rows[0]?.href, 'https://loc.gov');
});

test('one publisher under many spellings is one row, counted once per record', () => {
  const library = tallySources([
    ['tile.loc.gov', 'library of congress — chronicling america', 'guides.loc.gov'],
    ['loc.gov', 'library of congress (habs)'],
    ['npgallery.nps.gov', 'national park service — npgallery', 'citation_trail'],
  ]);
  assert.deepEqual(
    library.rows.map((row) => [row.key, row.label, row.records]),
    [
      ['loc.gov', 'Library of Congress', 2],
      ['nps.gov', 'National Park Service', 1],
    ],
  );
  assert.equal(library.citingRecords, 3);
});

test('internal markers are not publishers, and names print in title case', () => {
  for (const key of ['citation_trail', 'other', 'catalog', 'mentioned by 0 catalog record(s)']) {
    assert.equal(publisherFor(key), undefined, key);
  }
  assert.equal(publisherFor('raw.githubusercontent.com')?.label, 'GitHub');
  assert.equal(publisherFor('nationalregister_sc_gov')?.key, 'sc.gov');
  assert.equal(publisherFor('nara_catalog')?.label, 'National Archives');
  assert.equal(
    publisherFor('https://planning.dc.gov/sites/default/files/brochure.pdf')?.key,
    'dc.gov',
  );
  assert.equal(
    publisherFor('mother bethel ame church (official site)')?.label,
    'Mother Bethel AME Church',
  );
  assert.equal(
    titleCase('north carolina a&t state university'),
    'North Carolina A&T State University',
  );
  assert.equal(titleCase('lemoyne-owen college'), 'Lemoyne-Owen College');
});
