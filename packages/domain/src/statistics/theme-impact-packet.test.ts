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
  assert.match(q1.geography.label ?? '', /example|United States|Chicago/i);
});

test('redlining arc summaries expand agency names and link entity cards', () => {
  const [q1, q3, q4] = (['Q1', 'Q3', 'Q4'] as const).map((id) =>
    RESEARCHED_THEME_IMPACT_PACKETS.find((packet) => packet.questionId === id),
  );
  assert.ok(q1 && q3 && q4);
  assert.match(q1.summary, /Home Owners' Loan Corporation/);
  assert.match(q1.summary, /Federal Housing Administration/);
  assert.match(q1.summary, /\[\[ent_chicago_race_riot_1919_001\|/);
  assert.match(q1.summary, /\[\[ent_law_home_owners_loan_act_1933\|/);
  assert.match(q1.summary, /\[\[ent_law_national_housing_act_1934\|/);
  assert.match(q3.summary, /\[\[ent_law_fair_housing_act_1968\|/);
  assert.match(q3.summary, /\[\[ent_law_community_reinvestment_act_1977\|/);
  assert.match(q3.summary, /2018 and 2023/);
  assert.match(q4.summary, /\[\[ent_bronzeville_001\|/);
  for (const packet of [q1, q3, q4]) {
    assert.doesNotMatch(packet.summary, /\u2014/);
  }
});

test('Census CPS A-1 and BJS Table 6 primary series back voting and national imprisonment', () => {
  const voting = RESEARCHED_THEME_IMPACT_PACKETS.find((packet) => packet.questionId === 'Q12');
  const mass = RESEARCHED_THEME_IMPACT_PACKETS.find((packet) => packet.questionId === 'Q8');
  assert.ok(voting);
  assert.ok(mass);

  const black2012 = voting.observations.find(
    (row) =>
      row.metricId === 'cps-a1-turnout-black-nation' && row.referencePeriod === '2012',
  );
  assert.equal(black2012?.estimate, 66.2);
  assert.equal(black2012?.provenance.source, 'us-census-cps');
  assert.match(black2012?.provenance.contentHash ?? '', /^[a-f0-9]{64}$/);
  assert.equal(
    voting.observations.filter((row) => row.metricId.startsWith('cps-a1-turnout-')).length,
    32,
  );
  assert.ok(
    voting.artifacts.some(
      (artifact) => artifact.artifactId === 'art_census_cps_a1_voting_historical',
    ),
  );

  const blackImp2022 = mass.observations.find(
    (row) =>
      row.metricId === 'bjs-imprisonment-rate-black-nation' &&
      row.referencePeriod === '2022',
  );
  assert.equal(blackImp2022?.estimate, 1196);
  assert.equal(blackImp2022?.provenance.source, 'bjs-national-prisoner-statistics');
  assert.ok(
    mass.observations.some(
      (row) =>
        row.metricId === 'imprisonment-rate-black-state' &&
        row.referencePeriod === '2020' &&
        row.observationId.includes('state:17') &&
        row.estimate === 922,
    ),
  );
  assert.ok(
    mass.observations.some(
      (row) =>
        row.metricId === 'imprisonment-rate-black-state' &&
        row.referencePeriod === '2022' &&
        row.observationId.includes('state:17'),
    ),
  );
  assert.match(mass.summary, /Table 6/);
  assert.match(mass.summary, /warehouse/);
  assert.match(mass.methodNote, /never silently merged|not merged|labeled apart|two labeled/i);
  assert.ok(
    mass.artifacts.some(
      (artifact) => artifact.artifactId === 'art_bjs_prisoners_2023_table6_adult_rates',
    ),
  );
  assert.ok(
    mass.artifacts.some(
      (artifact) => artifact.artifactId === 'art_bjs_prisoners_2020_tables_zip',
    ),
  );
});
