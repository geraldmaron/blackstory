/**
 * Entity anatomy fact builders: era resolution, where fallback, and geo place wiring.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPublicEntity } from '../../../data/public-seed';
import { buildEntityAnatomyInputs } from './entity-anatomy-facts';

function requireEntity(id: string) {
  const entity = getPublicEntity(id);
  assert.ok(entity, `expected seed fixture ${id} to exist`);
  return entity;
}

test('buildEntityAnatomyInputs links resolvable decades to the Lives evidence appendix', () => {
  const entity = requireEntity('ent_15th_st_church_001');
  const inputs = buildEntityAnatomyInputs(entity, undefined);
  assert.notEqual(inputs.eraLabel, 'Undated');
  if (inputs.eraHref) {
    assert.match(inputs.eraHref, /^\/lives\/explorer(\?decade=\d+)?$/);
  }
});

test('buildEntityAnatomyInputs resolves era from structured buckets before Undated', () => {
  const entity = requireEntity('ent_15th_st_church_001');
  const inputs = buildEntityAnatomyInputs(entity, undefined);
  assert.notEqual(inputs.eraLabel, 'Undated');
  assert.match(inputs.evidenceLabel, /claim/);
  assert.equal(
    inputs.whereLabel,
    'Dupont/Sixteenth Street Historic District area, Washington, D.C.',
  );
});

test('buildEntityAnatomyInputs falls back to Place withheld when jurisdiction unknown', () => {
  const entity = requireEntity('ent_15th_st_church_001');
  const inputs = buildEntityAnatomyInputs({ ...entity, jurisdictionLabel: 'Unknown' }, undefined);
  assert.equal(inputs.whereLabel, 'Dupont/Sixteenth Street Historic District area');
});

test('buildEntityAnatomyInputs does not treat United States as a place', () => {
  const entity = requireEntity('ent_15th_st_church_001');
  const inputs = buildEntityAnatomyInputs(
    { ...entity, jurisdictionLabel: 'United States' },
    undefined,
  );
  assert.equal(inputs.whereLabel, 'Dupont/Sixteenth Street Historic District area');
});
