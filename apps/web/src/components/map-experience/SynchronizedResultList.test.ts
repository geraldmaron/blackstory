/**
 * SSR markup smoke tests for the synchronized, accessible list peer.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { buildExploreMapSource } from '../../lib/map-experience';
import { SynchronizedResultList } from './SynchronizedResultList';

function buildFeatures() {
  return buildExploreMapSource(listPublicEntities()).featureCollection.features;
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

test('renders without a selection or onSelect handler (no-JS-safe plain link list)', () => {
  const features = buildFeatures();
  const html = renderToStaticMarkup(createElement(SynchronizedResultList, { features }));
  assert.doesNotMatch(html, /aria-current="true"/);
});
