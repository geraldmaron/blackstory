/**
 * Proves the palette's ranking is predictable: an operator typing a prefix gets the destination
 * whose label starts that way, not the one that happens to mention it in a keyword.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  filterCommandPaletteItems,
  groupCommandPaletteItems,
  isCommandPaletteChord,
  type CommandPaletteItem,
} from './CommandPalette.js';

const ITEMS: readonly CommandPaletteItem[] = [
  { id: 'inbox', label: 'Inbox', group: 'Triage', hint: '/inbox', keywords: ['submissions'] },
  { id: 'graylist', label: 'Graylist', group: 'Triage', hint: '/graylist' },
  { id: 'catalog', label: 'Catalog', group: 'Catalog', hint: '/catalog' },
  { id: 'quick-add', label: 'Quick add', group: 'Catalog', keywords: ['inbox'] },
  { id: 'audit', label: 'Audit log', group: 'Admin', hint: '/audit' },
];

test('an empty query preserves the curated order', () => {
  assert.deepEqual(
    filterCommandPaletteItems(ITEMS, '   ').map((item) => item.id),
    ITEMS.map((item) => item.id),
  );
});

test('a label prefix outranks a keyword match on another item', () => {
  const ids = filterCommandPaletteItems(ITEMS, 'inbox').map((item) => item.id);
  assert.deepEqual(ids, ['inbox', 'quick-add']);
});

test('a mid-label word prefix beats a bare substring elsewhere', () => {
  const ids = filterCommandPaletteItems(ITEMS, 'add').map((item) => item.id);
  assert.deepEqual(ids, ['quick-add']);
});

test('matching is case-insensitive and falls back to subsequence', () => {
  assert.deepEqual(
    filterCommandPaletteItems(ITEMS, 'GRAY').map((item) => item.id),
    ['graylist'],
  );
  // 'ctlg' appears in "Catalog" only as a subsequence.
  assert.deepEqual(
    filterCommandPaletteItems(ITEMS, 'ctlg').map((item) => item.id),
    ['catalog'],
  );
});

test('a query that matches nothing returns nothing', () => {
  assert.deepEqual(filterCommandPaletteItems(ITEMS, 'zzzz'), []);
});

test('grouping preserves first-appearance order of groups and items', () => {
  const grouped = groupCommandPaletteItems(ITEMS);
  assert.deepEqual(
    grouped.map((section) => section.group),
    ['Triage', 'Catalog', 'Admin'],
  );
  assert.deepEqual(
    grouped[0]?.items.map((item) => item.id),
    ['inbox', 'graylist'],
  );
});

test('ungrouped items collapse into a single trailing null section', () => {
  const grouped = groupCommandPaletteItems([
    { id: 'a', label: 'A', group: 'G' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[1]?.group, null);
  assert.equal(grouped[1]?.items.length, 2);
});

test('the open chord is ⌘K or Ctrl+K, and nothing else', () => {
  assert.equal(isCommandPaletteChord({ key: 'k', metaKey: true, ctrlKey: false }), true);
  assert.equal(isCommandPaletteChord({ key: 'K', metaKey: false, ctrlKey: true }), true);
  assert.equal(isCommandPaletteChord({ key: 'k', metaKey: false, ctrlKey: false }), false);
  assert.equal(isCommandPaletteChord({ key: 'j', metaKey: true, ctrlKey: false }), false);
});
