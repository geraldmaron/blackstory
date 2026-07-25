/**
 * Tests for `resolveThemeSpine` — theme-bound story chapters hydrated with theme-impact
 * "moments" and disputes. Uses `resolveThemeSpine`'s test-only `deps` injection to stub the
 * story reader and theme-impact packet reader so this suite runs offline and covers the happy
 * path, a dropped-moment degrade, and an empty spine.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveThemeSpine } from './source.js';

const STORIES = [
  {
    id: 'story-1',
    releaseId: 'rel-1',
    slug: 'chapter-one',
    title: 'Chapter One',
    dek: 'The first chapter.',
    publishedAt: '2026-01-01',
    eraLabel: 'HOLC era',
    placeLabel: 'Baltimore, MD',
    relatedEntityIds: ['ent_1'],
    sources: [{ label: 'Test source', url: 'https://example.com' }],
    themeBinding: { themeId: 'redlining', chapterIndex: 1, chapterCount: 2 },
    body: [
      {
        heading: 'Opening',
        paragraphs: ['Paragraph one.'],
        moments: [
          { packetId: 'tip_1', kind: 'observation', refId: 'obs_1', placement: 'after' },
          // References an unknown packet — should be dropped, not thrown.
          { packetId: 'tip_missing', kind: 'observation', refId: 'obs_x', placement: 'after' },
          // References a real packet but an unknown refId — also dropped.
          { packetId: 'tip_1', kind: 'artifact', refId: 'art_missing', placement: 'after' },
        ],
        disputes: [
          {
            label: 'Contested count',
            sideA: { sourceLabel: 'County record', claim: 'Twelve families displaced.' },
            sideB: { sourceLabel: 'Oral history', claim: 'Closer to twenty families.' },
          },
        ],
      },
    ],
  },
  {
    id: 'story-2',
    releaseId: 'rel-1',
    slug: 'chapter-two',
    title: 'Chapter Two',
    dek: 'The second chapter.',
    publishedAt: '2026-01-02',
    eraLabel: 'Fair housing era',
    placeLabel: 'Baltimore, MD',
    relatedEntityIds: ['ent_2'],
    sources: [{ label: 'Test source', url: 'https://example.com' }],
    themeBinding: { themeId: 'redlining', chapterIndex: 0, chapterCount: 2 },
    body: [{ paragraphs: ['Paragraph two.'] }],
  },
  {
    id: 'story-unbound',
    releaseId: 'rel-1',
    slug: 'unbound-story',
    title: 'Unbound Story',
    dek: 'Not part of any theme spine.',
    publishedAt: '2026-01-03',
    eraLabel: 'Other era',
    placeLabel: 'Elsewhere',
    relatedEntityIds: ['ent_3'],
    sources: [{ label: 'Test source', url: 'https://example.com' }],
    body: [{ paragraphs: ['Unrelated paragraph.'] }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

const PACKET_VIEW = {
  packetId: 'tip_1',
  questionId: 'Q1',
  themeId: 'redlining',
  question: 'How did HOLC grading affect homeownership?',
  policyEras: [],
  geography: { unit: 'county', label: 'Baltimore city, MD' },
  methodStance: 'juxtaposition',
  methodNote: 'Fixture method note.',
  observationsSummary: 'Fixture summary.',
  observations: [
    {
      id: 'obs_1',
      metricId: 'acs-homeownership-rate-black-county',
      label: 'Black homeownership rate',
      value: '42.1%',
      referencePeriod: '2018-2022',
      provenance: {
        source: 'ACS 5-Year',
        source_url: 'https://example.com/acs',
        retrieved_at: '2026-07-22',
        content_hash: 'sha256:fixture',
        humanCitation: 'U.S. Census Bureau ACS (fixture).',
      },
    },
  ],
  derived: [],
  artifacts: [],
  gapStates: [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

function stubbedDeps(themeId: string) {
  return {
    listStories: async () => ({ data: STORIES, source: 'live' as const }),
    listPackets: async (queriedThemeId: string) => ({
      packets: queriedThemeId === themeId ? [PACKET_VIEW] : [],
      source: 'fixture' as const,
    }),
  };
}

test('resolveThemeSpine resolves bound chapters in chapterIndex order with hydrated moments', async () => {
  const spine = await resolveThemeSpine('redlining', stubbedDeps('redlining'));

  assert.equal(spine.theme, 'redlining');
  assert.equal(spine.chapters.length, 2);
  // chapterIndex 0 (Chapter Two) comes before chapterIndex 1 (Chapter One).
  assert.equal(spine.chapters[0]?.story.slug, 'chapter-two');
  assert.equal(spine.chapters[1]?.story.slug, 'chapter-one');

  const [firstSection] = spine.chapters[1]?.sections ?? [];
  assert.ok(firstSection);
  assert.equal(firstSection.heading, 'Opening');
  assert.equal(firstSection.paragraphs[0], 'Paragraph one.');

  // Only the one valid moment survives; the two bad refs are dropped silently.
  assert.equal(firstSection.moments.length, 1);
  const moment = firstSection.moments[0];
  assert.ok(moment);
  if (moment.kind !== 'data') throw new Error('expected a data moment');
  assert.equal(moment.figure, '42.1%');
  assert.equal(moment.claim, 'Black homeownership rate');
  assert.equal(moment.provenance.source, 'ACS 5-Year');
  assert.equal(moment.provenance.capture, '2026-07-22');
  assert.equal(moment.methodStance, 'juxtaposition');

  assert.equal(firstSection.disputes.length, 1);
  assert.equal(firstSection.disputes[0]?.label, 'Contested count');
});

test('resolveThemeSpine drops a moment with a missing packet ref instead of throwing', async () => {
  const spine = await resolveThemeSpine('redlining', stubbedDeps('redlining'));
  const chapterOne = spine.chapters.find((chapter) => chapter.story.slug === 'chapter-one');
  assert.ok(chapterOne);
  const moments = chapterOne.sections[0]?.moments ?? [];
  assert.equal(moments.length, 1);
  assert.ok(moments.every((m) => m.kind === 'data' && typeof m.figure === 'string'));
});

test('resolveThemeSpine returns an empty chapter list for a theme with no bound chapters', async () => {
  const spine = await resolveThemeSpine('no-such-theme', stubbedDeps('no-such-theme'));
  assert.equal(spine.theme, 'no-such-theme');
  assert.deepEqual(spine.chapters, []);
});

const TIMELINE_MAP_PACKET_VIEW = {
  ...PACKET_VIEW,
  policyEras: [{ id: 'holc_fha', label: 'HOLC / FHA era', span: '1933-1968' }],
  artifacts: [
    {
      id: 'art_holc_map',
      title: 'HOLC residential security map',
      artifactClass: 'map',
      dateLabel: '1937',
      summary: 'The original HOLC grading map.',
    },
    {
      id: 'art_fha_manual',
      title: 'FHA underwriting manual',
      artifactClass: 'document',
      dateLabel: '1934',
      summary: 'Underwriting guidance excerpt.',
    },
    // No dateLabel — excluded from the timeline.
    { id: 'art_undated', title: 'Undated clipping', artifactClass: 'article', summary: 'n/a' },
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const TIMELINE_MAP_STORIES = [
  {
    id: 'story-tm',
    releaseId: 'rel-1',
    slug: 'chapter-tm',
    title: 'Chapter TM',
    dek: 'Timeline and map moments.',
    publishedAt: '2026-01-01',
    eraLabel: 'HOLC era',
    placeLabel: 'Baltimore, MD',
    relatedEntityIds: ['ent_church'],
    sources: [{ label: 'Test source', url: 'https://example.com' }],
    themeBinding: { themeId: 'redlining', chapterIndex: 1, chapterCount: 1 },
    body: [
      {
        heading: 'Opening',
        paragraphs: ['Paragraph one.'],
        moments: [
          { packetId: 'tip_1', kind: 'timeline', refId: 'event_timeline', placement: 'after' },
          { packetId: 'tip_1', kind: 'map', refId: 'ent_church', placement: 'after' },
          // Unknown entity refId — dropped, not thrown.
          { packetId: 'tip_1', kind: 'map', refId: 'ent_missing', placement: 'after' },
        ],
      },
    ],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

function timelineMapDeps() {
  return {
    listStories: async () => ({ data: TIMELINE_MAP_STORIES, source: 'live' as const }),
    listPackets: async () => ({ packets: [TIMELINE_MAP_PACKET_VIEW], source: 'fixture' as const }),
    listEntities: async (ids: readonly string[]) => ({
      data: ids
        .filter((id) => id === 'ent_church')
        .map((id) => ({
          id,
          displayName: 'Fifteenth Street Presbyterian Church',
          geoAnchor: { lat: 38.9047, lng: -77.0163, geohash: 'dqcjr', matchMethod: 'manual' },
          locationPrecision: 'neighborhood' as const,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        })) as any,
      source: 'live' as const,
    }),
  };
}

test('resolveThemeSpine hydrates a timeline moment from dated artifacts + policy eras', async () => {
  const spine = await resolveThemeSpine('redlining', timelineMapDeps());
  const section = spine.chapters[0]?.sections[0];
  assert.ok(section);
  const timeline = section.moments.find((m) => m.kind === 'timeline');
  assert.ok(timeline);
  if (timeline.kind !== 'timeline') throw new Error('expected a timeline moment');
  assert.deepEqual(
    timeline.events.map((e) => e.date),
    ['1934', '1937'],
  );
  assert.equal(timeline.policyEras[0]?.id, 'holc_fha');
});

test('resolveThemeSpine hydrates a map moment from the entity geo anchor and drops unknown refs', async () => {
  const spine = await resolveThemeSpine('redlining', timelineMapDeps());
  const section = spine.chapters[0]?.sections[0];
  assert.ok(section);
  const mapMoments = section.moments.filter((m) => m.kind === 'map');
  assert.equal(mapMoments.length, 1);
  const mapMoment = mapMoments[0];
  assert.ok(mapMoment);
  if (mapMoment.kind !== 'map') throw new Error('expected a map moment');
  assert.equal(mapMoment.entityId, 'ent_church');
  assert.equal(mapMoment.label, 'Fifteenth Street Presbyterian Church');
  assert.equal(mapMoment.lat, 38.9047);
  assert.equal(mapMoment.precision, 'neighborhood');
});
