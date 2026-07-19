/**
 * Unit tests for the entity detail page's status-driven framing derivation.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPublicEntity } from '../../../data/public-seed';
import { deriveHistoricalFraming, isSparseRecord } from './entity-view-model';

function requireEntity(id: string) {
  const entity = getPublicEntity(id);
  assert.ok(entity, `expected seed fixture ${id} to exist`);
  return entity;
}

test('an event kind always frames as historical, even with no status field at all', () => {
  const event = requireEntity('ent_dc_landmark_listing_1975');
  assert.equal(event.status, undefined);
  assert.equal(deriveHistoricalFraming(event), 'historical');
});

test('a place-like kind with status=active frames as present_day', () => {
  const institution = requireEntity('ent_dunbar_alumni_federation_001');
  assert.equal(institution.status, 'active');
  assert.equal(deriveHistoricalFraming(institution), 'present_day');
});

test('a place-like kind with status=historic frames as historical', () => {
  // None of the real fixtures carry a present-day "historic" status (the church, school, and
  // alumni federation are all still active today) this exercises the pure branch logic with a
  // synthetic status override, not a real record's current status.
  const church = requireEntity('ent_15th_st_church_001');
  assert.equal(deriveHistoricalFraming({ ...church, status: 'historic' }), 'historical');
});

test('a place-like kind with no status field at all frames as historical (never present_day by default)', () => {
  const { status: _status, ...withoutStatus } = requireEntity('ent_15th_st_church_001');
  assert.equal(deriveHistoricalFraming(withoutStatus), 'historical');
});

test('isSparseRecord is true only when claims, related, and timeline are all empty', () => {
  const base = requireEntity('ent_15th_st_church_001');
  assert.equal(isSparseRecord(base), false, 'the real seed fixture has claims/related/timeline');
  assert.equal(isSparseRecord({ ...base, claims: [], related: [], timeline: [] }), true);
  assert.equal(isSparseRecord({ ...base, claims: [], related: [] }), false, 'timeline still populated');
});
