import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Schema } from '@tiptap/pm/model';
import { citationNumbers, lintStoryDocument, type LintNode } from './editor-lint';

const schema = new Schema({
  marks: {
    bold: {},
    link: { attrs: { href: {} } },
  },
  nodes: {
    doc: { content: 'block+' },
    text: { group: 'inline' },
    hardBreak: { inline: true, group: 'inline' },
    citation: { inline: true, group: 'inline', atom: true, attrs: { refId: { default: '' } } },
    entityLink: {
      inline: true,
      group: 'inline',
      atom: true,
      attrs: { entityId: { default: '' }, label: { default: '' } },
    },
    paragraph: { group: 'block', content: 'inline*' },
    heading: { group: 'block', content: 'inline*', attrs: { level: { default: 2 } } },
    blockquote: { group: 'block', content: 'paragraph+' },
    listItem: { content: 'paragraph' },
    bulletList: { group: 'block', content: 'listItem+' },
    tableCell: { content: 'paragraph', attrs: { colspan: { default: 1 } } },
    tableHeader: { content: 'paragraph', attrs: { colspan: { default: 1 } } },
    tableRow: { content: '(tableCell | tableHeader)+' },
    table: { content: 'tableRow+' },
    storyTableCaption: { content: 'inline*' },
    storyTable: {
      group: 'block',
      content: 'table storyTableCaption',
      attrs: { storyBlock: { default: null } },
    },
    storyVideo: { group: 'block', atom: true, attrs: { storyBlock: { default: null } } },
  },
});
const doc = (...content: unknown[]) =>
  schema.nodeFromJSON({ type: 'doc', content }) as unknown as LintNode;
const p = (...content: unknown[]) => ({ type: 'paragraph', content });
const t = (text: string) => ({ type: 'text', text });
const none = new Set<string>();

test('a clean story has no issues, and the trailing empty paragraph is ignored', () => {
  assert.deepEqual(lintStoryDocument(doc(p(t('Hello')), p()), none), []);
});

test('empty blocks mid-document are flagged', () => {
  const issues = lintStoryDocument(doc(p(), p(t('x'))), none);
  assert.deepEqual(
    issues.map((i) => [i.index, i.kind]),
    [[0, 'empty-block']],
  );
});

test('heading and quotation limits are measured on the stored string', () => {
  const long = 'x'.repeat(241);
  const issues = lintStoryDocument(
    doc(
      { type: 'heading', attrs: { level: 2 }, content: [t(long)] },
      { type: 'blockquote', content: [p(t('y'.repeat(601)))] },
    ),
    none,
  );
  assert.deepEqual(
    issues.map((i) => i.kind),
    ['heading-length', 'pullquote-length'],
  );
});

test('a citation counts as its stored markup toward the limit', () => {
  // 235 text characters + "[ref:abcd]" (10) = 245 > 240.
  const issues = lintStoryDocument(
    doc({
      type: 'heading',
      attrs: { level: 2 },
      content: [t('x'.repeat(235)), { type: 'citation', attrs: { refId: 'abcd' } }],
    }),
    new Set(['abcd']),
  );
  assert.deepEqual(
    issues.map((i) => i.kind),
    ['heading-length'],
  );
});

test('lists are limited to 24 items and 600 characters per item', () => {
  const items = Array.from({ length: 25 }, () => ({ type: 'listItem', content: [p(t('a'))] }));
  const big = { type: 'listItem', content: [p(t('b'.repeat(601)))] };
  const issues = lintStoryDocument(
    doc({ type: 'bulletList', content: items }, { type: 'bulletList', content: [big] }),
    none,
  );
  assert.deepEqual(
    issues.map((i) => [i.index, i.kind]),
    [
      [0, 'list-size'],
      [1, 'list-item-length'],
    ],
  );
});

