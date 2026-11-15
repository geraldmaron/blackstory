import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decadeBars, pickDecadeStops, pickDoorOpening, type DoorRecord } from './door-decade-walk';

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
});

test('the grade row counts each grade exactly, not by floor', async () => {
  const { gradeCounts } = await import('./door-chapters');
  assert.deepEqual(gradeCounts([facet('A', 10), facet('B', 25), facet('C', 40)]), [
    { level: 'high', count: 10 },
    { level: 'medium', count: 15 },
    { level: 'low', count: 15 },
  ]);
});
