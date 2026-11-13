/**
 * The shared primitives: one Button on <a> and <button>, Chip states that never rely on color,
 * Tabs and Segmented current marks, and a PageHeader with no kicker.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { Button, buttonClassName } from './Button.tsx';
import { Chip } from './Chip.tsx';
import { FilterButton } from './FilterButton.tsx';
import { PageHeader, SectionHeading } from './PageHeader.tsx';
import { Segmented } from './Segmented.tsx';
import { Tabs } from './Tabs.tsx';

test('Button renders a button by default and an anchor with href', () => {
  const button = renderToStaticMarkup(createElement(Button, { variant: 'quiet' }, 'Go'));
  assert.match(button, /^<button type="button" class="ds-button ds-button--quiet"/);
  const link = renderToStaticMarkup(createElement(Button, { href: '/records' }, 'Records'));
  assert.match(link, /^<a class="ds-button ds-button--primary"[^>]*href="\/records"/);
  const busy = renderToStaticMarkup(createElement(Button, { loading: true }, 'Save'));
  assert.match(busy, /disabled=""/);
  assert.match(busy, /aria-busy="true"/);
  assert.equal(buttonClassName('secondary', 'x'), 'ds-button ds-button--secondary x');
});

test('Chip: selected carries a check glyph and aria-pressed; removable names its action', () => {
  const selected = renderToStaticMarkup(createElement(Chip, { selected: true }, 'Person'));
  assert.match(selected, /aria-pressed="true"/);
  assert.match(selected, /ds-chip--selected/);
  assert.match(selected, /<svg class="ds-chip__glyph"/);
  const echo = renderToStaticMarkup(
    createElement(Chip, { removable: true, href: '/records' }, 'church'),
  );
  assert.match(echo, /^<a class="ds-chip ds-chip--removable" href="\/records"/);
  assert.match(echo, /aria-label="Remove church"/);
});

test('FilterButton shows a count only when the filter is set', () => {
  assert.doesNotMatch(
    renderToStaticMarkup(createElement(FilterButton, {}, 'Era')),
    /ds-filter-button__count/,
  );
  const set = renderToStaticMarkup(createElement(FilterButton, { count: 2 }, 'Era'));
  assert.match(set, /ds-button--secondary ds-filter-button/);
  assert.match(set, /ds-filter-button__count">2<span class="ds-visually-hidden"> selected/);
});

test('Tabs mark the current place with aria-current; a tab without href is a button', () => {
  const html = renderToStaticMarkup(
    createElement(Tabs, {
      label: 'Main',
      items: [
        { label: 'Map', onClick: () => {}, current: true },
        { label: 'Records', href: '/records' },
      ],
    }),
  );
  assert.match(html, /<nav class="ds-tabs" aria-label="Main">/);
  assert.match(html, /<button type="button" class="ds-tabs__tab" aria-current="page">Map/);
  assert.match(html, /<a class="ds-tabs__tab" href="\/records">Records/);
});

test('Segmented is a radio group, or links when every option has an href', () => {
  const radios = renderToStaticMarkup(
    createElement(Segmented, {
      label: 'View',
      name: 'view',
      value: 'list',
      options: [
        { value: 'list', label: 'List' },
        { value: 'timeline', label: 'Timeline' },
      ],
    }),
  );
  assert.match(radios, /role="radiogroup" aria-label="View"/);
  assert.match(radios, /type="radio" name="view" checked="" value="list"/);
  const links = renderToStaticMarkup(
    createElement(Segmented, {
      label: 'View',
      value: 'timeline',
      options: [
        { value: 'list', label: 'List', href: '?view=list' },
        { value: 'timeline', label: 'Timeline', href: '?view=timeline' },
      ],
    }),
  );
  assert.match(links, /href="\?view=timeline" aria-current="page"/);
});

test('PageHeader is crumb, h1, dek and actions; SectionHeading is an h2', () => {
  const html = renderToStaticMarkup(
    createElement(PageHeader, {
      title: 'Records',
      dek: '4,387 records',
      crumb: { href: '/rooms', label: 'More' },
    }),
  );
  assert.match(html, /<a class="ds-page-header__crumb" href="\/rooms">More<\/a>/);
  assert.match(html, /<h1 class="ds-page-header__title">Records<\/h1>/);
  assert.match(html, /<p class="ds-page-header__dek">4,387 records<\/p>/);
  assert.doesNotMatch(html, /kicker|eyebrow/);
  assert.match(
    renderToStaticMarkup(createElement(SectionHeading, {}, 'Sources')),
    /^<h2 class="ds-section-heading">Sources<\/h2>$/,
  );
});
