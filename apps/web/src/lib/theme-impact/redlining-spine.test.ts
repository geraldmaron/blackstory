/**
 * Pins the real redlining theme spine (repo-cqey.10): `resolveThemeSpine('redlining', ...)`
 * exercised via test-only dependency injection with the fixture chapters in
 * `redlining-spine.fixtures.ts` and the REAL published `redlining` packets from
 * `RESEARCHED_THEME_IMPACT_PACKETS` (not a synthetic stub packet). Every moment ref in the
 * fixture chapters must hydrate against real packet data with zero `console.warn` drops, and
 * the fixture stories must independently validate against `publicStoryProjectionSchema`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RESEARCHED_THEME_IMPACT_PACKETS, themeImpactPacketToView } from '@repo/domain';
import { publicStoryProjectionSchema } from '@repo/schemas';
import { REDLINING_SPINE_STORIES } from './redlining-spine.fixtures.js';
import { resolveThemeSpine } from './source.js';

const REDLINING_PACKET_VIEWS = RESEARCHED_THEME_IMPACT_PACKETS.filter(
  (packet) => packet.themeId === 'redlining',
).map((packet) => themeImpactPacketToView(packet, { dataSource: 'fixture' }));

function stubbedRealDeps() {
  return {
    listStories: async () => ({ data: REDLINING_SPINE_STORIES, source: 'live' as const }),
    listPackets: async (themeId: string) => ({
      packets: themeId === 'redlining' ? REDLINING_PACKET_VIEWS : [],
      source: 'fixture' as const,
    }),
  };
}

test('redlining spine fixture stories validate against publicStoryProjectionSchema', () => {
  for (const story of REDLINING_SPINE_STORIES) {
    const result = publicStoryProjectionSchema.safeParse(story);
    assert.ok(result.success, `${story.slug} failed schema validation: ${JSON.stringify(result.success ? null : result.error.issues)}`);
  }
});

test('resolveThemeSpine resolves a complete 3-chapter redlining spine against real packets with zero moment drops', async () => {
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  let spine;
  try {
    spine = await resolveThemeSpine('redlining', stubbedRealDeps());
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(warnings, [], 'expected zero dropped-moment warnings for the redlining spine');

  assert.equal(spine.theme, 'redlining');
  assert.equal(spine.chapters.length, 3);

  const slugsInOrder = spine.chapters.map((chapter) => chapter.story.slug);
  assert.deepEqual(slugsInOrder, [
    'before-the-maps',
    'spread-the-sheets',
    'the-county-still-holds-the-tape-measure',
  ]);

  spine.chapters.forEach((chapter, index) => {
    assert.equal(chapter.story.themeBinding?.chapterIndex, index + 1);
    assert.equal(chapter.story.themeBinding?.chapterCount, 3);
    assert.ok(chapter.story.eraLabel.length > 0);
    assert.ok(chapter.story.placeLabel.length > 0);
  });

  // Every chapter carries at least one moment that resolved with real hydrated data.
  for (const chapter of spine.chapters) {
    const allMoments = chapter.sections.flatMap((section) => section.moments);
    assert.ok(
      allMoments.length > 0,
      `expected chapter "${chapter.story.slug}" to have at least one resolved moment`,
    );
    for (const moment of allMoments) {
      // All authored moments in this fixture are observation/artifact/derived refs, which
      // hydrate to the 'data' branch of the HydratedThemeSpineMoment union.
      assert.equal(moment.kind, 'data');
      if (moment.kind !== 'data') continue;
      assert.ok(moment.figure.length > 0);
      assert.ok(moment.claim.length > 0);
      assert.ok(moment.provenance.source.length > 0);
      assert.ok(moment.provenance.capture.length > 0);
      assert.ok(moment.provenance.confidence.length > 0);
    }
  }

  // The total count of dropped-vs-authored moments matches: no ref silently disappeared.
  const authoredMomentCount = REDLINING_SPINE_STORIES.flatMap((story) =>
    story.body.flatMap((section) => section.moments ?? []),
  ).length;
  const resolvedMomentCount = spine.chapters
    .flatMap((chapter) => chapter.sections)
    .flatMap((section) => section.moments).length;
  assert.equal(resolvedMomentCount, authoredMomentCount);

  // At least one dispute renders, with both real, sourced sides present.
  const disputes = spine.chapters.flatMap((chapter) => chapter.sections.flatMap((s) => s.disputes));
  assert.ok(disputes.length >= 1);
  const [dispute] = disputes;
  assert.ok(dispute);
  assert.ok(dispute.sideA.sourceLabel.length > 0);
  assert.ok(dispute.sideA.claim.length > 0);
  assert.ok(dispute.sideB.sourceLabel.length > 0);
  assert.ok(dispute.sideB.claim.length > 0);
});

test('resolveThemeSpine drops nothing when the real redlining packets are queried directly (sanity: real refIds exist)', async () => {
  const q3 = REDLINING_PACKET_VIEWS.find((packet) => packet.questionId === 'Q3');
  assert.ok(q3, 'expected the real tip_chicago_redlining_q3 packet to be present');
  assert.ok(
    q3.observations.some(
      (o) => o.id === 'obs:hmda-denial-rate-gap-black-white-county:county:17031:2018',
    ),
  );
  assert.ok(q3.derived.some((d) => d.id === 'der_cook_income_gap_2020_2024'));

  const q4 = REDLINING_PACKET_VIEWS.find((packet) => packet.questionId === 'Q4');
  assert.ok(q4, 'expected the real tip_chicago_redlining_q4 packet to be present');
  assert.ok(q4.derived.some((d) => d.id === 'der_cook_homeownership_gap_2010'));
  assert.ok(q4.derived.some((d) => d.id === 'der_cook_cost_burden_gap_2017_2021'));
});
