/**
 * RailGroup: entries are anchors with an optional mono count or a leading glyph — never both
 * meaninglessly rendered, and never a button (a rail crawlers must be able to follow).
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { RailGroup } from './RoomRail';

test('renders nothing for an empty group', () => {
  const html = renderToStaticMarkup(createElement(RailGroup, { title: 'By era', entries: [] }));
  assert.equal(html, '');
});

test('a count renders as a mono number, right-aligned by the layout', () => {
  const html = renderToStaticMarkup(
    createElement(RailGroup, {
      title: 'By era',
      entries: [{ label: 'Redlining', href: '/stories?era=Redlining', count: 12 }],
    }),
  );
  assert.match(html, /<span class="ds-room-num">12<\/span>/);
});

test('a glyph renders ahead of the label and stays out of the accessibility tree', () => {
  const html = renderToStaticMarkup(
    createElement(RailGroup, {
      title: 'Records cited',
      entries: [
        {
          label: 'Isaac McGhie',
          href: '/entity/isaac-mcghie',
          glyph: createElement('svg', { 'data-testid': 'glyph' }),
        },
      ],
    }),
  );
  assert.match(html, /ds-room-rail-group__glyph" aria-hidden="true"/);
  assert.match(html, /data-testid="glyph"[\s\S]*Isaac McGhie/);
});

test('an entry with neither count nor glyph renders the label alone', () => {
  const html = renderToStaticMarkup(
    createElement(RailGroup, {
      title: 'In this chapter',
      entries: [{ label: 'The ordinance and its afterlife', href: '#section-0-the-ordinance' }],
    }),
  );
  assert.doesNotMatch(html, /ds-room-num/);
  assert.doesNotMatch(html, /ds-room-rail-group__glyph/);
});
