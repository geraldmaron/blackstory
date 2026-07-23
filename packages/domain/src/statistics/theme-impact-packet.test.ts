/** Tests for theme-impact packet builder and publish gates. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  THEME_IMPACT_PACKET_KIND,
  assertThemeImpactPacketPublishable,
  buildThemeImpactPacket,
  createRedliningQ3FixturePacket,
} from './theme-impact-packet.js';
import {
  RESEARCHED_THEME_IMPACT_PACKETS,
  THEME_RESEARCH_ADJUDICATION,
} from './researched-theme-impact-packets.js';

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

test('researched catalog publishes exactly one packet for every substantive question', () => {
  const questionIds = RESEARCHED_THEME_IMPACT_PACKETS.map((packet) => packet.questionId);
  assert.deepEqual(
    [...questionIds].sort(),
    ['Q1', 'Q11', 'Q12', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9'],
  );
  assert.equal(new Set(questionIds).size, 11);
  for (const packet of RESEARCHED_THEME_IMPACT_PACKETS) {
    assert.doesNotThrow(() => assertThemeImpactPacketPublishable(packet));
  }
});

test('researched packet artifacts use content hashes rather than artifact ids or placeholders', () => {
  const artifactIds = new Set(
    RESEARCHED_THEME_IMPACT_PACKETS.flatMap((packet) =>
      packet.artifacts.map((artifact) => artifact.artifactId),
    ),
  );
  for (const packet of RESEARCHED_THEME_IMPACT_PACKETS) {
    for (const artifact of packet.artifacts) {
      assert.match(artifact.provenance.contentHash, /^[a-f0-9]{64}$/);
      assert.ok(!artifactIds.has(artifact.provenance.contentHash));
      assert.doesNotMatch(
        `${artifact.artifactId} ${artifact.title} ${artifact.citation}`,
        /placeholder|contested|intelligence-linked/i,
      );
    }
  }
});

test('every researched theme exposes more than one artifact source lineage', () => {
  const sourceLineagesByTheme = new Map<string, Set<string>>();
  for (const packet of RESEARCHED_THEME_IMPACT_PACKETS) {
    const sources = sourceLineagesByTheme.get(packet.themeId) ?? new Set<string>();
    for (const artifact of packet.artifacts) {
      sources.add(artifact.provenance.source);
    }
    sourceLineagesByTheme.set(packet.themeId, sources);
  }

  for (const [themeId, sources] of sourceLineagesByTheme) {
    assert.ok(
      sources.size >= 2,
      `${themeId} requires at least two artifact source lineages; found ${[...sources].join(', ')}`,
    );
  }
});

test('research adjudication challenges every public theme', () => {
  const packetThemeIds = new Set(
    RESEARCHED_THEME_IMPACT_PACKETS.map((packet) => packet.themeId),
  );
  const adjudicatedThemeIds = new Set(
    THEME_RESEARCH_ADJUDICATION.map((row) => row.themeId),
  );
  assert.deepEqual(adjudicatedThemeIds, packetThemeIds);
  assert.equal(adjudicatedThemeIds.size, 7);
  assert.ok(
    THEME_RESEARCH_ADJUDICATION.every((row) => row.rationale.trim().length >= 80),
  );
});

test('redlining Q1 uses gated causal claim with named secondary claim ids', () => {
  const q1 = RESEARCHED_THEME_IMPACT_PACKETS.find((packet) => packet.questionId === 'Q1');
  assert.ok(q1);
  assert.equal(q1.methodStance, 'gated_causal_claim');
  assert.ok((q1.causalClaimIds ?? []).length >= 2);
  assert.match(q1.methodNote, /Rothstein|Massey|Banaji/);
  assert.match(q1.geography.label ?? '', /example/i);
});
