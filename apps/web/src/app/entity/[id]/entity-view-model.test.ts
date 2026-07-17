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
  const event = requireEntity('ent_seed_event_001');
  assert.equal(event.status, undefined);
  assert.equal(deriveHistoricalFraming(event), 'historical');
});

test('a place-like kind with status=active frames as present_day', () => {
  const institution = requireEntity('ent_seed_institution_001');
  assert.equal(institution.status, 'active');
  assert.equal(deriveHistoricalFraming(institution), 'present_day');
});

test('a place-like kind with status=historic frames as historical', () => {
  const place = requireEntity('ent_seed_place_001');
  assert.equal(place.status, 'historic');
  assert.equal(deriveHistoricalFraming(place), 'historical');
});

test('a place-like kind with no status field at all frames as historical (never present_day by default)', () => {
  const { status: _status, ...withoutStatus } = requireEntity('ent_seed_place_001');
  assert.equal(deriveHistoricalFraming(withoutStatus), 'historical');
});

test('isSparseRecord is true only when claims, related, and timeline are all empty', () => {
  const base = requireEntity('ent_seed_place_001');
  assert.equal(isSparseRecord(base), false, 'the real seed fixture has claims/related/timeline');
  assert.equal(isSparseRecord({ ...base, claims: [], related: [], timeline: [] }), true);
  assert.equal(isSparseRecord({ ...base, claims: [], related: [] }), false, 'timeline still populated');
});
