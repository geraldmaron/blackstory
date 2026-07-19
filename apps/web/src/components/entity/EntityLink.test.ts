/**
 * SSR/static markup smoke tests for quiet entity links and label resolution helpers.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { EntityLink, EntityLinkDiscoveryHint, resolveEntityLabel } from './EntityLink';

test('EntityLink renders a quiet entity href with ds-entity-link class', () => {
  const html = renderToStaticMarkup(
    createElement(EntityLink, {
      entityId: 'ent_dunbar_school_001',
      children: 'Paul Laurence Dunbar High School',
    }),
  );
  assert.match(html, /href="\/entity\/ent_dunbar_school_001"/);
  assert.match(html, /class="ds-entity-link"/);
  assert.match(html, /Paul Laurence Dunbar High School/);
});

test('EntityLinkDiscoveryHint renders muted discovery copy', () => {
  const html = renderToStaticMarkup(createElement(EntityLinkDiscoveryHint));
  assert.match(html, /class="ds-entity-link-hint"/);
  assert.match(html, /Record names link onward/);
});

test('resolveEntityLabel prefers map labels and humanizes ids when missing', () => {
  assert.equal(
    resolveEntityLabel('ent_dunbar_school_001', { ent_dunbar_school_001: 'Dunbar High School' }),
    'Dunbar High School',
  );
  assert.equal(resolveEntityLabel('ent_15th_st_church_001'), '15th St Church');
});
