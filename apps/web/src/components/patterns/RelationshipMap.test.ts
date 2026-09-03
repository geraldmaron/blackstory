/**
 * Relationship map tests: the layout's geometry contract, and the rendering contract that
 * replaced `RelationshipConstellation` — one anchor per record, no second list, and a key that
 * survives eight people who all share a single `/memorial` href.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { layOutRelationshipMap } from './relationship-map-layout';
import { RelationshipMap } from './RelationshipMap';
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

test('lays hops out as lanes and gives undated records their own lane', () => {
  const layout = layOutRelationshipMap(GRAPH, 'Dunbar High School');
  assert.deepEqual(
    layout.lanes.map((lane) => lane.label),
    ['this record', '1 hop', '2 hops', 'undated'],
  );
  const ord = layout.nodes.find((node) => node.id === 'ord');
  const fed = layout.nodes.find((node) => node.id === 'fed');
  assert.ok(ord && fed);
  // Undated drops to the undated lane rather than being placed on the axis at a guessed year.
  assert.equal(ord.year, undefined);
  assert.notEqual(ord.y, fed.y);
  assert.equal(layout.timeAxis, true);
  assert.ok(layout.ticks.length >= 2);
});

test('a later record sits to the right of an earlier one', () => {
  const layout = layOutRelationshipMap(GRAPH, 'Dunbar High School');
  const church = layout.nodes.find((node) => node.id === 'church');
  const p2 = layout.nodes.find((node) => node.id === 'p2');
  assert.ok(church && p2);
  assert.ok(church.x < p2.x, `expected 1890 left of 1905, got ${church.x} and ${p2.x}`);
});

test('nodes in a lane never overlap', () => {
  const layout = layOutRelationshipMap(GRAPH, 'Dunbar High School');
  for (const lane of layout.lanes) {
    const inLane = layout.nodes.filter((node) => node.y === lane.y).sort((a, b) => a.x - b.x);
    for (let i = 1; i < inLane.length; i += 1) {
      const previous = inLane[i - 1];
      const current = inLane[i];
      assert.ok(previous && current);
      assert.ok(
        current.x >= previous.x + previous.width,
        `${current.displayName} overlaps ${previous.displayName}`,
      );
    }
  }
});

test('every node carries its path back to the record', () => {
  const layout = layOutRelationshipMap(GRAPH, 'Dunbar High School');
  const fed = layout.nodes.find((node) => node.id === 'fed');
  assert.deepEqual(fed?.pathToCenter, ['church', 'center']);
  const church = layout.nodes.find((node) => node.id === 'church');
  assert.deepEqual(church?.pathToCenter, ['center']);
});

test('depth trims the map and shrinks the canvas', () => {
  const full = layOutRelationshipMap(GRAPH, 'Dunbar High School');
  const near = layOutRelationshipMap(GRAPH, 'Dunbar High School', { maxHop: 1 });
  assert.ok(near.nodes.length < full.nodes.length);
  assert.ok(near.height < full.height);
  assert.ok(near.nodes.every((node) => node.hop <= 1));
  assert.ok(near.links.every((link) => link.target !== 'fed' && link.source !== 'fed'));
});

test('the layout is deterministic', () => {
  assert.deepEqual(
    layOutRelationshipMap(GRAPH, 'Dunbar High School'),
    layOutRelationshipMap(GRAPH, 'Dunbar High School'),
  );
});

test('claims no time axis when fewer than two years are known', () => {
  const layout = layOutRelationshipMap(
    {
      centerId: 'center',
      nodes: [
        {
          id: 'x',
          displayName: 'X',
          kind: 'place',
          hop: 1,
          relationType: 'related_to',
          direction: 'outgoing',
        },
      ],
      links: [],
    },
    'Center',
  );
  assert.equal(layout.timeAxis, false);
  assert.deepEqual(layout.ticks, []);
});

test('renders one anchor per record and no duplicate-key href collision', () => {
  const html = renderToStaticMarkup(
    createElement(RelationshipMap, { centerLabel: 'Dunbar High School', graph: GRAPH }),
  );

  // Two people would both resolve to `/memorial` through `neighborHref`. On the map each
  // addresses its own record, which is what made the keys unique again.
  assert.match(html, /href="\/entity\/p1"/);
  assert.match(html, /href="\/entity\/p2"/);
  assert.doesNotMatch(html, /href="\/memorial"/);

  // Exactly one rendering per record. The old component drew a dead diagram node and then a
  // link row for the same edge; the name now appears once as visible text (it also appears in
  // that anchor's aria-label, which is an attribute, not a second rendering).
  assert.equal(html.split('>Mary Church Terrell<').length - 1, 1);
  assert.equal(html.split('<a ').length - 1, GRAPH.nodes.length);

  // The wires are decoration; every fact they carry is also in a link's accessible name.
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /aria-label="[^"]*one step away[^"]*"/);
  assert.match(html, /aria-label="[^"]*2 steps away[^"]*"/);
  assert.match(html, /aria-label="[^"]*undated"/);
  assert.match(html, /taught at, from their record/);
});

test('returns null when the graph is empty', () => {
  const html = renderToStaticMarkup(
    createElement(RelationshipMap, {
      centerLabel: 'Empty',
      graph: { centerId: 'center', nodes: [], links: [] },
    }),
  );
  assert.equal(html, '');
});
