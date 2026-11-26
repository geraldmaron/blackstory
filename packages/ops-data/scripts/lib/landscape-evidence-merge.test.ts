import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyProseCorrections,
  evidenceDocumentKey,
  mergeEvidenceCitations,
  parseStagedLocation,
} from './landscape-evidence-merge.ts';

const existing = [
  {
    sourceUrl: 'https://www.nps.gov/places/x.htm',
    title: 'NPS',
    quote: 'The church was built in 1885.',
  },
];

test('a citation from a document not yet cited is appended after the existing ones', () => {
  const result = mergeEvidenceCitations(existing, [
    {
      sourceUrl: 'https://kshs.org/kansapedia/x',
      title: 'Kansas Historical Society',
      quote: 'Built by settlers.',
    },
  ]);
  assert.equal(result.citations.length, 2);
  assert.equal(result.added.length, 1);
  assert.deepEqual(result.citations[0], existing[0]);
});

test('a second passage from an already-cited document is kept, an identical passage is dropped', () => {
  const result = mergeEvidenceCitations(existing, [
    {
      sourceUrl: 'https://nps.gov/places/x.htm/',
      title: 'NPS',
      quote: 'the church was built in 1885',
    },
    {
      sourceUrl: 'https://www.nps.gov/places/x.htm',
      title: 'NPS',
      quote: 'Services continued into the 1950s.',
    },
  ]);
  assert.equal(result.added.length, 1);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0]?.reason, 'identical passage already cited');
});

test('a citation without https, without a quote, or with a broken URL is skipped with a reason', () => {
  const result = mergeEvidenceCitations(existing, [
    { sourceUrl: 'http://example.org/a', title: 'a', quote: 'q' },
    { sourceUrl: 'https://example.org/b', title: 'b', quote: '' },
    { sourceUrl: 'https://exa mple.org/c', title: 'c', quote: 'q' },
  ]);
  assert.equal(result.added.length, 0);
  assert.deepEqual(
    result.skipped.map((entry) => entry.reason),
    ['sourceUrl is not https', 'missing sourceUrl or quote', 'sourceUrl is not a URL'],
  );
});

test('the document key ignores www and a trailing slash but keeps the query', () => {
  assert.equal(evidenceDocumentKey('https://www.hmdb.org/m.asp/?m=1'), 'hmdb.org/m.asp?m=1');
  assert.equal(evidenceDocumentKey('nope'), null);
});

test('a prose correction applies once and is refused when its anchor is missing or ambiguous', () => {
  const text = 'In 1927 she joined the paper. In 1927 she left.';
  const ok = applyProseCorrections('In 1927 she joined the paper.', [
    { current: 'In 1927 she joined', suggested: 'In 1928 she joined' },
  ]);
  assert.equal(ok.text, 'In 1928 she joined the paper.');
  assert.equal(ok.applied, 1);
  const refused = applyProseCorrections(text, [
    { current: 'In 1927', suggested: 'In 1928' },
    { current: 'never here', suggested: 'x' },
  ]);
  assert.equal(refused.applied, 0);
  assert.equal(refused.text, text);
  assert.deepEqual(
    refused.refused.map((r) => r.split(':')[0]),
    ['ambiguous', 'not found'],
  );
});

test('a sourced city location parses and keeps its source', () => {
  const result = parseStagedLocation({
    lat: 47.6062,
    lng: -122.3321,
    precision: 'city',
    city: 'Seattle',
    state: 'WA',
    sourceUrl: 'https://blackpast.org/african-american-history/bennett-chris-h-1943/',
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok && result.location, {
    lat: 47.6062,
    lng: -122.3321,
    precision: 'city',
    sourceUrl: 'https://blackpast.org/african-american-history/bennett-chris-h-1943/',
    city: 'Seattle',
    state: 'WA',
  });
});

test('a location is refused for an uncontrolled precision, a bad point or no https source', () => {
  const base = { lat: 47.6, lng: -122.3, precision: 'city', sourceUrl: 'https://example.org/x' };
  assert.equal(parseStagedLocation({ ...base, precision: 'street' }).ok, false);
  assert.equal(parseStagedLocation({ ...base, lat: 91 }).ok, false);
  assert.equal(parseStagedLocation({ ...base, lng: '-122.3' }).ok, false);
  assert.equal(parseStagedLocation({ ...base, sourceUrl: 'http://example.org/x' }).ok, false);
  assert.equal(parseStagedLocation(null).ok, false);
});
