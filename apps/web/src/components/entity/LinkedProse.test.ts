/**
 * SSR markup smoke tests for inline entity-link prose rendering.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { LinkedProse } from './LinkedProse';

test('LinkedProse renders entity href from [[entityId|Label]] markup', () => {
  const html = renderToStaticMarkup(
    createElement(LinkedProse, {
      text: 'Visit [[ent_dunbar_school_001|Paul Laurence Dunbar High School]] for context.',
    }),
  );
  assert.match(html, /href="\/entity\/ent_dunbar_school_001"/);
  assert.match(html, /Paul Laurence Dunbar High School/);
  assert.match(html, /class="ds-entity-link"/);
});

test('LinkedProse renders entity href from [[entityId]] markup', () => {
  const html = renderToStaticMarkup(
    createElement(LinkedProse, {
      text: 'Connected to [[ent_15th_st_church_001]] nearby.',
    }),
  );
  assert.match(html, /href="\/entity\/ent_15th_st_church_001"/);
});

test('LinkedProse linkifies plain text against catalog when no markup is present', () => {
  const html = renderToStaticMarkup(
    createElement(LinkedProse, {
      text: 'Worship continued at Fifteenth Street Presbyterian Church.',
      catalog: [
        { id: 'ent_15th_st_church_001', displayName: 'Fifteenth Street Presbyterian Church' },
      ],
    }),
  );
  assert.match(html, /href="\/entity\/ent_15th_st_church_001"/);
  assert.match(html, /Fifteenth Street Presbyterian Church/);
});

test('LinkedProse preserves plain text when no links apply', () => {
  const html = renderToStaticMarkup(
    createElement(LinkedProse, {
      text: 'A concise summary with no linked names.',
      className: 'ds-page__lede',
    }),
  );
  assert.match(html, /class="ds-page__lede"/);
  assert.match(html, /A concise summary with no linked names\./);
  assert.doesNotMatch(html, /href="\/entity\//);
});

test('LinkedProse skips self-links from skipEntityIds', () => {
  const html = renderToStaticMarkup(
    createElement(LinkedProse, {
      text: 'See [[ent_dunbar_school_001|Dunbar High School]] for more.',
      skipEntityIds: ['ent_dunbar_school_001'],
    }),
  );
  assert.doesNotMatch(html, /href="\/entity\/ent_dunbar_school_001"/);
  assert.match(html, /Dunbar High School/);
});

test('LinkedProse resolves gap-fill supreme court wikilink markup', () => {
  const html = renderToStaticMarkup(
    createElement(LinkedProse, {
      text: 'The U.S. [[gap_supreme_court|Supreme Court]], established in 1789.',
    }),
  );
  assert.match(html, /href="\/entity\/gap_supreme_court"/);
  assert.match(html, /Supreme Court/);
  assert.doesNotMatch(html, /\[\[/);
});
