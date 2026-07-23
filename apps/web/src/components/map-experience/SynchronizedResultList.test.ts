/**
 * SSR markup smoke tests for the synchronized, accessible list peer.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { buildExploreMapSource } from '../../lib/map-experience/build-explore-map-source';
import { SynchronizedResultList } from './SynchronizedResultList';

function buildFeatures() {
  return buildExploreMapSource(listPublicEntities()).featureCollection.features;
}

function requireFeature(entityId: string) {
  const feature = buildFeatures().find((entry) => entry.properties.entityId === entityId);
  assert.ok(feature, `expected a feature for ${entityId}`);
  return feature!;
}

test('renders one real link per feature, each pointing at its entity page', () => {
  const features = buildFeatures();
  const html = renderToStaticMarkup(createElement(SynchronizedResultList, { features }));
  for (const feature of features) {
    assert.match(html, new RegExp(`href="${feature.properties.href}"`));
  }
});

test('marks the selected item with aria-current for screen-reader parity with the map selection', () => {
  const features = buildFeatures();
  const selected = features[0]!;
  const html = renderToStaticMarkup(
    createElement(SynchronizedResultList, { features, selectedId: selected.properties.entityId }),
  );
  assert.match(html, /aria-current="true"/);
});

test('renders without a selection (no-JS-safe plain link list)', () => {
  const features = buildFeatures();
  const html = renderToStaticMarkup(createElement(SynchronizedResultList, { features }));
  assert.doesNotMatch(html, /aria-current="true"/);
});

test('entity cards are plain navigable links (never intercept click with preventDefault)', () => {
  const features = buildFeatures();
  const html = renderToStaticMarkup(createElement(SynchronizedResultList, { features }));
  assert.doesNotMatch(html, /onClick/);
  for (const feature of features) {
    assert.match(html, new RegExp(`href="${feature.properties.href}"`));
  }
});

test('with onSelect, rows are buttons that keep the reader on the map surface', () => {
  const features = buildFeatures();
  const html = renderToStaticMarkup(
    createElement(SynchronizedResultList, { features, onSelect: () => undefined }),
  );
  assert.match(html, /ds-result-list__link--button/);
  assert.doesNotMatch(html, /class="ds-result-list__link"[^>]*href="/);
});

test('with onSelect, metadata links are not nested inside the row button', () => {
  const feature = requireFeature('ent_15th_st_church_001');
  const html = renderToStaticMarkup(
    createElement(SynchronizedResultList, { features: [feature], onSelect: () => undefined }),
  );

  const buttonClose = html.indexOf('</button>');
  const firstMetaHref = html.indexOf('href="/explore?kind=place"');
  assert.ok(buttonClose > -1, 'expected a row button');
  assert.ok(firstMetaHref > buttonClose, 'expected metadata links after the row button closes');
  assert.doesNotMatch(html, /<button[^>]*>[\s\S]*<a[\s\S]*<\/button>/);
});

test('links Where to external maps and other metadata to the right site views', () => {
  const feature = requireFeature('ent_15th_st_church_001');
  const html = renderToStaticMarkup(createElement(SynchronizedResultList, { features: [feature] }));
  const { properties } = feature;

  assert.equal(properties.statePostalCode, 'DC');
  assert.match(html, /href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=/);
  assert.match(html, /aria-label="Open [^"]+ in maps"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /target="_blank"/);
  assert.doesNotMatch(html, /href="[^"]*state=DC"/);
  assert.match(html, /href="[^"]*era=1840s"/);
  assert.match(html, /href="\/entity\/ent_15th_st_church_001#accepted-claims"/);
  assert.match(html, /href="[^"]*kind=place"/);
  assert.match(html, /aria-label="Browse Place records"/);
});

test('uses a uniform labeled meta layout with short confidence values', () => {
  const features = buildFeatures();
  const html = renderToStaticMarkup(createElement(SynchronizedResultList, { features }));
  assert.match(html, /ds-result-list__meta--labeled/);
  assert.match(html, /ds-meta-field-label/);
  assert.match(html, />Kind</);
  assert.match(html, />Era</);
  assert.match(html, />Confidence</);
  assert.match(html, />Evidence</);
  assert.match(html, />Where</);
  assert.match(html, /data-labeled="true"/);
  // Visible text stays short ("High"); aria-label + title carry the full help phrase.
  assert.doesNotMatch(html, /ds-confidence-mark__text">[^<]*confidence/i);
  assert.match(html, /title="High confidence:/);
});

test('empty Where uses plain Not placed copy (no em dash placeholder)', () => {
  const feature = requireFeature('ent_15th_st_church_001');
  const stripped = {
    ...feature,
    geometry: {
      type: 'Point' as const,
      coordinates: [Number.NaN, Number.NaN] as [number, number],
    },
    properties: {
      ...feature.properties,
      statePostalCode: undefined,
      stateName: undefined,
      city: undefined,
      locationLabel: undefined,
    },
  };
  const html = renderToStaticMarkup(
    createElement(SynchronizedResultList, { features: [stripped] }),
  );
  assert.match(html, /<dd class="ds-mono">Not placed<\/dd>/);
});
