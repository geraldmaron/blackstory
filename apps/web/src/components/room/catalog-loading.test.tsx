import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CatalogLoading } from './catalog-loading';

test('catalog loading makes one announcement and hides placeholder content', () => {
  const html = renderToStaticMarkup(
    <CatalogLoading pathname="/books" label="Taking the books off the shelf…" />,
  );
  assert.equal((html.match(/role="status"/g) ?? []).length, 1);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /Taking the books off the shelf…/);
  assert.doesNotMatch(html, /\d+ (records|books|law entries)/);
});
