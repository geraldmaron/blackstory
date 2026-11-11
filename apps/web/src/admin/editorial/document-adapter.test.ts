import test from 'node:test';
import assert from 'node:assert/strict';
import type { JSONContent } from '@tiptap/core';
import type { StoryBodyBlockDoc } from '@repo/schemas';
import { storyToDocument, documentToStory } from './document-adapter';
test('the story editor round-trips every body type with exact citation and evidence attributes', () => {
  const body: StoryBodyBlockDoc[] = [
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
      type: 'table',
      caption: 'Counts by **year** [ref:one]',
      header: true,
      rows: [
        ['Year', 'Count'],
        ['1950', 'About _40_ [[ent_a|A]]'],
      ],
    },
    {
      type: 'table',
      caption: 'No header',
      header: false,
      rows: [
        ['a', ''],
        ['', 'b'],
      ],
    },
    {
      type: 'video',
      provider: 'youtube',
      videoId: 'dQw4w9WgXcQ',
      title: 'Interview',
      credit: 'Archive',
      rightsStatus: 'licensed',
      caption: 'Recorded in **1963**',
    },
    { type: 'divider' },
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
  assert.deepEqual(documentToStory(storyToDocument(body)), body);
});
test('new paragraphs preserve citation tokens and unsupported document structures fail visibly', () => {
  const doc = storyToDocument([{ type: 'paragraph', text: 'Before [ref:source] after' }]);
  doc.content![0]!.content!.push({ type: 'text', text: ' more' });
  assert.equal(
    (documentToStory(doc)[0] as { text: string }).text,
    'Before [ref:source] after more',
  );
  assert.throws(
    () => documentToStory({ type: 'doc', content: [{ type: 'table' }] }),
    /Unsupported/,
  );
  assert.deepEqual(documentToStory({ type: 'doc', content: [{ type: 'paragraph' }] }), []);
});
test('entity links become inline atoms and serialize back to the stored markup', () => {
  const text = 'Born in [[ent_ada|Ada Lovelace]] and raised near [[ent_place]] [ref:one].';
  const doc = storyToDocument([{ type: 'paragraph', text }]);
  const nodes = doc.content![0]!.content!;
  assert.deepEqual(
    nodes.filter((node) => node.type === 'entityLink').map((node) => node.attrs),
    [
      { entityId: 'ent_ada', label: 'Ada Lovelace' },
      { entityId: 'ent_place', label: '' },
    ],
  );
  assert.equal((documentToStory(doc)[0] as { text: string }).text, text);
});
test('half-typed or nested brackets stay plain text and never become links', () => {
  const text = 'A [[unfinished link and [[[nested]]] brackets';
  const doc = storyToDocument([{ type: 'paragraph', text }]);
  assert.equal(
    doc.content![0]!.content!.some((node) => node.type === 'entityLink' && !node.attrs?.entityId),
    false,
  );
  assert.equal((documentToStory(doc)[0] as { text: string }).text, text);
});
/** A document as the editor holds it for newly typed blocks: no remembered original text. */
function fresh(body: StoryBodyBlockDoc[]): JSONContent {
  const strip = (node: JSONContent): JSONContent => {
    const { attrs, content, ...rest } = node;
    const keep = attrs
      ? Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'storyBlock'))
      : undefined;
    return {
      ...rest,
      ...(keep && Object.keys(keep).length ? { attrs: keep } : {}),
      ...(content ? { content: content.map(strip) } : {}),
    };
  };
  const doc = storyToDocument(body);
  return { ...doc, content: doc.content!.map(strip) };
}
const proseOf = (text: string) =>
  (documentToStory(fresh([{ type: 'paragraph', text }]))[0] as { text: string }).text;
const textOf = (doc: JSONContent) => (documentToStory(doc)[0] as { text: string }).text;

test('canonical inline markup survives a rebuild from nothing but the document', () => {
  for (const text of [
    'Plain words',
    'A **bold** and _italic_ and **_both_** word',
    '**bold with _italic_ inside** done',
    'Mark atoms **[[ent_a|Ada]]** and _[ref:one]_',
    'Read [the archive](https://www.loc.gov/item/1) now',
    'A **[link in bold](https://example.org/a)** here',
    'Plain \\ * _ characters stay as typed',
    'Literal \\*\\*not bold\\*\\* and \\[ref:x\\] stay literal',
    'Line one\nline two **bold\nacross**',
  ]) {
    assert.equal(proseOf(text), text, text);
  }
});

test('a block the writer did not touch keeps its stored string, even if non-canonical', () => {
  const body: StoryBodyBlockDoc[] = [
    {
      type: 'paragraph',
      text: 'Odd [**x**](https://example.org/a) and [ [[ent_a|A]] ](https://example.org/b)',
    },
  ];
  assert.deepEqual(documentToStory(storyToDocument(body)), body);
});

test('whitespace at the edge of emphasis moves outside it instead of breaking the markup', () => {
  const doc = fresh([{ type: 'paragraph', text: 'x' }]);
  doc.content![0]!.content = [
    { type: 'text', text: 'Say ' },
    { type: 'text', text: ' loud ', marks: [{ type: 'bold' }] },
    { type: 'text', text: 'now' },
  ];
  assert.equal(textOf(doc), 'Say  **loud** now');
});

test('a non-https link loses the link, keeps the words and says so', () => {
  const doc = fresh([{ type: 'paragraph', text: 'x' }]);
  doc.content![0]!.content = [
    {
      type: 'text',
      text: 'site',
      marks: [{ type: 'link', attrs: { href: 'http://example.org' } }],
    },
  ];
  const warnings: string[] = [];
  const out = documentToStory(doc, (m) => warnings.push(m));
  assert.equal((out[0] as { text: string }).text, 'site');
  assert.match(warnings[0]!, /https/);
});

test('italics the grammar cannot express inside a word are dropped with a warning, never the text', () => {
  const doc = fresh([{ type: 'paragraph', text: 'x' }]);
  doc.content![0]!.content = [
    { type: 'text', text: 'un' },
    { type: 'text', text: 'believ', marks: [{ type: 'italic' }] },
    { type: 'text', text: 'able' },
  ];
  const warnings: string[] = [];
  const out = documentToStory(doc, (m) => warnings.push(m));
  assert.equal((out[0] as { text: string }).text, 'unbelievable');
  assert.equal(warnings.length, 1);
});

test('tables rebuild from the document: header row, padded merged cells, caption', () => {
  const doc = fresh([
    {
      type: 'table',
      caption: 'Cap',
      header: true,
      rows: [
        ['a', 'b'],
        ['c', 'd'],
      ],
    },
  ]);
  const rows = doc.content![0]!.content![0]!.content!;
  rows[1]!.content![0]!.attrs = { colspan: 2 };
  rows[1]!.content!.pop();
  assert.deepEqual(documentToStory(doc), [
    {
      type: 'table',
      caption: 'Cap',
      header: true,
      rows: [
        ['a', 'b'],
        ['c', ''],
      ],
    },
  ]);
  rows[0]!.content![1]!.type = 'tableCell';
  assert.equal((documentToStory(doc)[0] as { header: boolean }).header, false);
});

test('a video card still being filled in is kept as a draft block', () => {
  const body: StoryBodyBlockDoc[] = [
    {
      type: 'video',
      provider: 'youtube',
      videoId: '',
      title: '',
      credit: '',
      rightsStatus: 'licensed',
    },
    { type: 'paragraph', text: 'After' },
  ];
  assert.deepEqual(documentToStory(storyToDocument(body)), body);
});
