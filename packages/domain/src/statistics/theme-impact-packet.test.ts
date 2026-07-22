/** Tests for theme-impact packet builder and publish gates. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  THEME_IMPACT_PACKET_KIND,
  assertThemeImpactPacketPublishable,
  buildThemeImpactPacket,
  createRedliningQ3FixturePacket,
} from './theme-impact-packet.js';

test('buildThemeImpactPacket defaults to juxtaposition and freezes arrays', () => {
  const packet = createRedliningQ3FixturePacket();
  assert.equal(packet.kind, THEME_IMPACT_PACKET_KIND);
  assert.equal(packet.methodStance, 'juxtaposition');
  assert.equal(packet.status, 'draft');
  assert.ok(Object.isFrozen(packet));
  assert.ok(Object.isFrozen(packet.observations));
  assert.equal(packet.observations.length, 1);
  assert.equal(packet.gapStates[0], 'insufficient_evidence');
});

test('optional entityBinding uses conditional spread', () => {
  const withBinding = createRedliningQ3FixturePacket({
    entityBinding: { entityId: 'ent_fixture_place', purpose: 'map_panel' },
  });
  assert.equal(withBinding.entityBinding?.entityId, 'ent_fixture_place');
  const standalone = createRedliningQ3FixturePacket();
  assert.equal(standalone.entityBinding, undefined);
});

test('assertThemeImpactPacketPublishable requires provenance on published rows', () => {
  const incomplete = createRedliningQ3FixturePacket({
    status: 'published',
    observations: [
      {
        observationId: 'obs_bad',
        metricId: 'acs-homeownership-rate-black-county',
        estimate: 1,
        unit: 'percent',
        referencePeriod: '2022',
        provenance: {
          source: 'ACS',
          sourceUrl: '',
          retrievedAt: '2026-07-22T12:00:00.000Z',
          contentHash: 'sha256:x',
          humanCitation: 'cite',
        },
      },
    ],
  });
  assert.throws(() => assertThemeImpactPacketPublishable(incomplete), /sourceUrl/);
});

test('published fixture with complete provenance passes', () => {
  const packet = createRedliningQ3FixturePacket({ status: 'published' });
  assert.doesNotThrow(() => assertThemeImpactPacketPublishable(packet));
});

test('gated_causal_claim without claim ids fails publish', () => {
  const packet = createRedliningQ3FixturePacket({
    status: 'published',
    methodStance: 'gated_causal_claim',
  });
  assert.throws(() => assertThemeImpactPacketPublishable(packet), /claimId|causalClaimIds/);
});

test('gated_causal_claim with causalClaimIds passes', () => {
  const packet = createRedliningQ3FixturePacket({
    status: 'published',
    methodStance: 'gated_causal_claim',
    causalClaimIds: ['claim_fixture_peer_reviewed'],
  });
  assert.doesNotThrow(() => assertThemeImpactPacketPublishable(packet));
});

test('empty published non-Q10 packet fails', () => {
  const packet = buildThemeImpactPacket({
    id: 'tip_empty',
    questionId: 'Q3',
    themeId: 'redlining',
    title: 'Empty',
    methodNote: 'note',
    geography: { geographyType: 'county', boundaryVersion: 'county-2020' },
    status: 'published',
    createdAt: '2026-07-22T15:00:00.000Z',
    updatedAt: '2026-07-22T15:00:00.000Z',
  });
  assert.throws(() => assertThemeImpactPacketPublishable(packet), /requires observations/);
});

test('Q10 methodology packet may publish without metrics', () => {
  const packet = buildThemeImpactPacket({
    id: 'tip_q10',
    questionId: 'Q10',
    themeId: 'cross_cutting',
    title: 'When is impact language allowed?',
    methodNote: 'Causal language only behind the claim confidence gate.',
    geography: { geographyType: 'nation', boundaryVersion: 'nation-2020', label: 'United States' },
    status: 'published',
    createdAt: '2026-07-22T15:00:00.000Z',
    updatedAt: '2026-07-22T15:00:00.000Z',
  });
  assert.doesNotThrow(() => assertThemeImpactPacketPublishable(packet));
});
