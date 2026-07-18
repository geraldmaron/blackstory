/**
 * SSR markup smoke tests for the narrative off-ramp card.
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
  const feature = requireFeature('ent_15th_st_church_001');
  const html = renderToStaticMarkup(createElement(NarrativeCard, { feature }));

  assert.match(html, /Fifteenth Street Presbyterian Church/);
  assert.match(html, /1840s/);
  assert.match(html, /accepted claim/);
  assert.match(html, /bp-kind-badge/);
  assert.match(html, />Place</);
  assert.doesNotMatch(html, />place</);
  assert.match(html, /bp-confidence-mark/);
  assert.match(html, /data-labeled="true"/);
  assert.match(html, />High<|>Medium<|>Low<|>Unrated</);
  assert.doesNotMatch(html, /high confidence/i);
  assert.match(html, new RegExp(`href="${feature.properties.href}"`));
  assert.match(html, /bp-nc__title-link/);
  assert.match(html, /Open full record/);
});

test('renders the radius affordance as words, never as a bare number with no context', () => {
  const feature = requireFeature('ent_dunbar_school_001');
  const html = renderToStaticMarkup(createElement(NarrativeCard, { feature }));
  assert.match(html, /precision/);
  assert.match(html, /not an exact address/);
});

test('never labels a coarsened point with a street-address-shaped string', () => {
  for (const entityId of [
    'ent_15th_st_church_001',
    'ent_dunbar_school_001',
    'ent_dc_landmark_listing_1975',
    'ent_dunbar_alumni_federation_001',
  ]) {
    const feature = requireFeature(entityId);
    const html = renderToStaticMarkup(createElement(NarrativeCard, { feature }));
    assert.doesNotMatch(html, /\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd)\b/i);
  }
});
