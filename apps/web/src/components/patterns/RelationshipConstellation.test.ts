/**
 * RelationshipConstellation pattern tests — typed edges only; list always present.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { RelationshipConstellation } from './RelationshipConstellation';

test('renders typed edges as diagram nodes and a labelled list', () => {
  const html = renderToStaticMarkup(
    createElement(RelationshipConstellation, {
      centerLabel: 'Dunbar High School',
      edges: [
        {
          name: 'Fifteenth Street Presbyterian Church',
          relation: 'located at',
          href: '/place/fifteenth-street-presbyterian-church',
        },
        {
          name: 'Paul Laurence Dunbar',
          relation: 'named for',
          href: '/memorial',
        },
      ],
    }),
  );
  assert.match(html, /ds-constellation__diagram/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /Connections from Dunbar High School/);
  assert.match(html, /located at/);
  assert.match(html, /href="\/place\/fifteenth-street-presbyterian-church"/);
  assert.doesNotMatch(html, /nearby|Nearby/);
});

test('returns null when there are no edges', () => {
  const html = renderToStaticMarkup(
    createElement(RelationshipConstellation, {
      centerLabel: 'Empty',
      edges: [],
    }),
  );
  assert.equal(html, '');
});
