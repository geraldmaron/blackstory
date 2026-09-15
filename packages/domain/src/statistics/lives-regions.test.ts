import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LIVES_AREAS,
  LIVES_NATIONAL,
  LIVES_REGIONS,
  livesAreaBySlug,
  livesRegionForState,
} from './lives-regions.js';

/** 50 states and the District of Columbia, as loaded in bb_reference.jurisdictions (Puerto Rico excluded). */
const STATE_FIPS = [
  '01',
  '02',
  '04',
  '05',
  '06',
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
  '42',
  '44',
  '45',
  '46',
  '47',
  '48',
  '49',
  '50',
  '51',
  '53',
  '54',
  '55',
  '56',
];

test('six regions assign every state and DC exactly once', () => {
  assert.equal(LIVES_REGIONS.length, 6);
  const assigned = LIVES_REGIONS.flatMap((region) => region.memberStateFips);
  assert.equal(assigned.length, STATE_FIPS.length);
  assert.equal(new Set(assigned).size, assigned.length, 'a state is in two regions');
  assert.deepEqual([...assigned].sort(), STATE_FIPS);
});

test('the national baseline covers every region member', () => {
  assert.deepEqual([...LIVES_NATIONAL.memberStateFips], STATE_FIPS);
  assert.equal(LIVES_AREAS[0], LIVES_NATIONAL);
});

test('ids and slugs are stable and unique', () => {
  const slugs = new Set(LIVES_AREAS.map((area) => area.slug));
  const ids = new Set(LIVES_AREAS.map((area) => area.id));
  assert.equal(slugs.size, LIVES_AREAS.length);
  assert.equal(ids.size, LIVES_AREAS.length);
  for (const region of LIVES_REGIONS) assert.match(region.id, /^region:us-[a-z-]+$/);
});

test('regions resolve by slug and states resolve to their region', () => {
  assert.equal(livesAreaBySlug('deep-south')?.name, 'Deep South');
  assert.equal(livesRegionForState('48')?.slug, 'texas-oklahoma');
  assert.equal(livesRegionForState('11')?.slug, 'upper-south');
  assert.equal(livesRegionForState('72'), undefined);
});
