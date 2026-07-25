/**
 * Tests for `resolveEntityCrossReferences` / `resolveChapterEntityExits` (repo-cqey.8):
 * entities as connective tissue between chapters, unbound stories, and theme packets.
 * Uses the same test-only `deps` injection pattern as `resolveThemeSpine` so this suite
 * runs offline. Covers an entity with zero, one, and multiple cross-references, and asserts
 * every resolved href/label pair is a real, non-dead target.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  entityCrossReferenceHref,
  entityCrossReferenceLabel,
  resolveChapterEntityExits,
  resolveEntityCrossReferences,
} from './source.js';

const STORY_CHAPTER_ONE = {
  id: 'story-1',
  releaseId: 'rel-1',
  slug: 'chapter-one',
  title: 'Chapter One',
  dek: 'The first chapter.',
  publishedAt: '2026-01-01',
  eraLabel: 'HOLC era',
  placeLabel: 'Baltimore, MD',
  relatedEntityIds: ['ent_shared', 'ent_solo'],
  sources: [{ label: 'Test source', url: 'https://example.com' }],
  themeBinding: { themeId: 'redlining', chapterIndex: 1, chapterCount: 2 },
  body: [{ paragraphs: ['Paragraph one.'] }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const STORY_CHAPTER_TWO = {
  id: 'story-2',
  releaseId: 'rel-1',
  slug: 'chapter-two',
  title: 'Chapter Two',
  dek: 'The second chapter.',
  publishedAt: '2026-01-02',
  eraLabel: 'Fair housing era',
  placeLabel: 'Baltimore, MD',
  relatedEntityIds: ['ent_shared'],
  sources: [{ label: 'Test source', url: 'https://example.com' }],
  themeBinding: { themeId: 'urban_renewal', chapterIndex: 1, chapterCount: 1 },
  body: [{ paragraphs: ['Paragraph two.'] }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const STORY_UNBOUND = {
  id: 'story-unbound',
  releaseId: 'rel-1',
  slug: 'unbound-story',
  title: 'Unbound Story',
  dek: 'Not part of any theme spine.',
  publishedAt: '2026-01-03',
  eraLabel: 'Other era',
  placeLabel: 'Elsewhere',
  relatedEntityIds: ['ent_multi'],
  sources: [{ label: 'Test source', url: 'https://example.com' }],
  body: [{ paragraphs: ['Unrelated paragraph.'] }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const ALL_STORIES = [STORY_CHAPTER_ONE, STORY_CHAPTER_TWO, STORY_UNBOUND];

function packetView(themeId: string, questionId: string, entityId: string | undefined) {
  return {
    packetId: `tip_${questionId}`,
    questionId,
    themeId,
    question: `Question ${questionId}`,
    policyEras: [],
    geography: { unit: 'county', label: 'Baltimore city, MD' },
    methodStance: 'juxtaposition',
    methodNote: 'Fixture method note.',
    observationsSummary: 'Fixture summary.',
    observations: [],
    derived: [],
    artifacts: [],
    gapStates: [],
    ...(entityId ? { entityBinding: { entityId, purpose: 'story' } } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function stubbedStoryDeps() {
  return {
    listStories: async () => ({ data: ALL_STORIES, source: 'live' as const }),
  };
}

function stubbedPacketDeps(packetsByTheme: Record<string, readonly unknown[]>) {
  return {
    listPackets: async (themeId: string) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      packets: (packetsByTheme[themeId] ?? []) as any,
      source: 'fixture' as const,
    }),
    themeIds: Object.keys(packetsByTheme),
    getThemeTitle: (themeId: string) =>
      ({ redlining: 'Housing segregation & redlining', urban_renewal: 'Urban renewal' })[themeId],
  };
}

test('resolveEntityCrossReferences returns nothing for an entity with zero cross-references', async () => {
  const surfaces = await resolveEntityCrossReferences('ent_nobody', {
    ...stubbedStoryDeps(),
    ...stubbedPacketDeps({}),
  });
  assert.deepEqual(surfaces, []);
});

test('resolveEntityCrossReferences resolves a single cross-reference (one chapter)', async () => {
  const surfaces = await resolveEntityCrossReferences('ent_solo', {
    ...stubbedStoryDeps(),
    ...stubbedPacketDeps({}),
  });
  assert.equal(surfaces.length, 1);
  const [surface] = surfaces;
  assert.ok(surface);
  assert.equal(surface.kind, 'chapter');
  assert.equal(entityCrossReferenceHref(surface), '/themes/redlining#chapter-1');
  assert.equal(entityCrossReferenceLabel(surface), 'Housing segregation & redlining: Chapter One');
});

test('resolveEntityCrossReferences resolves multiple cross-references across chapters and packets', async () => {
  const surfaces = await resolveEntityCrossReferences('ent_shared', {
    ...stubbedStoryDeps(),
    ...stubbedPacketDeps({
      redlining: [packetView('redlining', 'Q1', 'ent_shared'), packetView('redlining', 'Q2', undefined)],
      urban_renewal: [],
    }),
  });

  // Chapter One + Chapter Two + one bound packet = 3 surfaces, all resolvable.
  assert.equal(surfaces.length, 3);
  const kinds = surfaces.map((surface) => surface.kind).sort();
  assert.deepEqual(kinds, ['chapter', 'chapter', 'theme_packet']);
  for (const surface of surfaces) {
    assert.match(entityCrossReferenceHref(surface), /^\/(themes|stories)\//);
    assert.ok(entityCrossReferenceLabel(surface).length > 0);
  }
});

test('resolveEntityCrossReferences resolves an unbound story as a plain "story" surface', async () => {
  const surfaces = await resolveEntityCrossReferences('ent_multi', {
    ...stubbedStoryDeps(),
    ...stubbedPacketDeps({}),
  });
  assert.equal(surfaces.length, 1);
  const [surface] = surfaces;
  assert.ok(surface);
  assert.equal(surface.kind, 'story');
  assert.equal(entityCrossReferenceHref(surface), '/stories/unbound-story');
});

test('resolveChapterEntityExits omits chapters with no other surface (0 cross-reference case)', async () => {
  const chapters = [{ story: STORY_UNBOUND, sections: [] }];
  const exits = await resolveChapterEntityExits(chapters, {
    resolveCrossReferences: async () => [],
    listEntities: async () => ({
      data: [{ id: 'ent_multi', displayName: 'Solo Place' }],
      source: 'live' as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  });
  assert.equal(exits.size, 0);
});

test('resolveChapterEntityExits renders one exit link when exactly one other surface exists', async () => {
  const chapters = [{ story: STORY_CHAPTER_ONE, sections: [] }];
  const exits = await resolveChapterEntityExits(chapters, {
    resolveCrossReferences: async (entityId: string) =>
      entityId === 'ent_shared'
        ? [
            {
              kind: 'chapter' as const,
              storyId: STORY_CHAPTER_ONE.id,
              storySlug: STORY_CHAPTER_ONE.slug,
              storyTitle: STORY_CHAPTER_ONE.title,
              themeId: 'redlining',
              themeTitle: 'Housing segregation & redlining',
              chapterIndex: 1,
            },
            {
              kind: 'chapter' as const,
              storyId: STORY_CHAPTER_TWO.id,
              storySlug: STORY_CHAPTER_TWO.slug,
              storyTitle: STORY_CHAPTER_TWO.title,
              themeId: 'urban_renewal',
              themeTitle: 'Urban renewal',
              chapterIndex: 1,
            },
          ]
        : [],
    listEntities: async () => ({
      data: [
        { id: 'ent_shared', displayName: '1114 Fourth Avenue' },
        { id: 'ent_solo', displayName: 'Solo Place' },
      ],
      source: 'live' as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  });

  const chapterOneExits = exits.get(STORY_CHAPTER_ONE.id) ?? [];
  assert.equal(chapterOneExits.length, 1);
  const [exit] = chapterOneExits;
  assert.ok(exit);
  assert.equal(exit.entityLabel, '1114 Fourth Avenue');
  assert.equal(exit.targetLabel, 'Urban renewal: Chapter Two');
  assert.equal(exit.href, '/themes/urban_renewal#chapter-1');
});

test('resolveChapterEntityExits renders multiple exit links when several entities have other surfaces', async () => {
  const chapters = [{ story: STORY_CHAPTER_ONE, sections: [] }];
  const otherChapterSurface = {
    kind: 'chapter' as const,
    storyId: STORY_CHAPTER_TWO.id,
    storySlug: STORY_CHAPTER_TWO.slug,
    storyTitle: STORY_CHAPTER_TWO.title,
    themeId: 'urban_renewal',
    themeTitle: 'Urban renewal',
    chapterIndex: 1,
  };
  const packetSurface = {
    kind: 'theme_packet' as const,
    themeId: 'redlining',
    themeTitle: 'Housing segregation & redlining',
    questionId: 'Q1',
    packetLabel: 'Beat Q1',
  };

  const exits = await resolveChapterEntityExits(chapters, {
    resolveCrossReferences: async (entityId: string) =>
      entityId === 'ent_shared' ? [otherChapterSurface] : entityId === 'ent_solo' ? [packetSurface] : [],
    listEntities: async () => ({
      data: [
        { id: 'ent_shared', displayName: '1114 Fourth Avenue' },
        { id: 'ent_solo', displayName: 'The Housing Authority' },
      ],
      source: 'live' as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  });

  const chapterOneExits = exits.get(STORY_CHAPTER_ONE.id) ?? [];
  assert.equal(chapterOneExits.length, 2);
  for (const exit of chapterOneExits) {
    assert.match(exit.href, /^\/themes\//);
    assert.ok(exit.targetLabel.length > 0);
  }
  const entityIds = chapterOneExits.map((exit) => exit.entityId).sort();
  assert.deepEqual(entityIds, ['ent_shared', 'ent_solo']);
});
