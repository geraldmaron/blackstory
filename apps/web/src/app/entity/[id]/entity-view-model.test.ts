/**
 * Unit tests for the entity detail page's status-driven framing derivation.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPublicEntity } from '../../../data/public-seed';
import { deriveHistoricalFraming, isSparseRecord, isThinRecord } from './entity-view-model';

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

test('isThinRecord reads the published coverage field, not how empty the page looks', () => {
  const base = { ...requireEntity('ent_15th_st_church_001'), historicalContext: '' };
  assert.equal(isThinRecord({ ...base, researchCoverage: 'minimal' }), true);
  assert.equal(isThinRecord({ ...base, researchCoverage: 'partial' }), false);
  assert.equal(isThinRecord({ ...base, researchCoverage: 'substantial' }), false);
  assert.equal(
    isThinRecord({ ...base, researchCoverage: 'partial', claims: [], related: [], timeline: [] }),
    false,
    'an empty page is not a registry listing unless the record says its coverage is minimal',
  );
});

/**
 * repo-z1pw/repo-ol8v: coverage counts distinct source DOCUMENTS, so 'minimal' also covers a
 * genuinely researched record that leans on one source. THIN_RECORD_COPY tells the reader "what
 * you see here is the listing itself rather than a researched history" — false over real
 * narrative prose, so narrative context suppresses the notice.
 */
test('isThinRecord does not call a single-sourced record with real narrative a registry listing', () => {
  const base = requireEntity('ent_15th_st_church_001');
  assert.equal(
    isThinRecord({
      ...base,
      researchCoverage: 'minimal',
      historicalContext: 'Founded in 1866 by freedmen who had met in a Georgetown parlor.',
    }),
    false,
    'a record carrying researched narrative is single-sourced, not unresearched',
  );
  assert.equal(
    isThinRecord({ ...base, researchCoverage: 'minimal', historicalContext: '   ' }),
    true,
    'whitespace-only context is no context',
  );
});

test('isSparseRecord is true only when claims, related, and timeline are all empty', () => {
  const base = requireEntity('ent_15th_st_church_001');
  assert.equal(isSparseRecord(base), false, 'the real seed fixture has claims/related/timeline');
  assert.equal(isSparseRecord({ ...base, claims: [], related: [], timeline: [] }), true);
  assert.equal(
    isSparseRecord({ ...base, claims: [], related: [] }),
    false,
    'timeline still populated',
  );
});
