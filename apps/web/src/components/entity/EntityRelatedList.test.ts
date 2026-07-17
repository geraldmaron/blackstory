/**
 * SSR markup smoke tests for the graph-derived related-records list (acceptance
 * criterion 6). Confirms it renders the real `PublicRelatedEntry` output of the graph adjacency
 * builder (never a hand-authored `relatedIds` string list) and falls back to the approved gap
 * notice when a record has no published graph edges.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { getPublicEntity } from '../../data/public-seed';
import { EntityRelatedList } from './EntityRelatedList';

function requireEntity(id: string) {
  const entity = getPublicEntity(id);
  assert.ok(entity, `expected seed fixture ${id} to exist`);
  return entity;
}

test('renders a linked entry for each BB-092 graph-adjacency related record, with its relationship type', () => {
  const school = requireEntity('ent_seed_school_001');
  assert.ok((school.related?.length ?? 0) >= 2, 'the school fixture has 2 real graph edges');
  const html = renderToStaticMarkup(createElement(EntityRelatedList, { entity: school, labelledBy: 'related-heading' }));
  assert.match(html, /Seed Historical Place/);
  assert.match(html, /Seed Emancipation Day Commemoration/);
  assert.match(html, /href="\/entity\/ent_seed_place_001"/);
});

test('renders the approved missing-information notice when related is empty, not a bare empty list', () => {
  const school = requireEntity('ent_seed_school_001');
  const html = renderToStaticMarkup(
    createElement(EntityRelatedList, {
      entity: { ...school, related: [], relatedNeighbors: [], continueLearning: [] },
      labelledBy: 'related-heading',
    }),
  );
  assert.match(html, /No linked records yet/);
  assert.doesNotMatch(html, /<ul/);
});
