import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isCameraSafe, type DoorRecord } from './door-decade-walk';
import type { PublicEntityView } from '../data/public-seed';
import {
  TOUR_MAX,
  TOUR_MIN,
  isTourEligible,
  pickTourRecords,
  regionOf,
  tourHeading,
  tourZoom,
} from './door-tour';

const make = (id: string, state: string, decade: number, over: Partial<DoorRecord> = {}) =>
  ({
    entityId: id,
    name: `Record ${id}`,
    locality: `Town, ${state}`,
    href: `/entity/${id}`,
    lngLat: [-90, 35],
    precision: 'site',
    decade,
    person: false,
    statePostal: state,
    cameraSafe: true,
    plate: {
      url: `https://example.test/${id}.jpg`,
      alt: '',
      credit: 'x',
      rightsStatus: 'public_domain' as const,
    },
    claim: {
      id,
      statement: 'A claim that reads as a sentence.',
      source: { title: 'Source', href: 'https://example.test' },
    },
    ...over,
  }) as DoorRecord;

const catalog = [
  make('a', 'GA', 1890),
  make('b', 'AL', 1920),
  make('c', 'NY', 1930),
  make('d', 'IL', 1950),
  make('e', 'CA', 1960),
  make('f', 'TX', 1900),
  make('g', 'MS', 1970),
  make('h', 'OH', 1940),
];

test('a record is out when it is unphotographed, county-level, or unsafe for a camera', () => {
  assert.equal(isTourEligible(make('x', 'GA', 1900)), true);
  const { plate: _plate, ...noPhoto } = make('x', 'GA', 1900);
  assert.equal(isTourEligible(noPhoto as DoorRecord), false);
  assert.equal(isTourEligible(make('x', 'GA', 1900, { precision: 'county' })), false);
  assert.equal(isTourEligible(make('x', 'GA', 1900, { precision: 'state' })), false);
  assert.equal(isTourEligible(make('x', 'GA', 1900, { precision: 'city' })), true);
  assert.equal(isTourEligible(make('x', 'GA', 1900, { cameraSafe: false })), false);
  const { cameraSafe: _safe, ...unmarked } = make('x', 'GA', 1900);
  assert.equal(isTourEligible(unmarked as DoorRecord), false);
  assert.equal(isTourEligible(make('x', 'ZZ', 1900)), false);
  const fragment = { ...make('x', 'GA', 1900).claim, statement: 'on the Register' };
  assert.equal(isTourEligible(make('x', 'GA', 1900, { claim: fragment })), false);
});

test('the tour spreads across regions, reaches beyond the Southeast, and reads oldest first', () => {
  const tour = pickTourRecords(catalog);
  assert.equal(tour.length, 5);
  assert.ok(tour.some((record) => regionOf(record.statePostal) !== 'Southeast'));
  const regions = new Set(tour.map((record) => regionOf(record.statePostal)));
  assert.ok(regions.size >= 4);
  assert.deepEqual(
    tour.map((record) => record.decade),
    [...tour.map((record) => record.decade)].sort((a, b) => a - b),
  );
});

test('the same catalog gives the same tour, whatever order it arrives in', () => {
  const ids = (records: readonly DoorRecord[]) => pickTourRecords(records).map((r) => r.entityId);
  assert.deepEqual(ids(catalog), ids([...catalog].reverse()));
});

test('the tour never repeats the front door or the lead story, and stays within 3 to 6', () => {
  const first = pickTourRecords(catalog);
  const excluded = new Set(first.slice(0, 2).map((record) => record.entityId));
  const next = pickTourRecords(catalog, { excludeIds: excluded });
  assert.ok(next.every((record) => !excluded.has(record.entityId)));
  const named = pickTourRecords(catalog, { leadStoryText: `About ${first[0]!.name} today` });
  assert.ok(named.every((record) => record.entityId !== first[0]!.entityId));
  assert.deepEqual(pickTourRecords(catalog.slice(0, 2)), []);
  assert.equal(pickTourRecords(catalog.slice(0, TOUR_MIN)).length, TOUR_MIN);
  assert.equal(pickTourRecords(catalog, { target: 99 }).length, TOUR_MAX);
});

test('a Southeast-heavy catalog still gets a record from elsewhere when one exists', () => {
  const southern = ['GA', 'AL', 'MS', 'TN', 'NC', 'SC'].map((s, i) =>
    make(`s${i}`, s, 1900 + i * 10),
  );
  const tour = pickTourRecords([...southern, make('w', 'CA', 1960)]);
  assert.ok(tour.some((record) => record.entityId === 'w'));
});

test('the heading counts what was chosen, and the zoom is never tighter than the record allows', () => {
  assert.equal(tourHeading(pickTourRecords(catalog)), 'Five records, five places');
  assert.equal(tourZoom('site'), 12);
  assert.equal(tourZoom('city'), 10);
});

test('living-person gate: a person needs a recorded death, and any sensitivity class keeps a record off', () => {
  const entity = (over: Record<string, unknown>) =>
    ({ kind: 'person', ...over }) as unknown as PublicEntityView;
  assert.equal(isCameraSafe(entity({ livingStatus: 'deceased' })), true);
  assert.equal(isCameraSafe(entity({ livingStatus: 'living' })), false);
  assert.equal(isCameraSafe(entity({ livingStatus: 'unknown' })), false);
  assert.equal(isCameraSafe(entity({})), false);
  assert.equal(isCameraSafe(entity({ kind: 'place' })), true);
  assert.equal(
    isCameraSafe(entity({ kind: 'place', sensitivityClass: 'living_residence' })),
    false,
  );
});
