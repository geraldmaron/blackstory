/**
 * SSR markup smoke tests for the BB-052 missing-information notice (acceptance criterion 2).
 * Mirrors the render-to-static-markup pattern used by ../banners.test.ts.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { RECORD_GAP_COPY, type RecordGapKind } from './copy';
import { RecordGapNotice } from './RecordGapNotice';

const KINDS: readonly RecordGapKind[] = ['claims', 'related', 'timeline', 'statusHistory'];

for (const kind of KINDS) {
  test(`RecordGapNotice(${kind}) renders the approved copy for that gap, never a bare empty list`, () => {
    const html = renderToStaticMarkup(createElement(RecordGapNotice, { kind }));
    const copy = RECORD_GAP_COPY[kind];
    assert.match(html, /role="status"/);
    assert.match(html, new RegExp(copy.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(html, /no history/i, 'gap copy must frame research incompleteness, not history absence');
  });
}
