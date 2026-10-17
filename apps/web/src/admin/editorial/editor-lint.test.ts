import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Schema } from '@tiptap/pm/model';
import { lintStoryDocument, type LintNode } from './editor-lint';

const schema = new Schema({
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
