/**
 * Connection tree tests: the shape contract (what hangs under what, which loops become words) and
 * the rendering contract inherited from the map this replaced — one anchor per record, no second
 * list, no duplicate keys where eight people share a single `/memorial` href, and no graph
 * vocabulary anywhere a reader can see.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { buildRelationshipTree } from './relationship-tree';
import { RelationshipTree } from './RelationshipTree';
import type { RelationshipGraph } from '../../data/public-seed';

const GRAPH: RelationshipGraph = {
  centerId: 'center',
  centerYear: 1870,
  nodes: [
    {
      id: 'church',
      displayName: 'Fifteenth Street Presbyterian Church',
      kind: 'place',
      summary: 'A church.',
      hop: 1,
      relationType: 'located_in',
      direction: 'outgoing',
      year: 1890,
    },
    {
      id: 'p1',
      displayName: 'Anna Cooper',
      kind: 'person',
      summary: 'A teacher.',
      hop: 1,
      relationType: 'taught_at',
      direction: 'incoming',
      year: 1900,
    },
    {
      id: 'p2',
      displayName: 'Mary Church Terrell',
      kind: 'person',
      summary: 'An organiser.',
      hop: 1,
      relationType: 'taught_at',
      direction: 'incoming',
      year: 1905,
    },
    {
      id: 'fed',
      displayName: 'Dunbar Alumni Federation',
      kind: 'institution',
      summary: 'An alumni body.',
      hop: 2,
      relationType: 'successor_to',
      direction: 'outgoing',
      viaId: 'church',
      year: 1970,
    },
    {
      id: 'ord',
      displayName: 'An undated ordinance',
      kind: 'law',
      summary: 'A law.',
      hop: 2,
      relationType: 'governed_by',
      direction: 'outgoing',
      viaId: 'church',
    },
  ],
  links: [
    { source: 'center', target: 'church', relationType: 'located_in', spine: true },
    { source: 'center', target: 'p1', relationType: 'taught_at', spine: true },
    { source: 'center', target: 'p2', relationType: 'taught_at', spine: true },
    { source: 'church', target: 'fed', relationType: 'successor_to', spine: true },
    { source: 'church', target: 'ord', relationType: 'governed_by', spine: true },
    { source: 'p1', target: 'p2', relationType: 'colleague_of', spine: false },
  ],
};

test('every record hangs under the record it was reached through', () => {
  const tree = buildRelationshipTree(GRAPH, 'Dunbar High School');
  assert.deepEqual(
    tree.branches.map((branch) => branch.displayName),
    ['Fifteenth Street Presbyterian Church', 'Anna Cooper', 'Mary Church Terrell'],
  );
  const church = tree.branches[0];
  assert.deepEqual(
    church?.children.map((child) => child.displayName),
    // Dated first, then the undated one — never guessed onto a date it does not have.
    ['Dunbar Alumni Federation', 'An undated ordinance'],
  );
  assert.equal(church?.descendantCount, 2);
  assert.equal(church?.children[0]?.viaName, 'Fifteenth Street Presbyterian Church');
  assert.equal(tree.total, 5);
  assert.equal(tree.deepest, 2);
});

test('a loop the tree cannot draw is stated once, in words, on the deeper record', () => {
  const tree = buildRelationshipTree(GRAPH, 'Dunbar High School');
  const cooper = tree.branches.find((branch) => branch.id === 'p1');
  const terrell = tree.branches.find((branch) => branch.id === 'p2');
  assert.deepEqual(cooper?.alsoConnects, []);
  assert.deepEqual(terrell?.alsoConnects, ['Anna Cooper']);
});

test('a record whose route out of the payload was capped still appears', () => {
  const tree = buildRelationshipTree(
    {
      centerId: 'center',
      nodes: [
        {
          id: 'orphan',
          displayName: 'Orphan',
          kind: 'place',
          hop: 2,
          relationType: 'related_to',
          direction: 'outgoing',
          viaId: 'never-fetched',
        },
      ],
      links: [],
    },
    'Center',
  );
  assert.equal(tree.branches.length, 1);
  assert.equal(tree.branches[0]?.viaName, undefined);
});

test('a viaId cycle cannot hang the walk', () => {
  const tree = buildRelationshipTree(
    {
      centerId: 'center',
      nodes: [
        {
          id: 'a',
          displayName: 'A',
          kind: 'place',
          hop: 1,
          relationType: 'related_to',
          direction: 'outgoing',
          viaId: 'b',
        },
        {
          id: 'b',
          displayName: 'B',
          kind: 'place',
          hop: 1,
          relationType: 'related_to',
          direction: 'outgoing',
          viaId: 'a',
        },
      ],
      links: [],
    },
    'Center',
  );
  assert.equal(tree.total, 2);
});

test('the tree is deterministic', () => {
  assert.deepEqual(
    buildRelationshipTree(GRAPH, 'Dunbar High School'),
    buildRelationshipTree(GRAPH, 'Dunbar High School'),
  );
});

test('renders one anchor per record and no duplicate-key href collision', () => {
  const html = renderToStaticMarkup(
    createElement(RelationshipTree, { centerLabel: 'Dunbar High School', graph: GRAPH }),
  );

  // Two people would both resolve to `/memorial` through `neighborHref`. On the tree each
  // addresses its own record, which is what keeps the keys unique.
  assert.match(html, /href="\/entity\/p1"/);
  assert.match(html, /href="\/entity\/p2"/);
  assert.doesNotMatch(html, /href="\/memorial"/);

  // Exactly one rendering per record. The component this replaced drew a dead diagram node and
  // then a link row for the same edge; the name now appears once as visible text (it also appears
  // in that anchor's aria-label, which is an attribute, not a second rendering).
  assert.equal(html.split('>Mary Church Terrell<').length - 1, 1);
  assert.equal(html.split('<a ').length - 1, GRAPH.nodes.length);

  // The chain is spoken, since a screen reader cannot see the indent that carries it.
  assert.match(html, /aria-label="[^"]*through Fifteenth Street Presbyterian Church[^"]*"/);
  assert.match(html, /aria-label="[^"]*undated"/);
  assert.match(html, /taught at, from their record/);
});

test('never prints graph vocabulary at a reader', () => {
  const html = renderToStaticMarkup(
    createElement(RelationshipTree, { centerLabel: 'Dunbar High School', graph: GRAPH }),
  );
  assert.doesNotMatch(html, /\bhops?\b/i);
  assert.doesNotMatch(html, /\bnodes?\b/i);
  assert.doesNotMatch(html, /steps away/i);
});

test('a small tree opens whole, with no disclosure rows to click', () => {
  const html = renderToStaticMarkup(
    createElement(RelationshipTree, { centerLabel: 'Dunbar High School', graph: GRAPH }),
  );
  assert.doesNotMatch(html, /<details/);
  assert.match(html, />Dunbar Alumni Federation</);
});

test('a dense record folds its deeper branches behind a labelled disclosure', () => {
  // Five first-level records carrying two apiece: enough to fold, and no branch so thin that
  // folding it would cost a click to reveal a single card.
  const nodes = Array.from({ length: 15 }, (_, index) => ({
    id: `n${index}`,
    displayName: `Record ${index}`,
    kind: 'place',
    summary: '',
    hop: index < 5 ? 1 : 2,
    relationType: 'related_to',
    direction: 'outgoing' as const,
    ...(index < 5 ? {} : { viaId: `n${(index - 5) % 5}` }),
    year: 1900 + index,
  }));
  const html = renderToStaticMarkup(
    createElement(RelationshipTree, {
      centerLabel: 'Center',
      graph: { centerId: 'center', nodes, links: [] },
    }),
  );
  assert.match(html, /<details/);
  assert.match(html, /2 more from here/);
  // Folded, not dropped: the records are in the markup and reachable without JavaScript.
  assert.match(html, />Record 14</);
});

test('a surface with its own vocabulary replaces the relation wording wholesale', () => {
  const html = renderToStaticMarkup(
    createElement(RelationshipTree, {
      centerLabel: 'Dunbar High School',
      graph: GRAPH,
      labels: { church: 'a church two blocks north' },
    }),
  );
  assert.match(html, /a church two blocks north/);
  // The catalog token never leaks through beside the human line, and a record the surface had no
  // words for shows its name alone rather than falling back to the token.
  assert.doesNotMatch(html, /located in/);
  assert.doesNotMatch(html, /taught at/);
});

test('returns null when the graph is empty', () => {
  const html = renderToStaticMarkup(
    createElement(RelationshipTree, {
      centerLabel: 'Empty',
      graph: { centerId: 'center', nodes: [], links: [] },
    }),
  );
  assert.equal(html, '');
});
