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
  assert.match(html, /ds-record-anatomy/);
  assert.match(html, /ds-edition-fact-icon/);
  assert.match(html, />Where</);
  assert.match(html, /ds-confidence-mark/);
  assert.match(html, /aria-label="High confidence/i);
  assert.match(html, /ds-status-mark/);
  assert.match(html, new RegExp(`href="${feature.properties.href}"`));
  assert.match(html, /Selected record/);
  assert.match(html, /ds-nc__title-link/);
});

test('Where matches Visit and does not duplicate maps exits when Visit is present', () => {
  const feature = requireFeature('ent_15th_st_church_001');
  const html = renderToStaticMarkup(createElement(NarrativeCard, { feature }));
  const { properties } = feature;

  assert.match(html, /Dupont\/Sixteenth Street Historic District area, Washington, D\.C\./);
  assert.match(html, /ds-record-visit/);
  assert.match(html, /ds-maps-handoff__name">Apple Maps</);
  assert.match(html, /ds-maps-handoff__name">Google Maps</);
  // Visit owns the two maps exits. Where is the same address as plain text.
  // Two apps, two jobs each (open, directions): four exits, rendered once. They are segments of
  // a provider control now rather than a run of text links, but the count is the same.
  assert.equal((html.match(/ds-maps-external-link/g) ?? []).length, 4);
  assert.equal((html.match(/ds-maps-handoff__provider/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Directions \(Apple\)/);
  assert.doesNotMatch(html, /neighborhood-level pin/);
  assert.match(html, /href="[^"]*era=1840s"/);
  assert.match(html, /href="\/place\/fifteenth-street-presbyterian-church#accepted-claims"/);
  assert.match(html, /href="[^"]*kind=places"/);
  assert.match(html, /aria-label="Browse Place records"/);
  assert.match(html, /href="\/records\?status=active"/);
  void properties;
});

test('Where links to maps when the record is not visitable', () => {
  const feature = requireFeature('ent_15th_st_church_001');
  const notVisitable = {
    ...feature,
    properties: { ...feature.properties, kind: 'person' },
  };
  const html = renderToStaticMarkup(createElement(NarrativeCard, { feature: notVisitable }));
  assert.doesNotMatch(html, /ds-record-visit/);
  assert.match(html, /href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=/);
  assert.match(html, /aria-label="Open [^"]+ in maps"/);
  assert.equal((html.match(/ds-maps-external-link/g) ?? []).length, 1);
});

test('renders the radius affordance as words, never as a bare number with no context', () => {
  const feature = requireFeature('ent_dunbar_school_001');
  const html = renderToStaticMarkup(createElement(NarrativeCard, { feature }));
  assert.match(html, /precision/);
  assert.match(html, /not an exact address/);
  assert.match(html, /ds-record-anatomy__precision/);
});

test('renders edition fact strip and browse controls when browseControls props are provided', () => {
  const feature = requireFeature('ent_15th_st_church_001');
  const html = renderToStaticMarkup(
    createElement(NarrativeCard, {
      feature,
      browseControls: {
        total: 3,
        index: 1,
        mode: 'ordered',
        onModeChange: () => {},
        onPrevious: () => {},
        onNext: () => {},
        onGoTo: () => {},
        itemIds: ['a', 'b', 'c'],
        ariaLabel: 'Records in view',
      },
    }),
  );

  assert.match(html, /ds-record-anatomy/);
  assert.match(html, /ds-edition-fact-icon/);
  assert.match(html, /Record at a glance/);
  assert.match(html, /ds-record-browse/);
  assert.match(html, /aria-roledescription="carousel controls"/);
  assert.match(html, /Ordered/);
  assert.match(html, /2 \/ 3/);
});

test('floats the close control on the card with an accessible label when onClose is set', () => {
  const feature = requireFeature('ent_15th_st_church_001');
  const html = renderToStaticMarkup(
    createElement(NarrativeCard, {
      feature,
      onClose: () => {},
    }),
  );

  assert.match(html, /class="ds-nc__close"/);
  assert.match(html, /aria-label="Close Fifteenth Street Presbyterian Church card"/);
  // Close is a sibling of kicker/top, not nested inside the kind row.
  assert.match(html, /ds-nc__close[\s\S]*ds-nc__kicker/);
  assert.doesNotMatch(html, /ds-nc__top[\s\S]*ds-nc__close/);
});

test('never labels a coarsened point with a street-address-shaped string', () => {
  for (const entityId of ['ent_15th_st_church_001']) {
    const feature = requireFeature(entityId);
    const html = renderToStaticMarkup(createElement(NarrativeCard, { feature }));
    const withoutVisit = html.replace(/<section class="ds-record-visit[\s\S]*?<\/section>/g, '');
    assert.doesNotMatch(withoutVisit, /\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd)\b/i);
  }
});
