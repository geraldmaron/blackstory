import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decadeBars,
  pickDecadeStops,
  pickDoorOpening,
  pickDoorOpeningCandidates,
  namesSubject,
  standsAlone,
  type DoorRecord,
} from './door-decade-walk';

const facet = (id: string, count: number) => ({
  id,
  label: id,
  count,
  href: `/records?era=${id}`,
  nofollow: false,
});

test('the decade axis is a true time scale: empty decades take their width at zero', () => {
  const bars = decadeBars([
    facet('1630s', 1),
    facet('1530s', 1),
    facet('undated', 9),
    facet('1550s', 2),
  ]);
  assert.deepEqual(
    bars.map((bar) => `${bar.label}:${bar.count}`),
    [
      '1530s:1',
      '1540s:0',
      '1550s:2',
      '1560s:0',
      '1570s:0',
      '1580s:0',
      '1590s:0',
      '1600s:0',
      '1610s:0',
      '1620s:0',
      '1630s:1',
    ],
  );
  assert.deepEqual(decadeBars([facet('undated', 3)]), []);
});

const record = (entityId: string, decade: number, plated: boolean): DoorRecord => ({
  entityId,
  name: entityId,
  locality: null,
  href: `/entity/${entityId}`,
  lngLat: [-90, 35],
  precision: 'site',
  decade,
  person: false,
  ...(plated
    ? {
        plate: {
          url: `https://example.test/${entityId}.jpg`,
          alt: '',
          credit: 'x',
          rightsStatus: 'public_domain' as const,
        },
      }
    : {}),
  claim: {
    id: entityId,
    statement: 'A claim.',
    source: { title: 'Source', href: 'https://example.test' },
  },
});

test('the walk is one record per decade, oldest first, photographed whenever one qualifies', () => {
  const records = [
    record('b-1900', 1900, false),
    record('a-1880-plain', 1880, false),
    record('a-1880-photo', 1880, true),
    record('c-1900', 1900, false),
  ];
  const stops = pickDecadeStops(records, 0.99);
  assert.deepEqual(
    stops.map((stop) => `${stop.decade}:${stop.entityId}`),
    ['1880:a-1880-photo', '1900:c-1900'],
  );
  // The opening leads with a photograph when any record has one.
  assert.equal(pickDoorOpening(records, 0)?.entityId, 'a-1880-photo');
  assert.equal(pickDoorOpening([], 0.5), undefined);
  // "Another record" cycles the same best pool, starting at the opening, wrapping, never beyond it.
  const choices = pickDoorOpeningCandidates(records, 0, 5);
  assert.equal(choices[0]?.entityId, pickDoorOpening(records, 0)?.entityId);
  assert.ok(choices.every((choice) => choice.plate));
  assert.deepEqual(pickDoorOpeningCandidates([], 0.5, 5), []);
});

test('the grade row counts each grade exactly, not by floor', async () => {
  const { gradeCounts } = await import('./door-chapters');
  assert.deepEqual(gradeCounts([facet('A', 10), facet('B', 25), facet('C', 40)]), [
    { level: 'high', count: 10 },
    { level: 'medium', count: 15 },
    { level: 'low', count: 15 },
  ]);
});

test('a claim that opens on the sentence before it does not stand alone', () => {
  assert.equal(standsAlone('It was built in 1882.'), false);
  assert.equal(standsAlone('Ultimately this led to a law passed in 1935.'), false);
  assert.equal(standsAlone('They hired a local contractor.'), false);
  assert.equal(standsAlone('The school operated until 1954.'), true);
  assert.equal(standsAlone('Italian masons laid the stone.'), true);
});

test('a claim names its record when it uses a word of the name', () => {
  assert.equal(namesSubject('The Lincoln was the largest theater.', 'Lincoln Theater'), true);
  assert.equal(namesSubject('Feminists were at the vanguard.', "The Women's Building"), false);
});

test('a source excerpt about something else is never the one claim shown for a record', async () => {
  const { doorClaimFor } = await import('./door-decade-walk');
  const claim = (id: string, predicate: string, object: string, confidenceLevel: string) => ({
    id,
    predicate,
    object,
    claimRole: predicate === 'source states' ? 'evidence' : 'record_index',
    citationHref: `https://example.test/${id}`,
    citationLabel: 'Nomination',
    citationSource: 'example.test',
    confidenceLevel,
  });
  const hawikuh = (claims: readonly ReturnType<typeof claim>[]) =>
    ({ id: 'e1', displayName: 'Hawikuh', kind: 'place', summary: '', claims }) as never;
  const narvaez = claim(
    'c1',
    'source states',
    'Panfilo de Narvaez led the expedition of 300 men that landed near Tampa Bay, Florida, in 1528.',
    'high',
  );
  const significance = claim('c2', 'significant for', 'Black heritage', 'high');
  const named = claim('c3', 'source states', 'Estevanico reached Hawikuh in 1539.', 'low');

  assert.equal(
    doorClaimFor(hawikuh([narvaez, significance]))?.statement,
    'Significant for: Black heritage',
  );
  assert.equal(doorClaimFor(hawikuh([narvaez, significance, named]))?.statement, named.object);
  // With nothing else to show, the record stays off the home page.
  assert.equal(doorClaimFor(hawikuh([narvaez])), null);
});

test('a claim keeps its predicate unless its object is a whole sentence', async () => {
  const { statementFor, endsAsSentence } = await import('./entity/[id]/adapters');
  // Ends on a period without being a sentence: the Dexter Avenue fragment.
  assert.equal(
    statementFor('was_pastored_by', 'Dr. Martin Luther King Jr.'),
    'Was Pastored By: Dr. Martin Luther King Jr.',
  );
  // Long is not the same as whole.
  assert.match(
    statementFor(
      'listing',
      'on the National Register of Historic Places on October 15, 1966, reference #66000502',
    ),
    /^Listing: on the National Register/,
  );
  assert.equal(statementFor('founded', 'The school opened in 1867.'), 'The school opened in 1867.');
  // A source's own words are never labeled, with or without their final period.
  assert.equal(
    statementFor('source states', 'The school opened in 1867'),
    'The school opened in 1867',
  );
  assert.equal(endsAsSentence('Civil War battle in Washington D.C.'), false);
});

test('an excerpt cut off mid-sentence is told from one that only lacks its period', async () => {
  const { isCutOff } = await import('./door-decade-walk');
  assert.equal(isCutOff('Known as a civil rights leader, Dr.'), true);
  assert.equal(isCutOff('Robert Carter III established six plantations on the north bank,'), true);
  assert.equal(isCutOff('She earned a Bachelor of Science Degree in 1932'), false);
});
