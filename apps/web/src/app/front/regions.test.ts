import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isCameraSafe, type ShownRecord } from './shown-records';
import type { PublicEntityView } from '../../data/public-seed';
import { isTourEligible } from './regions';

const make = (id: string, state: string, decade: number, over: Partial<ShownRecord> = {}) =>
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
  }) as ShownRecord;

test('a record is out when it is unphotographed, county-level, or unsafe for a camera', () => {
  assert.equal(isTourEligible(make('x', 'GA', 1900)), true);
  const { plate: _plate, ...noPhoto } = make('x', 'GA', 1900);
  assert.equal(isTourEligible(noPhoto as ShownRecord), false);
  assert.equal(isTourEligible(make('x', 'GA', 1900, { precision: 'county' })), false);
  assert.equal(isTourEligible(make('x', 'GA', 1900, { precision: 'state' })), false);
  assert.equal(isTourEligible(make('x', 'GA', 1900, { precision: 'city' })), true);
  assert.equal(isTourEligible(make('x', 'GA', 1900, { cameraSafe: false })), false);
  const { cameraSafe: _safe, ...unmarked } = make('x', 'GA', 1900);
  assert.equal(isTourEligible(unmarked as ShownRecord), false);
  assert.equal(isTourEligible(make('x', 'ZZ', 1900)), false);
  assert.equal(isTourEligible(make('x', 'GA', 1900, { locality: null })), false);
  assert.equal(isTourEligible(make('x', 'GA', 1900, { locality: '  ' })), false);
  const fragment = { ...make('x', 'GA', 1900).claim, statement: 'on the Register' };
  assert.equal(isTourEligible(make('x', 'GA', 1900, { claim: fragment })), false);
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
