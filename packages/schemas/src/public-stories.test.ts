/**
 * Tests for the public Story projection schema and citation-integrity checks.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertStoryCitationIntegrity,
  collectStoryCitationIssues,
  extractInlineCitationIds,
  parseStoryVideoUrl,
  storyVideoSource,
  publicStoryProjectionSchema,
  type PublicStoryProjectionDoc,
} from './public-stories.ts';

const baseStory: PublicStoryProjectionDoc = {
  id: 'story-1',
  releaseId: 'release-1',
  slug: 'buying-a-home',
  title: 'Buying a Home',
  summary: 'A century of the rules that governed who could own a home.',
  publishedAt: '2026-07-26',
  eraLabel: '1919–present',
  placeLabel: 'Chicago, IL',
  themeId: 'redlining',
  body: [
    { type: 'heading', level: 2 as const, text: '1938' },
    {
      type: 'paragraph',
      text: 'The underwriting manual is explicit about race [ref:fha-manual-1938].',
    },
    { type: 'figure', packetId: 'redlining-q3', caption: 'Homeownership by race, Cook County.' },
  ],
  references: [
    {
      id: 'fha-manual-1938',
      label: 'FHA Underwriting Manual (1938)',
      url: 'https://example.org/fha-1938',
      locator: '§937',
    },
  ],
  relatedEntityIds: ['entity-1'],
};

test('valid story passes the projection schema', () => {
  const parsed = publicStoryProjectionSchema.parse(baseStory);
  assert.equal(parsed.slug, 'buying-a-home');
  assert.equal(parsed.body.length, 3);
});

test('stat/figure/pullquote blocks accept an optional anchors + replicationVerified declaration', () => {
  const parsed = publicStoryProjectionSchema.parse({
    ...baseStory,
    body: [
      ...baseStory.body,
      {
        type: 'stat',
        packetId: 'redlining-q3',
        kind: 'observation',
        refId: 'obs-1',
        anchors: [
          { url: 'https://census.gov/a', label: 'Census' },
          { url: 'https://www.federalreserve.gov/b', label: 'Fed' },
        ],
      },
      {
        type: 'pullquote',
        text: 'A verified figure.',
        anchors: [{ url: 'https://census.gov/a', label: 'Census' }],
        replicationVerified: true,
      },
    ],
  });
  assert.equal(parsed.body.length, 5);
});

test('a block with no anchors field still parses (opt-in, not retroactive)', () => {
  const parsed = publicStoryProjectionSchema.parse(baseStory);
  const figure = parsed.body.find((block) => block.type === 'figure');
  assert.ok(figure);
  assert.equal((figure as { anchors?: unknown }).anchors, undefined);
});

test('extractInlineCitationIds finds distinct marker ids', () => {
  const ids = extractInlineCitationIds('a [ref:one] b [ref:two] c [ref:one]');
  assert.deepEqual([...ids].sort(), ['one', 'two']);
});

test('citation integrity passes when markers and references agree', () => {
  assert.doesNotThrow(() => assertStoryCitationIntegrity(baseStory));
});

test('unknown inline reference is reported', () => {
  const issues = collectStoryCitationIssues({
    body: [{ type: 'paragraph' as const, text: 'Missing [ref:nope].' }],
    references: [],
  });
  assert.deepEqual(issues, [{ kind: 'unknown_reference', refId: 'nope' }]);
});

test('unused reference is reported unless data-backed', () => {
  const story = {
    body: [{ type: 'paragraph' as const, text: 'No citations here.' }],
    references: [{ id: 'orphan', label: 'Orphan Source', url: 'https://example.org/x' }],
  };
  assert.deepEqual(collectStoryCitationIssues(story), [
    { kind: 'unused_reference', refId: 'orphan' },
  ]);
  // A reference attached to a data block counts as used.
  assert.deepEqual(collectStoryCitationIssues(story, ['orphan']), []);
});

test('table, video and divider blocks validate; cross-field rules reject bad ones', () => {
  const ok = [
    {
      type: 'table',
      caption: 'c',
      rows: [
        ['a', 'b'],
        ['', '[ref:fha-manual-1938]'],
      ],
    },
    {
      type: 'video',
      provider: 'youtube',
      videoId: 'dQw4w9WgXcQ',
      title: 't',
      credit: 'c',
      rightsStatus: 'licensed',
    },
    { type: 'divider' },
  ];
  const parse = (body: unknown[]) =>
    publicStoryProjectionSchema.safeParse({ ...baseStory, body: [...baseStory.body, ...body] });
  assert.equal(parse(ok).success, true);
  assert.equal(parse([{ type: 'table', caption: 'c', rows: [['a'], ['a', 'b']] }]).success, false);
  const video = { type: 'video', title: 't', credit: 'c', rightsStatus: 'licensed' };
  assert.equal(parse([{ ...video, provider: 'youtube', videoId: 'short' }]).success, false);
  assert.equal(
    parse([{ ...video, provider: 'loc', videoId: 'storage-services/a/b.mp4' }]).success,
    true,
  );
});

test('citations in table cells and captions count, and unknown ones are reported', () => {
  const issues = collectStoryCitationIssues({
    references: baseStory.references,
    body: [
      { type: 'table', caption: 'x [ref:nope]', header: true, rows: [['[ref:fha-manual-1938]']] },
    ],
  });
  assert.deepEqual(issues, [{ kind: 'unknown_reference', refId: 'nope' }]);
});

test('storyVideoSource and parseStoryVideoUrl', () => {
  assert.deepEqual(storyVideoSource({ provider: 'youtube', videoId: 'dQw4w9WgXcQ' }), {
    kind: 'iframe',
    src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  });
  assert.equal(
    storyVideoSource({ provider: 'vimeo', videoId: '123456789' }).src,
    'https://player.vimeo.com/video/123456789?dnt=1',
  );
  assert.equal(
    storyVideoSource({ provider: 'archive', videoId: 'abc.def' }).src,
    'https://archive.org/embed/abc.def',
  );
  assert.deepEqual(storyVideoSource({ provider: 'loc', videoId: 'storage-services/x/y.mp4' }), {
    kind: 'file',
    src: 'https://tile.loc.gov/storage-services/x/y.mp4',
  });
  const yt = { provider: 'youtube', videoId: 'dQw4w9WgXcQ' };
  const cases: [string, unknown][] = [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3', yt],
    ['https://youtu.be/dQw4w9WgXcQ', yt],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', yt],
    ['https://vimeo.com/123456789', { provider: 'vimeo', videoId: '123456789' }],
    ['https://archive.org/details/some_item-1', { provider: 'archive', videoId: 'some_item-1' }],
    ['https://archive.org/embed/some_item-1', { provider: 'archive', videoId: 'some_item-1' }],
    [
      'https://tile.loc.gov/storage-services/a/b.mp4',
      { provider: 'loc', videoId: 'storage-services/a/b.mp4' },
    ],
    ['http://youtu.be/dQw4w9WgXcQ', null],
    ['https://youtube.com/watch?v=short', null],
    ['https://example.org/watch?v=dQw4w9WgXcQ', null],
    ['not a url', null],
  ];
  for (const [url, want] of cases) assert.deepEqual(parseStoryVideoUrl(url), want, url);
});
