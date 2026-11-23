import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ShownRecord } from './shown-records';
import { legBetween, legText, pickJourney, pickTitlePlates, shortPlace } from './journey';

const make = (id: string, state: string, decade: number, over: Partial<ShownRecord> = {}) =>
  ({
    entityId: id,
    name: `Record ${id}`,
    locality: `Town, ${state}`,
    href: `/entity/${id}`,
    lngLat: [-90, 35],
    precision: 'exact',
    decade,
    person: false,
    kind: 'place',
    statePostal: state,
    cameraSafe: true,
    plate: {
      url: 'https://example.org/a.jpg',
      alt: '',
      credit: 'c',
      rightsStatus: 'public_domain',
      width: 800,
      height: 600,
    },
    claim: {
      id: 'c',
      statement: 'It was built here.',
      source: { title: 't', href: 'https://example.org' },
      level: 'high',
    },
    ...over,
  }) as ShownRecord;

test('the journey is oldest first, never thinly evidenced, and varies kind', () => {
  const records = [
    make('a', 'GA', 1900),
    make('b', 'NY', 1850, { kind: 'school' }),
    make('c', 'TX', 1960, { kind: 'person' }),
    make('d', 'CA', 1920, { claim: { ...make('x', 'CA', 1).claim, level: 'low' } }),
    make('e', 'IL', 1880, { kind: 'organization' }),
    make('f', 'OH', 1870),
    make('g', 'MA', 1790, { kind: 'event' }),
  ];
  const picked = pickJourney(records);
  assert.equal(picked.length, 5);
  assert.ok(!picked.some((record) => record.entityId === 'd'));
  assert.deepEqual(
    [...picked].sort((x, y) => x.decade - y.decade),
    picked,
  );
  assert.ok(new Set(picked.map((record) => record.kind)).size >= 4);
});

test('too few eligible records means no journey', () => {
  assert.deepEqual(pickJourney([make('a', 'GA', 1900), make('b', 'NY', 1850)]), []);
});

test('title plates skip journey records, repeat states and tall scans', () => {
  const records = [
    make('a', 'GA', 1900),
    make('b', 'GA', 1850),
    make('c', 'TX', 1960, { plate: { ...make('x', 'TX', 1).plate!, width: 400, height: 900 } }),
    make('d', 'CA', 1920),
  ];
  const picked = pickTitlePlates(records, new Set(['d']), 4);
  assert.equal(picked.length, 1);
  assert.equal(picked[0]!.statePostal, 'GA');
});

test('a leg is measured and named from the two points', () => {
  // Atlanta to Washington, D.C.
  const leg = legBetween([-84.39, 33.75], [-77.04, 38.91]);
  assert.ok(leg.miles > 520 && leg.miles < 560);
  assert.equal(leg.heading, 'northeast');
  assert.equal(legText([-84.39, 33.75], [-77.04, 38.91]), 'About 540 miles northeast');
  assert.equal(legText([-84.39, 33.75], [-84.4, 33.76]), 'A few miles away');
});

test('a long locality is shortened to its town and state', () => {
  assert.equal(shortPlace('Main campus, Georgia Avenue NW, Washington, D.C.'), 'Washington, D.C.');
  assert.equal(shortPlace('Denver, Colorado'), 'Denver, Colorado');
});
