/**
 * Semantic a11y tests for the operator workbench primitives, via SSR markup.
 *
 * These cover the parts that are easy to regress silently: a control strip that announces as
 * nothing, an empty record field that is indistinguishable from a failed load, and a disabled
 * save button whose precondition is only visible to sighted users.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { DataTable } from './DataTable.tsx';
import { DetailField, DetailPanel } from './DetailPanel.tsx';
import { InlineEdit } from './InlineEdit.tsx';
import { Pagination } from './Pagination.tsx';
import { SelectionBar } from './SelectionBar.tsx';
import { Toolbar, ToolbarField } from './Toolbar.tsx';

test('Toolbar without an action is a labeled toolbar, not an unnamed div', () => {
  const html = renderToStaticMarkup(createElement(Toolbar, { label: 'View controls' }, 'controls'));
  assert.match(html, /role="toolbar"/);
  assert.match(html, /aria-label="View controls"/);
});

test('Toolbar with an action submits natively and carries preserved params as hidden inputs', () => {
  const html = renderToStaticMarkup(
    createElement(Toolbar, {
      label: 'Search entities',
      action: '/catalog',
      preservedParams: { sort: 'name', page: '3' },
    }),
  );
  assert.match(html, /<form/);
  assert.match(html, /action="\/catalog"/);
  assert.match(html, /method="get"/);
  assert.match(html, /role="search"/);
  // Without these, submitting the search box silently drops the operator's facets and sort.
  assert.match(html, /name="sort" value="name"/);
  assert.match(html, /name="page" value="3"/);
});

test('ToolbarField keeps its label for screen readers even when visually hidden', () => {
  const html = renderToStaticMarkup(
    createElement(ToolbarField, { label: 'Search', labelHidden: true, children: 'input' }),
  );
  assert.match(html, /ds-visually-hidden/);
  assert.match(html, />Search</);
});

test('DetailPanel is a labeled section with a definition list of fields', () => {
  const html = renderToStaticMarkup(
    createElement(DetailPanel, {
      title: 'Record',
      meta: 'ent_123',
      children: createElement(DetailField, { label: 'Kind', children: 'person' }),
    }),
  );
  assert.match(html, /<section[^>]*aria-label="Record"/);
  assert.match(html, /<h2[^>]*>Record<\/h2>/);
  assert.match(html, /<dl/);
  assert.match(html, /<dt[^>]*>Kind<\/dt>/);
  assert.match(html, /person/);
});

test('DetailField states what is absent rather than rendering blank', () => {
  const html = renderToStaticMarkup(
    createElement(DetailField, { label: 'Aliases', emptyLabel: 'No aliases recorded' }),
  );
  assert.match(html, /No aliases recorded/);
});

test('DetailField treats an empty list as empty, not as content', () => {
  // `rows.map(...)` on no rows yields [], which renders as nothing at all.
  const html = renderToStaticMarkup(
    createElement(DetailField, { label: 'Identifiers', emptyLabel: 'None recorded' }, []),
  );
  assert.match(html, /None recorded/);
});

test('DetailField renders a real value instead of the empty state', () => {
  const html = renderToStaticMarkup(
    createElement(DetailField, { label: 'Kind', emptyLabel: 'None recorded' }, 'person'),
  );
  assert.match(html, /person/);
  assert.doesNotMatch(html, /None recorded/);
});

test('InlineEdit ties a disabled save to the reason it is disabled', () => {
  const html = renderToStaticMarkup(
    createElement(InlineEdit, {
      disabled: true,
      disabledReason: 'Give a reason for this change first',
      children: 'field',
    }),
  );
  assert.match(html, /disabled=""/);
  // The precondition must be announced with the button, not just placed near it.
  const describedBy = html.match(/aria-describedby="([^"]+)"/);
  assert.ok(describedBy, 'disabled submit must reference its reason');
  assert.match(html, new RegExp(`id="${describedBy[1]}"`));
  assert.match(html, /Give a reason for this change first/);
});

test('InlineEdit announces success politely and failure assertively', () => {
  const saved = renderToStaticMarkup(
    createElement(InlineEdit, { status: 'saved', message: 'Saved', children: 'field' }),
  );
  assert.match(saved, /role="status"/);

  const failed = renderToStaticMarkup(
    createElement(InlineEdit, { status: 'error', message: 'Refused', children: 'field' }),
  );
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Refused/);
});

test('InlineEdit emits hidden fields and reports pending on the button', () => {
  const html = renderToStaticMarkup(
    createElement(InlineEdit, {
      hiddenFields: { entityId: 'ent_1', field: 'displayName' },
      pending: true,
      children: 'field',
    }),
  );
  assert.match(html, /name="entityId" value="ent_1"/);
  assert.match(html, /name="field" value="displayName"/);
  assert.match(html, /Saving…/);
  assert.match(html, /disabled=""/);
});

test('Pagination renders Prev and Next as non-links at the bounds', () => {
  const props = { pageCount: 3, pageSize: 10, total: 30, hrefForPage: (n: number) => `/p/${n}` };
  const first = renderToStaticMarkup(createElement(Pagination, { ...props, page: 1 }));
  assert.match(first, /<span class="ds-pagination__step" aria-disabled="true">← Prev<\/span>/);
  assert.match(first, /<a class="ds-pagination__step" href="\/p\/2" rel="next">/);
  const last = renderToStaticMarkup(createElement(Pagination, { ...props, page: 3 }));
  assert.match(last, /<span class="ds-pagination__step" aria-disabled="true">Next →<\/span>/);
  assert.match(last, /<a class="ds-pagination__step" href="\/p\/2" rel="prev">/);
});

test('DataTable names a row checkbox with rowLabel and only makes actionable rows tab stops', () => {
  type Row = { id: string; name: string };
  const base = {
    caption: 'Rows',
    rows: [{ id: 'ent_1', name: 'Bethel AME' }] as readonly Row[],
    columns: [{ id: 'name', header: 'Name', cell: (row: Row) => row.name }],
    rowKey: (row: Row) => row.id,
  };
  const selectable = renderToStaticMarkup(
    createElement(DataTable<Row>, {
      ...base,
      rowLabel: (row) => row.name,
      selectedIds: new Set(['ent_1']),
      onSelectionChange: () => {},
    }),
  );
  assert.match(selectable, /aria-label="Select Bethel AME"/);
  assert.match(selectable, /<tr[^>]*tabindex="0"/);
  // A native table row has no selected state; the checkbox carries it.
  assert.doesNotMatch(selectable, /aria-selected/);

  const readOnly = renderToStaticMarkup(createElement(DataTable<Row>, base));
  assert.doesNotMatch(readOnly, /tabindex/);
});

test('SelectionBar announces the count only, not the controls beside it', () => {
  const html = renderToStaticMarkup(
    createElement(SelectionBar, { selectedCount: 2, matchCount: 40, onClear: () => {} }),
  );
  assert.match(html, /<p class="ds-selection-bar__count" aria-live="polite">/);
  assert.doesNotMatch(html, /role="region"[^>]*aria-live/);
});
