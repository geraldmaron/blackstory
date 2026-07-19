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

test('links Where, Era, Evidence, and Kind metadata to the right site views', () => {
  const feature = requireFeature('ent_15th_st_church_001');
  const html = renderToStaticMarkup(createElement(SynchronizedResultList, { features: [feature] }));
  const { properties } = feature;

  assert.equal(properties.statePostalCode, 'DC');
  assert.match(html, /href="[^"]*state=DC"/);
  assert.match(html, /aria-label="View records in DC"/);
  assert.match(html, /href="[^"]*era=1840s"/);
  assert.match(html, /href="\/entity\/ent_15th_st_church_001#accepted-claims"/);
  assert.match(html, /href="[^"]*kind=place"/);
  assert.match(html, /aria-label="Browse Place records"/);
});

test('uses a uniform labeled meta layout with short confidence values', () => {
  const features = buildFeatures();
  const html = renderToStaticMarkup(createElement(SynchronizedResultList, { features }));
  assert.match(html, /ds-result-list__meta--labeled/);
  assert.match(html, /><dt>Kind<\/dt>/);
  assert.match(html, /><dt>Era<\/dt>/);
  assert.match(html, /><dt>Confidence<\/dt>/);
  assert.match(html, /><dt>Evidence<\/dt>/);
  assert.match(html, /><dt>Where<\/dt>/);
  assert.match(html, /data-labeled="true"/);
  assert.doesNotMatch(html, /high confidence/i);
});
