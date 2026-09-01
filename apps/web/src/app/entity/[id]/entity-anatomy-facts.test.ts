/**
 * Entity anatomy fact builders: era resolution, where fallback, and geo place wiring.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPublicEntity } from '../../../data/public-seed';
import { buildEntityAnatomyInputs, buildEntityAnatomyPlace } from './entity-anatomy-facts';

function requireEntity(id: string) {
  const entity = getPublicEntity(id);
  assert.ok(entity, `expected seed fixture ${id} to exist`);
  return entity;
}

test('buildEntityAnatomyInputs resolves era from structured buckets before Undated', () => {
  const entity = requireEntity('ent_15th_st_church_001');
  const inputs = buildEntityAnatomyInputs(entity, undefined);
  assert.notEqual(inputs.eraLabel, 'Undated');
  assert.match(inputs.evidenceLabel, /source/);
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

test('buildEntityAnatomyPlace returns undefined without geo anchor', () => {
  const entity = requireEntity('ent_15th_st_church_001');
  assert.equal(buildEntityAnatomyPlace(entity, undefined), undefined);
});

test('buildEntityAnatomyPlace carries precision caption when geo exists', () => {
  const entity = requireEntity('ent_15th_st_church_001');
  const anchor = entity.geoAnchor ?? { lat: 38.9, lng: -77.0 };
  const place = buildEntityAnatomyPlace(entity, anchor);
  assert.ok(place);
  assert.equal(place.lat, anchor.lat);
  assert.equal(place.precision, entity.locationPrecision);
  assert.ok(place.precisionCaption);
});
