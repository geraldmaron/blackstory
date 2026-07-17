/**
 * SSR markup smoke tests for the BB-051 narrative off-ramp card.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { buildExploreMapSource } from '../../lib/map-experience';
import { NarrativeCard } from './NarrativeCard';

function requireFeature(entityId: string) {
  const source = buildExploreMapSource(listPublicEntities());
  const feature = source.featureCollection.features.find((f) => f.properties.entityId === entityId);
  assert.ok(feature, `expected a feature for ${entityId}`);
  return feature!;
}

test('renders name, era, one-line story, evidence count, confidence, and a link to the entity page', () => {
  const feature = requireFeature('ent_seed_place_001');
  const html = renderToStaticMarkup(createElement(NarrativeCard, { feature }));

  assert.match(html, /Seed Historical Place/);
  assert.match(html, /1860s/);
  assert.match(html, /accepted claim/);
  assert.match(html, /confidence/i);
  assert.match(html, new RegExp(`href="${feature.properties.href}"`));
});

test('renders the radius affordance as words, never as a bare number with no context', () => {
  const feature = requireFeature('ent_seed_school_001');
  const html = renderToStaticMarkup(createElement(NarrativeCard, { feature }));
  assert.match(html, /precision/);
  assert.match(html, /not an exact address/);
});

test('never labels a coarsened point with a street-address-shaped string', () => {
  for (const entityId of ['ent_seed_place_001', 'ent_seed_school_001', 'ent_seed_event_001', 'ent_seed_institution_001']) {
    const feature = requireFeature(entityId);
    const html = renderToStaticMarkup(createElement(NarrativeCard, { feature }));
    assert.doesNotMatch(html, /\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd)\b/i);
  }
});
