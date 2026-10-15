import test from 'node:test';
import assert from 'node:assert/strict';
import type { ArticleBodyBlockDoc } from '@repo/schemas';
import { articleToDocument, documentToArticle } from './document-adapter';
test('the article editor round-trips every body type with exact citation and evidence attributes', () => {
  const body: ArticleBodyBlockDoc[] = [
    { type: 'paragraph', text: 'Named work [ref:source-1]\n[[entity-id|A person]]' },
    { type: 'heading', level: 2, text: 'Section' },
    { type: 'list', style: 'number', items: ['First [ref:one]', 'Second\ncontinued'] },
    {
      type: 'pullquote',
      text: 'Exact quotation [ref:quote]',
      attribution: 'Named source',
      anchors: [
        {
          url: 'https://www.loc.gov/',
          label: 'Archive',
          claimId: 'claim',
          claimVersionId: 'version',
          selectorId: 'selector',
        },
      ],
      replicationVerified: false,
    },
    { type: 'figure', packetId: 'packet', metricIds: ['metric'], caption: 'Figure', anchors: [] },
    {
      type: 'stat',
      packetId: 'packet',
      refId: 'observation',
      kind: 'observation',
      caption: 'Result',
    },
    { type: 'primaryDocument', packetId: 'packet', refId: 'document', quote: 'An excerpt' },
    { type: 'timeline', packetId: 'packet' },
    { type: 'mapInset', entityId: 'entity', label: 'Place' },
    {
      type: 'dispute',
      label: 'Disagreement',
      sideA: { sourceLabel: 'One', claim: 'First account' },
      sideB: { sourceLabel: 'Two', claim: 'Second account' },
    },
    {
      type: 'image',
      image: {
        url: 'https://example.test/image.png',
        alt: 'Documentary image',
        credit: 'Archive',
        rightsStatus: 'licensed',
        objectPath: 'original',
        width: 800,
        height: 600,
      },
      caption: 'Image caption',
    },
  ];
  assert.deepEqual(documentToArticle(articleToDocument(body)), body);
});
test('new paragraphs preserve citation tokens and unsupported document structures fail visibly', () => {
  const doc = articleToDocument([{ type: 'paragraph', text: 'Before [ref:source] after' }]);
  doc.content![0]!.content!.push({ type: 'text', text: ' more' });
  assert.equal(
    (documentToArticle(doc)[0] as { text: string }).text,
    'Before [ref:source] after more',
  );
  assert.throws(
    () => documentToArticle({ type: 'doc', content: [{ type: 'table' }] }),
    /Unsupported/,
  );
  assert.deepEqual(documentToArticle({ type: 'doc', content: [{ type: 'paragraph' }] }), []);
});
