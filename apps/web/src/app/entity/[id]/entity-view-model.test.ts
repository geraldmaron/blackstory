/**
 * Unit tests for the entity detail page's status-driven view-model logic.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPublicEntity } from '../../../data/public-seed';
import { deriveRecordStanding, isSparseRecord, isThinRecord } from './entity-view-model';

function requireEntity(id: string) {
  const entity = getPublicEntity(id);
  assert.ok(entity, `expected seed fixture ${id} to exist`);
  return entity;
}

test('an event kind has no standing at all — its when-span is authoritative', () => {
  const event = requireEntity('ent_dc_landmark_listing_1975');
  assert.equal(event.status, undefined);
  assert.equal(deriveRecordStanding(event), undefined);
});

test('standing reports the status vocabulary the record itself carries', () => {
  const institution = requireEntity('ent_dunbar_alumni_federation_001');
  assert.equal(institution.status, 'active');
  assert.equal(deriveRecordStanding(institution), 'Active');

  const church = requireEntity('ent_15th_st_church_001');
  assert.equal(deriveRecordStanding({ ...church, status: 'historic' }), 'Historic');
});

test('standing does not collapse non-place vocabularies into "historical"', () => {
  // The old rule was `status === 'active'`, which only place-like kinds ever take. It read 66
  // in-force laws and cases on the live release as "Historical record".
  const church = requireEntity('ent_15th_st_church_001');
  // Kind is left alone on purpose: only 'event' changes the branch, so these exercise the
  // law/person status VALUES the old `status === 'active'` rule could never surface.
  assert.equal(deriveRecordStanding({ ...church, status: 'in_force' }), 'In Force');
  assert.equal(deriveRecordStanding({ ...church, status: 'living' }), 'Living');
  assert.equal(deriveRecordStanding({ ...church, status: 'deceased' }), 'Deceased');
});

test('an unknown or absent status yields no standing rather than a default', () => {
  const church = requireEntity('ent_15th_st_church_001');
  // 112 people on the live release carry status 'unknown'; that must not harden into a claim.
  assert.equal(deriveRecordStanding({ ...church, status: 'unknown' }), undefined);
  const { status: _status, ...withoutStatus } = church;
  assert.equal(deriveRecordStanding(withoutStatus), undefined);
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
