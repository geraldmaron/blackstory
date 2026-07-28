/**
 * SSR markup smoke tests for chapter prose rendering: `[ref:<id>]` citation
 * markers and `[[entityId|Label]]` entity links, including both in one
 * paragraph. Guards the regression where entity markup shipped as raw text.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { ArticleProse } from './ArticleProse';

const NO_REFS = new Map<string, number>();

test('ArticleProse renders a citation marker as a numbered reference link', () => {
  const html = renderToStaticMarkup(
    createElement(ArticleProse, {
      text: 'The ratio stalled after 1980 [ref:dkks-wealth-of-two-nations].',
      refNumberById: new Map([['dkks-wealth-of-two-nations', 1]]),
    }),
  );
  assert.match(html, /href="#ref-1"/);
  assert.doesNotMatch(html, /\[ref:/);
});

test('ArticleProse drops citation markers with no resolved number', () => {
  const html = renderToStaticMarkup(
    createElement(ArticleProse, {
      text: 'An unresolved marker [ref:not-a-reference] disappears.',
      refNumberById: NO_REFS,
    }),
  );
  assert.doesNotMatch(html, /\[ref:/);
  assert.match(html, /An unresolved marker/);
});

test('ArticleProse renders entity href from [[entityId|Label]] markup', () => {
  const html = renderToStaticMarkup(
    createElement(ArticleProse, {
      text: 'the roughly eleven thousand Black residents of [[ent_greenwood_district_001|Greenwood]].',
      refNumberById: NO_REFS,
    }),
  );
  assert.match(html, /href="\/entity\/ent_greenwood_district_001"/);
  assert.match(html, />Greenwood</);
  assert.doesNotMatch(html, /\[\[/);
});

test('ArticleProse renders entity href from bare [[entityId]] markup', () => {
  const html = renderToStaticMarkup(
    createElement(ArticleProse, {
      text: 'Rebuilt near [[ent_greenwood_district_001]] within a decade.',
      refNumberById: NO_REFS,
    }),
  );
  assert.match(html, /href="\/entity\/ent_greenwood_district_001"/);
  assert.doesNotMatch(html, /\[\[/);
});

test('ArticleProse resolves citations and entity links in one paragraph, in order', () => {
  const html = renderToStaticMarkup(
    createElement(ArticleProse, {
      text: 'Rioters burned [[ent_greenwood_district_001|Greenwood]] over two days [ref:dkks-wealth-of-two-nations].',
      refNumberById: new Map([['dkks-wealth-of-two-nations', 3]]),
    }),
  );
  assert.doesNotMatch(html, /\[\[|\[ref:/);
  const entityAt = html.indexOf('/entity/ent_greenwood_district_001');
  const citeAt = html.indexOf('#ref-3');
  assert.ok(entityAt > -1 && citeAt > -1, 'both markers render');
  assert.ok(entityAt < citeAt, 'entity link precedes the citation, matching source order');
});
