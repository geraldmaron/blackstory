/**
 * Curated statute rows for theme-impact arc side rails.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  listThemeImpactLinkedStatutes,
  listThemeImpactLinkedStatutesForQuestion,
} from './theme-impact-linked-statutes.js';

test('redlining linked statutes include four housing laws with real summaries', () => {
  const statutes = listThemeImpactLinkedStatutes('redlining');
  assert.equal(statutes.length, 4);

  const ids = statutes.map((row) => row.entityId);
  assert.deepEqual(ids, [
    'ent_law_home_owners_loan_act_1933',
    'ent_law_national_housing_act_1934',
    'ent_law_fair_housing_act_1968',
    'ent_law_community_reinvestment_act_1977',
  ]);

  for (const row of statutes) {
    assert.ok(row.displayName.length > 0);
    assert.ok(row.summary.length > 40);
    assert.doesNotMatch(row.summary, /—/);
    assert.doesNotMatch(row.summary, /summary coming soon/i);
  }
});

test('unknown themes return no linked statutes', () => {
  assert.deepEqual(listThemeImpactLinkedStatutes('drug_policy_state'), []);
});

test('redlining beat statutes map to inline arc cards', () => {
  const q1 = listThemeImpactLinkedStatutesForQuestion('redlining', 'Q1');
  assert.equal(q1.length, 2);
  assert.equal(q1[0]?.entityId, 'ent_law_home_owners_loan_act_1933');

  const q3 = listThemeImpactLinkedStatutesForQuestion('redlining', 'Q3');
  assert.equal(q3.length, 2);
  assert.equal(q3[1]?.entityId, 'ent_law_community_reinvestment_act_1977');

  assert.deepEqual(listThemeImpactLinkedStatutesForQuestion('redlining', 'Q2'), []);
});
