/**
 * SSR markup smoke tests for the narrative off-ramp card.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { buildExploreMapSource } from '../../lib/map-experience/build-explore-map-source';
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
  assert.match(html, /ds-kind-badge/);
  assert.match(html, />Place</);
  assert.doesNotMatch(html, />place</);
  assert.match(html, /ds-confidence-mark/);
  assert.match(html, /data-labeled="true"/);
  assert.match(html, />High<|>Medium<|>Low<|>Unrated</);
  assert.doesNotMatch(html, /high confidence/i);
  assert.match(html, new RegExp(`href="${feature.properties.href}"`));
  assert.match(html, /Selected record/);
  assert.match(html, /><dt>Where<\/dt>/);
  assert.match(html, /ds-nc__title-link/);
  assert.match(html, /Open full record/);
});

test('links Where, Era, Evidence, Kind, and Status metadata to the right site views', () => {
  const feature = requireFeature('ent_15th_st_church_001');
  const html = renderToStaticMarkup(createElement(NarrativeCard, { feature }));
  const { properties } = feature;

  assert.equal(properties.statePostalCode, 'DC');
  assert.match(html, /href="[^"]*state=DC"/);
  assert.match(html, /aria-label="View records in DC"/);
  assert.match(html, /href="[^"]*era=1840s"/);
  assert.match(html, /href="\/entity\/ent_15th_st_church_001#accepted-claims"/);
  assert.match(html, /href="[^"]*kind=place"/);
  assert.match(html, /aria-label="Browse Place records"/);
  assert.match(html, /href="\/search\?status=active"/);
});

test('renders an em dash for Where when no postal code is present', () => {
  const feature = requireFeature('ent_15th_st_church_001');
  const withoutState = {
    ...feature,
    properties: { ...feature.properties, statePostalCode: undefined },
  };
  const html = renderToStaticMarkup(createElement(NarrativeCard, { feature: withoutState }));
  assert.match(html, /—/);
  assert.doesNotMatch(html, /aria-label="View records in/);
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
