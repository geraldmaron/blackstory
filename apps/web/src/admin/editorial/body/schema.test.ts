import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import ListItem from '@tiptap/extension-list-item';
import type { StoryBodyBlockDoc } from '@repo/schemas';
import { documentToStory, storyToDocument } from '../document-adapter';
import {
  Citation,
  EntityLink,
  EvidenceBlock,
  PlainHeading,
  PreserveBlock,
  StoryTable,
  StoryTableCaption,
  StoryTableCell,
  StoryTableHeader,
  StoryTableNode,
  StoryTableRow,
  StoryVideo,
} from './extensions';

// The real editor schema, built without a DOM: what a story must survive to open and save.
const schema = getSchema([
  StarterKit.configure({
    strike: false,
    underline: false,
    code: false,
    codeBlock: false,
    listItem: false,
    heading: false,
  }),
  ListItem.extend({ content: 'paragraph' }),
  Citation,
  EntityLink,
  PreserveBlock,
  PlainHeading,
  EvidenceBlock,
  StoryVideo,
  StoryTable,
  StoryTableCaption,
  StoryTableNode,
  StoryTableRow,
  StoryTableHeader,
  StoryTableCell,
]);

const body: StoryBodyBlockDoc[] = [
  { type: 'heading', level: 2, text: 'Plain **heading** [[ent_a|kept literal]]' },
  {
    type: 'paragraph',
    text: 'A **bold [[ent_a|Ada]]** and _em_ [link](https://example.org/a) [ref:one]',
  },
  { type: 'list', style: 'bullet', items: ['One **b**', 'Two'] },
  { type: 'pullquote', text: 'Line _one_\nline two', attribution: 'Someone' } as StoryBodyBlockDoc,
  {
    type: 'table',
    caption: 'Counts [ref:one]',
    header: true,
    rows: [
      ['Year', 'Count'],
      ['1950', '**40**'],
    ],
  },
  {
    type: 'video',
    provider: 'youtube',
    videoId: 'dQw4w9WgXcQ',
    title: 'Interview',
    credit: 'Archive',
    rightsStatus: 'licensed',
  },
  { type: 'divider' },
  { type: 'mapInset', entityId: 'e', label: 'Place' } as StoryBodyBlockDoc,
];

test('every block type is valid in the real schema and comes back unchanged', () => {
  const node = schema.nodeFromJSON(storyToDocument(body));
  node.check();
  assert.deepEqual(documentToStory(node.toJSON()), body);
});

test('headings take no marks; paragraphs, quote lines and table cells do', () => {
  const heading = schema.nodes.heading!;
  const bold = schema.marks.bold!;
  assert.equal(heading.allowsMarkType(bold), false);
  assert.equal(schema.nodes.paragraph!.allowsMarkType(bold), true);
  assert.equal(schema.nodes.storyTableCaption!.allowsMarkType(bold), true);
});

test('a heading typed with markup characters is stored literally, not parsed', () => {
  const node = schema.nodeFromJSON(storyToDocument([{ type: 'heading', level: 2, text: '**x**' }]));
  assert.equal(node.firstChild!.textContent, '**x**');
});