test('citations must name an attached source', () => {
  const issues = lintStoryDocument(
    doc(p(t('Claim '), { type: 'citation', attrs: { refId: 'gone' } }), p(t('end'))),
    new Set(['other']),
  );
  assert.deepEqual(
    issues.map((i) => [i.index, i.kind]),
    [[0, 'missing-citation']],
  );
  assert.match(issues[0]!.message, /gone/);
});

const cell = (text: string, colspan = 1) => ({
  type: 'tableCell',
  attrs: { colspan },
  content: [p(...(text ? [t(text)] : []))],
});
const table = (rows: unknown[], caption: string) => ({
  type: 'storyTable',
  content: [
    { type: 'table', content: rows },
    { type: 'storyTableCaption', content: caption ? [t(caption)] : [] },
  ],
});

test('a table needs a caption and equal rows', () => {
  const ok = table(
    [
      { type: 'tableRow', content: [cell('a'), cell('b')] },
      { type: 'tableRow', content: [cell('c'), cell('d')] },
    ],
    'Counts',
  );
  assert.deepEqual(lintStoryDocument(doc(ok), none), []);
  const bad = table(
    [
      { type: 'tableRow', content: [cell('a'), cell('b')] },
      { type: 'tableRow', content: [cell('c')] },
    ],
    '',
  );
  assert.deepEqual(
    lintStoryDocument(doc(bad), none).map((i) => i.kind),
    ['table-caption', 'table-width'],
  );
  const merged = table(
    [
      { type: 'tableRow', content: [cell('a'), cell('b')] },
      { type: 'tableRow', content: [cell('c', 2)] },
    ],
    'Counts',
  );
  assert.deepEqual(lintStoryDocument(doc(merged), none), []);
});

test('a video without a title or credit, a non-https link and an unpublished record are flagged', () => {
  const video = (storyBlock: object) => ({ type: 'storyVideo', attrs: { storyBlock } });
  assert.deepEqual(
    lintStoryDocument(doc(video({ videoId: 'v', title: 'T', credit: '' })), none).map(
      (i) => i.message,
    ),
    ['This video needs a credit.'],
  );
  assert.deepEqual(
    lintStoryDocument(doc(video({ videoId: '', title: '', credit: 'C' })), none).map(
      (i) => i.message,
    ),
    ['This video needs a link and a title.'],
  );
  assert.deepEqual(
    lintStoryDocument(doc(video({ videoId: 'v', title: 'T', credit: 'C' })), none),
    [],
  );
  const link = (href: string) => ({
    type: 'text',
    text: 'x',
    marks: [{ type: 'link', attrs: { href } }],
  });
  assert.deepEqual(lintStoryDocument(doc(p(link('https://example.org'))), none), []);
  assert.deepEqual(
    lintStoryDocument(doc(p(link('http://example.org'))), none).map((i) => i.kind),
    ['link-not-https'],
  );
  const mention = { type: 'entityLink', attrs: { entityId: 'e1', label: 'Ada' } };
  assert.deepEqual(lintStoryDocument(doc(p(mention)), none), []);
  assert.deepEqual(
    lintStoryDocument(doc(p(mention)), none, { unpublishedEntityIds: new Set(['e1']) }).map(
      (i) => i.kind,
    ),
    ['entity-unpublished'],
  );
});

test('citations are numbered by first citation, one number per distinct source', () => {
  const refs = new Map([
    ['a', { label: 'A', url: 'https://example.org/1' }],
    ['b', { label: 'B', url: 'https://example.org/2' }],
    ['c', { label: 'C', url: 'https://example.org/1' }],
  ]);
  const cite = (refId: string) => ({ type: 'citation', attrs: { refId } });
  const numbers = citationNumbers(doc(p(cite('b'), cite('a')), p(cite('c'), cite('zzz'))), refs);
  assert.deepEqual(
    [...numbers],
    [
      ['b', 1],
      ['a', 2],
      ['c', 2],
    ],
  );
});
