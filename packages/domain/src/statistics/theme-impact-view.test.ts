/** Tests for theme-impact view mappers and display formatting. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRedliningQ3FixturePacket } from './theme-impact-packet.js';
import {
  formatThemeImpactEstimate,
  parseThemeImpactPacketRow,
  themeImpactPacketToView,
} from './theme-impact-view.js';

test('formatThemeImpactEstimate handles percent, USD, and per_100k', () => {
  assert.equal(formatThemeImpactEstimate(41.5, 'percent'), '41.5%');
  assert.equal(formatThemeImpactEstimate(-51286, 'USD'), '−$51,286');
  assert.equal(formatThemeImpactEstimate(141.51, 'per_100k'), '141.51 per 100,000 residents');
});

test('themeImpactPacketToView resolves question text and policy era labels', () => {
  const packet = createRedliningQ3FixturePacket({
    status: 'published',
    themeId: 'redlining',
    questionId: 'Q3',
  });
  const view = themeImpactPacketToView(packet, { dataSource: 'fixture' });
  assert.equal(view.questionId, 'Q3');
  assert.match(view.question, /homeownership/i);
  assert.ok(view.policyEras.some((era) => era.id === 'holc_fha' && era.label.includes('HOLC')));
  assert.equal(view.observations.length, 1);
  assert.match(view.observations[0]?.value ?? '', /%/);
});

test('parseThemeImpactPacketRow maps postgres column names', () => {
  const packet = parseThemeImpactPacketRow({
    id: 'tip_test',
    question_id: 'Q3',
    theme_id: 'redlining',
    title: 'Cook County indicators',
    summary: 'Summary text',
    policy_eras: ['holc_fha'],
    geography: {
      geographyType: 'county',
      jurisdictionId: 'county:17031',
      boundaryVersion: 'county-2020',
      label: 'Cook County, IL',
    },
    method_stance: 'juxtaposition',
    method_note: 'Juxtaposition is not causation.',
    observations: [],
    derived: [],
    artifacts: [],
    gap_states: [],
    status: 'published',
    created_at: '2026-07-22T20:00:00.000Z',
    updated_at: '2026-07-22T20:00:00.000Z',
  });
  assert.equal(packet.id, 'tip_test');
  assert.equal(packet.questionId, 'Q3');
  assert.equal(packet.geography.jurisdictionId, 'county:17031');
});

test('parseThemeImpactPacketRow restores causal claim ids and entity binding', () => {
  const packet = parseThemeImpactPacketRow({
    id: 'tip_causal',
    question_id: 'Q1',
    theme_id: 'redlining',
    title: 'Causal title',
    summary: 'Summary',
    policy_eras: ['holc_fha'],
    geography: {
      geographyType: 'nation',
      jurisdictionId: 'nation:US',
      boundaryVersion: 'nation-2020',
      label: 'United States (Chicago example)',
    },
    method_stance: 'gated_causal_claim',
    method_note: 'Named secondary consensus.',
    observations: [],
    derived: [],
    artifacts: [],
    gap_states: [],
    causal_claim_ids: ['claim_systemic_fha_holc_enabled_segregation_rothstein_2017'],
    entity_id: 'ent_chicago_race_riot_1919_001',
    binding_purpose: 'story',
    status: 'published',
    created_at: '2026-07-23T22:30:00.000Z',
    updated_at: '2026-07-23T22:30:00.000Z',
  });
  assert.equal(packet.methodStance, 'gated_causal_claim');
  assert.deepEqual(packet.causalClaimIds, [
    'claim_systemic_fha_holc_enabled_segregation_rothstein_2017',
  ]);
  assert.equal(packet.entityBinding?.entityId, 'ent_chicago_race_riot_1919_001');
});
