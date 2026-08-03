/**
 * Tests for the public Article projection schema and citation-integrity checks.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertArticleCitationIntegrity,
  collectArticleCitationIssues,
  extractInlineCitationIds,
  publicArticleProjectionSchema,
  type PublicArticleProjectionDoc,
} from './public-articles.ts';

const baseArticle: PublicArticleProjectionDoc = {
  id: 'article-1',
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

test('valid article passes the projection schema', () => {
  const parsed = publicArticleProjectionSchema.parse(baseArticle);
  assert.equal(parsed.slug, 'buying-a-home');
  assert.equal(parsed.body.length, 3);
});

test('stat/figure/pullquote blocks accept an optional anchors + replicationVerified declaration', () => {
  const parsed = publicArticleProjectionSchema.parse({
    ...baseArticle,
    body: [
      ...baseArticle.body,
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
  const parsed = publicArticleProjectionSchema.parse(baseArticle);
  const figure = parsed.body.find((block) => block.type === 'figure');
  assert.ok(figure);
  assert.equal((figure as { anchors?: unknown }).anchors, undefined);
});

test('extractInlineCitationIds finds distinct marker ids', () => {
  const ids = extractInlineCitationIds('a [ref:one] b [ref:two] c [ref:one]');
  assert.deepEqual([...ids].sort(), ['one', 'two']);
});

test('citation integrity passes when markers and references agree', () => {
  assert.doesNotThrow(() => assertArticleCitationIntegrity(baseArticle));
});

test('unknown inline reference is reported', () => {
  const issues = collectArticleCitationIssues({
    body: [{ type: 'paragraph' as const, text: 'Missing [ref:nope].' }],
    references: [],
  });
  assert.deepEqual(issues, [{ kind: 'unknown_reference', refId: 'nope' }]);
});

test('unused reference is reported unless data-backed', () => {
  const article = {
    body: [{ type: 'paragraph' as const, text: 'No citations here.' }],
    references: [{ id: 'orphan', label: 'Orphan Source', url: 'https://example.org/x' }],
  };
  assert.deepEqual(collectArticleCitationIssues(article), [
    { kind: 'unused_reference', refId: 'orphan' },
  ]);
  // A reference attached to a data block counts as used.
  assert.deepEqual(collectArticleCitationIssues(article, ['orphan']), []);
});
