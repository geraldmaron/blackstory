/**
 * Confirms BB-051's shareable URL state round-trips: parse(build(state)) reproduces the same
 * filters/viewport/selection/density, so a copied `/explore?...` URL reproduces the same view.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildExploreHref, buildExploreSearchParams, parseExploreSearchParams } from './url-state';

test('an empty query string parses to the "all" default filter state with no viewport/selection', () => {
  const parsed = parseExploreSearchParams({});
  assert.deepEqual(parsed.filters, { era: 'all', kind: 'all', theme: 'all', confidence: 'all' });
  assert.equal(parsed.viewport, undefined);
  assert.equal(parsed.selected, undefined);
  assert.equal(parsed.density, false);
  assert.equal(parsed.lines, false);
  assert.equal(parsed.decade, undefined);
  assert.equal(parsed.edge, undefined);
});

test('round-trips a full view state through build -> parse', () => {
  const state = {
    filters: { era: '1950s', kind: 'school', theme: 'education', confidence: 'high' },
    viewport: { lat: 38.9072, lng: -77.0369, zoom: 11.5 },
    selected: 'ent_seed_school_001',
    state: 'DC',
    density: true,
    lines: true,
    decade: '1950s',
    edge: 'rel_seed_event_occurred_at_school',
  };

  const href = buildExploreHref(state);
  assert.match(href, /^\/explore\?/);

  const [, qs] = href.split('?');
  const parsed = parseExploreSearchParams(Object.fromEntries(new URLSearchParams(qs)));

  assert.deepEqual(parsed.filters, state.filters);
  assert.ok(parsed.viewport);
  assert.equal(parsed.viewport!.lat, 38.9072);
  assert.equal(parsed.viewport!.lng, -77.0369);
  assert.equal(parsed.viewport!.zoom, 11.5);
  assert.equal(parsed.selected, state.selected);
  assert.equal(parsed.state, 'DC');
  assert.equal(parsed.density, true);
  assert.equal(parsed.lines, true);
  assert.equal(parsed.decade, '1950s');
  assert.equal(parsed.edge, 'rel_seed_event_occurred_at_school');
});

test('default filter values are omitted from the query string (minimal shareable URL)', () => {
  const qs = buildExploreSearchParams({
    filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
    density: false,
    lines: false,
  });
  assert.equal(qs, '');
});

test('viewport requires all three of lat/lng/zoom to be present and finite', () => {
  const parsed = parseExploreSearchParams({ lat: '38.9', lng: 'not-a-number', zoom: '10' });
  assert.equal(parsed.viewport, undefined);
});
