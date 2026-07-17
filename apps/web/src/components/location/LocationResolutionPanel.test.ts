/**
 * SSR markup smoke tests for LocationResolutionPanel (BB-050). Covers every `LocateClientResult`
 * variant and asserts acceptance criterion 3 directly: even when a (hypothetical) resolution
 * carried `precision.lat`/`precision.lng`, this component's rendered markup never contains them —
 * it only ever reads jurisdiction names/ids.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { LocationResolutionPanel } from './LocationResolutionPanel';
import type { LocateClientResult } from '../../lib/geocode/locate-client';

test('renders resolved jurisdiction names and a link to search, never the raw coordinate', () => {
  const result: LocateClientResult = {
    kind: 'resolved',
    cacheHit: false,
    resolution: {
      match: { placeName: 'Washington', countyName: 'District of Columbia', stateName: 'District of Columbia' },
      jurisdictionIds: { countryId: 'us', stateId: 'us-11', countyId: 'us-11-001' },
      precision: { tier: 'exact-site', exactCoordinatesRetained: true, lat: 38.846, lng: -76.927 },
    },
  };
  const html = renderToStaticMarkup(createElement(LocationResolutionPanel, { result }));
  assert.match(html, /Washington, District of Columbia, District of Columbia/);
  assert.match(html, /us-11-001/);
  assert.match(html, /href="\/search"/);
  assert.doesNotMatch(html, /38\.846/, 'exact lat must never appear in rendered markup');
  assert.doesNotMatch(html, /-76\.927/, 'exact lng must never appear in rendered markup');
});

test('renders the manual-place-search fallback with its message and search link', () => {
  const result: LocateClientResult = {
    kind: 'fallback',
    fallback: {
      available: true,
      reason: 'no_match',
      message: 'We could not match that address.',
      searchHref: '/search',
    },
  };
  const html = renderToStaticMarkup(createElement(LocationResolutionPanel, { result }));
  assert.match(html, /We could not match that address\./);
  assert.match(html, /href="\/search"/);
});

test('renders a rate-limited notice', () => {
  const html = renderToStaticMarkup(
    createElement(LocationResolutionPanel, { result: { kind: 'rate_limited' } }),
  );
  assert.match(html, /Too many location lookups/);
});

test('renders an app-check-denied notice', () => {
  const html = renderToStaticMarkup(
    createElement(LocationResolutionPanel, { result: { kind: 'app_check_denied' } }),
  );
  assert.match(html, /could not be verified/);
});

test('renders a network-error notice', () => {
  const html = renderToStaticMarkup(
    createElement(LocationResolutionPanel, { result: { kind: 'network_error' } }),
  );
  assert.match(html, /temporarily unreachable/);
});

test('renders an invalid-query notice', () => {
  const html = renderToStaticMarkup(
    createElement(LocationResolutionPanel, { result: { kind: 'invalid_query', reason: 'empty_address' } }),
  );
  assert.match(html, /could not be read as an address/);
});
