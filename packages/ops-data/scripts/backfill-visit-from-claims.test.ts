/**
 * Unit tests for the pure claim-predicate-preference planner in backfill-visit-from-claims.ts.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planVisitFromClaims } from './backfill-visit-from-claims.ts';

test('planVisitFromClaims prefers official_website over visitor_website', () => {
  const plan = planVisitFromClaims([
    { entityId: 'ent_1', claimId: 'c1', predicate: 'visitor_website', object: 'https://b.example' },
    {
      entityId: 'ent_1',
      claimId: 'c2',
      predicate: 'official_website',
      object: 'https://a.example',
    },
  ]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0]?.website, 'https://a.example');
  assert.equal(plan[0]?.websiteSourceId, 'c2');
});

test('planVisitFromClaims prefers visitor_phone over public_phone', () => {
  const plan = planVisitFromClaims([
    { entityId: 'ent_1', claimId: 'c1', predicate: 'public_phone', object: '(205) 555-0000' },
    { entityId: 'ent_1', claimId: 'c2', predicate: 'visitor_phone', object: '(205) 555-1111' },
  ]);
  assert.equal(plan[0]?.phoneDisplay, '(205) 555-1111');
});

test('planVisitFromClaims prefers public_hours over visitor_hours over hours_note', () => {
  const plan = planVisitFromClaims([
    { entityId: 'ent_1', claimId: 'c1', predicate: 'hours_note', object: 'Call ahead' },
    { entityId: 'ent_1', claimId: 'c2', predicate: 'visitor_hours', object: 'Mon-Fri 9-5' },
    { entityId: 'ent_1', claimId: 'c3', predicate: 'public_hours', object: 'Tue-Sat 10-5' },
  ]);
  assert.equal(plan[0]?.hours, 'Tue-Sat 10-5');
});

test('planVisitFromClaims groups by entity and collects distinct source ids', () => {
  const plan = planVisitFromClaims([
    {
      entityId: 'ent_1',
      claimId: 'c1',
      predicate: 'official_website',
      object: 'https://a.example',
    },
    { entityId: 'ent_1', claimId: 'c2', predicate: 'visitor_phone', object: '(205) 555-1111' },
    { entityId: 'ent_2', claimId: 'c3', predicate: 'public_hours', object: 'Tue-Sat 10-5' },
  ]);
  assert.equal(plan.length, 2);
  const ent1 = plan.find((row) => row.entityId === 'ent_1');
  assert.deepEqual([...(ent1?.sourceIds ?? [])].sort(), ['c1', 'c2']);
});

test('planVisitFromClaims skips entities with no matching predicate', () => {
  const plan = planVisitFromClaims([
    { entityId: 'ent_1', claimId: 'c1', predicate: 'founded_year', object: '1900' },
  ]);
  assert.equal(plan.length, 0);
});

test('planVisitFromClaims is deterministic when duplicate predicates tie', () => {
  const claims = [
    {
      entityId: 'ent_1',
      claimId: 'c2',
      predicate: 'official_website',
      object: 'https://b.example',
    },
    {
      entityId: 'ent_1',
      claimId: 'c1',
      predicate: 'official_website',
      object: 'https://a.example',
    },
  ];
  const plan = planVisitFromClaims(claims);
  // Lower claim id wins the tie (deterministic sort by claimId).
  assert.equal(plan[0]?.website, 'https://a.example');
  assert.equal(plan[0]?.websiteSourceId, 'c1');
});
