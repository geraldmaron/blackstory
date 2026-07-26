/** Tests for theme-impact packet builder and publish gates. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  THEME_IMPACT_MULTI_DECADE_CHECKLIST_ITEMS,
  THEME_IMPACT_PACKET_KIND,
  assertThemeImpactPacketMultiDecadeChecklist,
  assertThemeImpactPacketPublishable,
  buildThemeImpactPacket,
  createRedliningQ3FixturePacket,
  deriveDefaultMultiDecadeChecklist,
  satisfiesTwoAnchorRule,
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

test('satisfiesTwoAnchorRule: no anchors field is not load-bearing (opt-in, passes)', () => {
  const packet = createRedliningQ3FixturePacket();
  assert.equal(satisfiesTwoAnchorRule(packet.observations[0]!), true);
});

test('satisfiesTwoAnchorRule: two independent T1/T2 anchors satisfies the rule', () => {
  const packet = createRedliningQ3FixturePacket({
    observations: [
      {
        ...createRedliningQ3FixturePacket().observations[0]!,
        anchors: [
          { url: 'https://www.census.gov/anchor-a', label: 'Census' },
          { url: 'https://www.federalreserve.gov/anchor-b', label: 'Fed' },
        ],
      },
    ],
  });
  assert.equal(satisfiesTwoAnchorRule(packet.observations[0]!), true);
});

test('satisfiesTwoAnchorRule: a single anchor without replicationVerified fails', () => {
  const packet = createRedliningQ3FixturePacket({
    observations: [
      {
        ...createRedliningQ3FixturePacket().observations[0]!,
        anchors: [{ url: 'https://www.census.gov/anchor-a', label: 'Census' }],
      },
    ],
  });
  assert.equal(satisfiesTwoAnchorRule(packet.observations[0]!), false);
});

test('satisfiesTwoAnchorRule: one T1 anchor + replicationVerified satisfies the exception', () => {
  const packet = createRedliningQ3FixturePacket({
    observations: [
      {
        ...createRedliningQ3FixturePacket().observations[0]!,
        anchors: [{ url: 'https://www.census.gov/anchor-a', label: 'Census' }],
        replicationVerified: true,
      },
    ],
  });
  assert.equal(satisfiesTwoAnchorRule(packet.observations[0]!), true);
});

test('assertThemeImpactPacketPublishable rejects a published observation with an unsatisfied anchor declaration', () => {
  const packet = createRedliningQ3FixturePacket({
    status: 'published',
    observations: [
      {
        ...createRedliningQ3FixturePacket().observations[0]!,
        anchors: [{ url: 'https://www.census.gov/anchor-a', label: 'Census' }],
      },
    ],
  });
  assert.throws(() => assertThemeImpactPacketPublishable(packet), /declares anchors/);
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

test('published packet without multiDecadeChecklist fails closed', () => {
  const packet = buildThemeImpactPacket({
    id: 'tip_test_missing_checklist',
    questionId: 'Q3',
    themeId: 'redlining',
    title: 'Missing checklist',
    geography: { geographyType: 'county', boundaryVersion: 'county-2020' },
    methodNote: 'test',
    observations: [
      {
        observationId: 'obs1',
        metricId: 'm1',
        estimate: 1,
        unit: 'percent',
        referencePeriod: '2020',
        provenance: {
          source: 's',
          sourceUrl: 'https://example.com',
          retrievedAt: '2026-01-01T00:00:00.000Z',
          contentHash: 'sha256:x',
          humanCitation: 'cite',
        },
      },
    ],
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    // multiDecadeChecklist omitted from the constructor call is impossible via
    // buildThemeImpactPacket (it always derives a default) — assert the raw gate
    // rejects a packet whose checklist was stripped after construction instead.
  });
  const stripped = { ...packet, multiDecadeChecklist: undefined } as typeof packet;
  assert.throws(
    () => assertThemeImpactPacketMultiDecadeChecklist(stripped),
    /requires multiDecadeChecklist/,
  );
});

test('deriveDefaultMultiDecadeChecklist marks every item present or an explicit gap_state', () => {
  const checklist = deriveDefaultMultiDecadeChecklist({
    observations: [],
    derived: [],
    artifacts: [],
    geography: { geographyType: 'county', boundaryVersion: 'county-2020' },
  });
  for (const item of THEME_IMPACT_MULTI_DECADE_CHECKLIST_ITEMS) {
    const entry = checklist[item];
    assert.ok(entry, `missing ${item}`);
    if (!entry.present) {
      assert.ok(entry.note.length > 0);
    }
  }
  assert.equal(checklist.primary_layer.present, false);
  assert.equal(checklist.crosswalk_layer.present, false);
});

test('Chicago redlining fixture publishes with an auto-derived checklist (crosswalk still a gap)', () => {
  const packet = createRedliningQ3FixturePacket({ status: 'published' });
  assert.doesNotThrow(() => assertThemeImpactPacketPublishable(packet));
  assert.equal(packet.multiDecadeChecklist?.primary_layer.present, true);
  assert.equal(packet.multiDecadeChecklist?.crosswalk_layer.present, false);
});
