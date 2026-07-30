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

test('renders a linked entry for each graph-adjacency related record, with its relationship type', () => {
  const school = requireEntity('ent_dunbar_school_001');
  assert.ok((school.related?.length ?? 0) >= 2, 'the school fixture has 2 real graph edges');
  const html = renderToStaticMarkup(
    createElement(EntityRelatedList, { entity: school, labelledBy: 'related-heading' }),
  );
  assert.match(html, /Fifteenth Street Presbyterian Church/);
  assert.match(html, /D\.C\. Inventory of Historic Sites Listing/);
  assert.match(html, /href="\/entity\/ent_15th_st_church_001"/);
});

test('renders the approved missing-information notice when related is empty, not a bare empty list', () => {
  const school = requireEntity('ent_dunbar_school_001');
  const html = renderToStaticMarkup(
    createElement(EntityRelatedList, {
      entity: { ...school, related: [], relatedNeighbors: [], continueLearning: [] },
      labelledBy: 'related-heading',
    }),
  );
  assert.match(html, /No linked records yet/);
  assert.doesNotMatch(html, /<ul/);
});

test('related fallback without neighbor stubs humanizes ids instead of showing raw entity ids', () => {
  const school = requireEntity('ent_dunbar_school_001');
  const html = renderToStaticMarkup(
    createElement(EntityRelatedList, {
      entity: {
        ...school,
        relatedNeighbors: [],
        continueLearning: [],
      },
      labelledBy: 'related-heading',
    }),
  );
  assert.match(html, /15th St Church/);
  assert.doesNotMatch(html, />ent_15th_st_church_001</);
  assert.match(html, /href="\/entity\/ent_15th_st_church_001"/);
});

test('renders through-event copy when neighbor carries viaEvent co-participation context', () => {
  const school = requireEntity('ent_dunbar_school_001');
  const html = renderToStaticMarkup(
    createElement(EntityRelatedList, {
      entity: {
        ...school,
        related: [],
        relatedNeighbors: [
          {
            id: 'ent_martin_luther_king_jr_001',
            displayName: 'Martin Luther King Jr.',
            kind: 'person',
            summary: '',
            relationType: 'connected_through',
            direction: 'outgoing',
            viaEvent: {
              id: 'ent_montgomery_bus_boycott_001',
              displayName: 'Montgomery Bus Boycott',
            },
          },
        ],
        continueLearning: [],
      },
      labelledBy: 'related-heading',
    }),
  );
  assert.match(html, /through Montgomery Bus Boycott/);
  assert.match(html, /Connected through Montgomery Bus Boycott with Martin Luther King Jr\./);
});
