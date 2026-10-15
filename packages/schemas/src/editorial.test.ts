import test from 'node:test';
import assert from 'node:assert/strict';
import { articleDraftSchema, editorialContributorMutationSchema } from './editorial.js';
import { publicArticleProjectionSchema } from './public-articles.js';
const base = {
  id: 'draft',
  slug: 'working-draft',
  title: '',
  summary: '',
  eraLabel: '',
  placeLabel: '',
  publishedAt: '2026-10-14',
  kind: 'article',
  tags: [],
  relatedEntityIds: [],
  contributors: [],
  references: [{ id: 'source-1', label: '', url: 'unfinished' }],
};
test('unfinished typed fields survive draft persistence but fail publication', () => {
  const blocks = [
    { type: 'paragraph', text: '' },
    { type: 'heading', level: 2, text: '' },
    { type: 'list', style: 'bullet', items: [] },
    { type: 'pullquote', text: '', anchors: [] },
    { type: 'figure', packetId: '', caption: '', anchors: [] },
    { type: 'stat', packetId: '', kind: 'observation', refId: '' },
    { type: 'primaryDocument', packetId: '', refId: '' },
    { type: 'timeline', packetId: '' },
    { type: 'mapInset', entityId: '' },
    {
      type: 'dispute',
      label: '',
      sideA: { sourceLabel: '', claim: '' },
      sideB: { sourceLabel: '', claim: '' },
    },
    { type: 'image', image: { url: '', alt: '', credit: '', rightsStatus: 'public_domain' } },
  ];
  const draft = articleDraftSchema.parse({ ...base, body: blocks });
  assert.deepEqual(draft.body, blocks);
  assert.equal(draft.references[0]!.url, 'unfinished');
  assert.equal(
    publicArticleProjectionSchema.safeParse({ ...draft, releaseId: 'preview' }).success,
    false,
  );
  assert.equal(
    articleDraftSchema.safeParse({
      ...base,
      body: [{ type: 'html', html: '<script>alert(1)</script>' }],
    }).success,
    false,
  );
});
test('public contributor snapshots contain roles and no account identifiers', () => {
  const parsed = publicArticleProjectionSchema.parse({
    ...base,
    releaseId: 'test',
    title: 'A title',
    summary: 'A summary',
    eraLabel: 'A period',
    placeLabel: 'A place',
    body: [{ type: 'paragraph', text: 'A paragraph' }],
    references: [],
    contributors: [
      {
        id: 'gerald-dagher',
        name: 'Gerald Dagher',
        kind: 'person',
        roles: ['author'],
        userId: 'private',
      },
      { id: 'neo', name: 'Neo', kind: 'editorial', roles: ['author', 'editor'] },
    ],
  });
  assert.deepEqual(
    parsed.contributors.map((c) => c.name),
    ['Gerald Dagher', 'Neo'],
  );
  assert.equal('userId' in parsed.contributors[0]!, false);
});

test('contributor mutations reject coercible account-link flags and invalid biographies', () => {
  const profile = { id: 'gerald-dagher', name: 'Gerald Dagher', kind: 'person', biography: '' };
  assert.equal(
    editorialContributorMutationSchema.safeParse({ ...profile, linkToMe: 'false' }).success,
    false,
  );
  assert.equal(
    editorialContributorMutationSchema.safeParse({ ...profile, biography: 123 }).success,
    false,
  );
  assert.equal(
    editorialContributorMutationSchema.safeParse({ ...profile, linkToMe: true }).success,
    true,
  );
});
