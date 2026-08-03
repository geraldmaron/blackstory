/**
 * Content tests for the researched packet authoring fixture. These pins moved
 * here with the fixture itself; the database is the runtime source of truth and
 * scripts/theme-packets.ts audit guards release drift.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertThemeImpactPacketPublishable } from '@repo/domain';
import {
  RESEARCHED_THEME_IMPACT_PACKETS,
  THEME_RESEARCH_ADJUDICATION,
} from './researched-packets.ts';

test('researched catalog publishes exactly one packet for every substantive question', () => {
  const questionIds = RESEARCHED_THEME_IMPACT_PACKETS.map((packet) => packet.questionId);
  assert.deepEqual([...questionIds].sort(), [
    'Q1',
    'Q11',
    'Q12',
    'Q2',
    'Q3',
    'Q4',
    'Q5',
    'Q6',
    'Q7',
    'Q8',
    'Q9',
  ]);
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
  const packetThemeIds = new Set(RESEARCHED_THEME_IMPACT_PACKETS.map((packet) => packet.themeId));
  const adjudicatedThemeIds = new Set(THEME_RESEARCH_ADJUDICATION.map((row) => row.themeId));
  assert.deepEqual(adjudicatedThemeIds, packetThemeIds);
  assert.equal(adjudicatedThemeIds.size, 7);
  assert.ok(THEME_RESEARCH_ADJUDICATION.every((row) => row.rationale.trim().length >= 80));
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
    (row) => row.metricId === 'cps-a1-turnout-black-nation' && row.referencePeriod === '2012',
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
      row.metricId === 'bjs-imprisonment-rate-black-nation' && row.referencePeriod === '2022',
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
    mass.artifacts.some((artifact) => artifact.artifactId === 'art_bjs_prisoners_2020_tables_zip'),
  );
});
