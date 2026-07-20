/**
 * Confirms shareable URL state round-trips: parse(build(state)) reproduces the same
 * filters/viewport/selection/layerMode, so a copied `/explore?...` URL reproduces the same view.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildExploreHref,
  buildExploreSearchParams,
  nationalViewport,
  parseExploreSearchParams,
  viewportForState,
} from './url-state';

test('an empty query string parses to the "all" default filter state with no viewport/selection', () => {
  const parsed = parseExploreSearchParams({});
  assert.deepEqual(parsed.filters, { era: 'all', kind: 'all', theme: 'all', confidence: 'all' });
  assert.equal(parsed.viewport, undefined);
  assert.equal(parsed.selected, undefined);
  assert.equal(parsed.layerMode, 'presence');
  assert.equal(parsed.group, false);
  assert.equal(parsed.lines, false);
  assert.equal(parsed.decade, undefined);
  assert.equal(parsed.edge, undefined);
  assert.equal(parsed.showFilters, true);
  assert.equal(parsed.showResults, true);
  assert.equal(parsed.showKey, true);
});

test('round-trips a full view state through build -> parse', () => {
  const state = {
    filters: { era: '1970s', kind: 'school', theme: 'education', confidence: 'high' },
    viewport: { lat: 38.9072, lng: -77.0369, zoom: 11.5 },
    selected: 'ent_dunbar_school_001',
    state: 'DC',
    layerMode: 'presence' as const,
    group: false,
    lines: true,
    decade: '1970s',
    edge: 'rel_landmark_occurred_at_school',
    showFilters: true,
    showResults: true,
    showKey: true,
  };

  const href = buildExploreHref(state);
  assert.match(href, /^\/explore\?/);
  assert.doesNotMatch(href, /group=/);

  const [, qs] = href.split('?');
  const parsed = parseExploreSearchParams(Object.fromEntries(new URLSearchParams(qs)));

  assert.deepEqual(parsed.filters, state.filters);
  assert.ok(parsed.viewport);
  assert.equal(parsed.viewport!.lat, 38.9072);
  assert.equal(parsed.viewport!.lng, -77.0369);
  assert.equal(parsed.viewport!.zoom, 11.5);
  assert.equal(parsed.selected, state.selected);
  assert.equal(parsed.state, 'DC');
  assert.equal(parsed.layerMode, 'presence');
  assert.equal(parsed.group, false);
  assert.equal(parsed.lines, true);
  assert.equal(parsed.decade, '1970s');
  assert.equal(parsed.edge, 'rel_landmark_occurred_at_school');
});

test('default filter values are omitted from the query string (minimal shareable URL)', () => {
  const qs = buildExploreSearchParams({
    filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
    layerMode: 'presence',
    group: false,
    lines: false,
    showFilters: true,
    showResults: true,
    showKey: true,
  });
  assert.equal(qs, '');
});

test('layerMode=off is emitted; presence (default) is omitted', () => {
  assert.equal(
    buildExploreSearchParams({
      filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
      layerMode: 'off',
      group: false,
      lines: false,
      showFilters: true,
      showResults: true,
      showKey: true,
    }),
    'layerMode=off',
  );
  assert.equal(
    buildExploreSearchParams({
      filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
      layerMode: 'presence',
      group: false,
      lines: false,
      showFilters: true,
      showResults: true,
      showKey: true,
    }),
    '',
  );
});

test('legacy density=1 migrates to presence on parse', () => {
  assert.equal(parseExploreSearchParams({ density: '1' }).layerMode, 'presence');
  assert.equal(parseExploreSearchParams({ density: 'true' }).layerMode, 'presence');
});

test('population modes round-trip decade params', () => {
  const share = {
    filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
    layerMode: 'blackShare' as const,
    popDecade: '2010' as const,
    group: false,
    lines: false,
    showFilters: true,
    showResults: true,
    showKey: true,
  };
  const shareQs = buildExploreSearchParams(share);
  assert.equal(shareQs, 'layerMode=blackShare&popDecade=2010');
  assert.deepEqual(parseExploreSearchParams(Object.fromEntries(new URLSearchParams(shareQs))), share);

  const change = {
    filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
    layerMode: 'blackChange' as const,
    popFrom: '2000' as const,
    popTo: '2020' as const,
    group: false,
    lines: false,
    showFilters: true,
    showResults: true,
    showKey: true,
  };
  const changeQs = buildExploreSearchParams(change);
  assert.equal(changeQs, 'layerMode=blackChange&popFrom=2000');
  assert.deepEqual(parseExploreSearchParams(Object.fromEntries(new URLSearchParams(changeQs))), {
    ...change,
    popTo: '2020',
  });
});

test('group=1 turns nearby-point grouping on; omitted group defaults off', () => {
  assert.equal(parseExploreSearchParams({ group: '1' }).group, true);
  assert.equal(parseExploreSearchParams({ group: 'true' }).group, true);
  assert.equal(parseExploreSearchParams({ group: '0' }).group, false);
  assert.equal(parseExploreSearchParams({ group: 'false' }).group, false);
  assert.equal(parseExploreSearchParams({}).group, false);
});

test('buildExploreSearchParams emits group=1 only when grouping is on', () => {
  assert.match(
    buildExploreSearchParams({
      filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
      layerMode: 'presence',
      group: true,
      lines: false,
      showFilters: true,
      showResults: true,
      showKey: true,
    }),
    /^group=1$/,
  );
  assert.equal(
    buildExploreSearchParams({
      filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
      layerMode: 'presence',
      group: false,
      lines: false,
      showFilters: true,
      showResults: true,
      showKey: true,
    }),
    '',
  );
});

test('hidePanels defaults all panels to shown when param is absent', () => {
  const parsed = parseExploreSearchParams({});
  assert.equal(parsed.showFilters, true);
  assert.equal(parsed.showResults, true);
  assert.equal(parsed.showKey, true);
  assert.equal(
    buildExploreSearchParams({
      filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
      layerMode: 'presence',
      group: false,
      lines: false,
      showFilters: true,
      showResults: true,
      showKey: true,
    }),
    '',
  );
});

test('hidePanels=filters hides only the filters panel', () => {
  const parsed = parseExploreSearchParams({ hidePanels: 'filters' });
  assert.equal(parsed.showFilters, false);
  assert.equal(parsed.showResults, true);
  assert.equal(parsed.showKey, true);

  const state = {
    filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
    layerMode: 'presence' as const,
    group: false,
    lines: false,
    showFilters: false,
    showResults: true,
    showKey: true,
  };
  assert.equal(buildExploreSearchParams(state), 'hidePanels=filters');
  assert.deepEqual(parseExploreSearchParams(Object.fromEntries(new URLSearchParams('hidePanels=filters'))), state);
});

test('hidePanels=results hides only the results rail', () => {
  const parsed = parseExploreSearchParams({ hidePanels: 'results' });
  assert.equal(parsed.showFilters, true);
  assert.equal(parsed.showResults, false);
  assert.equal(parsed.showKey, true);

  const state = {
    filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
    layerMode: 'presence' as const,
    group: false,
    lines: false,
    showFilters: true,
    showResults: false,
    showKey: true,
  };
  assert.equal(buildExploreSearchParams(state), 'hidePanels=results');
  assert.deepEqual(parseExploreSearchParams(Object.fromEntries(new URLSearchParams('hidePanels=results'))), state);
});

test('hidePanels=key hides only the color key legend', () => {
  const parsed = parseExploreSearchParams({ hidePanels: 'key' });
  assert.equal(parsed.showFilters, true);
  assert.equal(parsed.showResults, true);
  assert.equal(parsed.showKey, false);

  const state = {
    filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
    layerMode: 'presence' as const,
    group: false,
    lines: false,
    showFilters: true,
    showResults: true,
    showKey: false,
  };
  assert.equal(buildExploreSearchParams(state), 'hidePanels=key');
  assert.deepEqual(parseExploreSearchParams(Object.fromEntries(new URLSearchParams('hidePanels=key'))), state);
});

test('hidePanels=filters,results,key hides all panels regardless of token order', () => {
  for (const hidePanels of [
    'filters,results,key',
    'key,results,filters',
    'results, key , filters, key',
  ]) {
    const parsed = parseExploreSearchParams({ hidePanels });
    assert.equal(parsed.showFilters, false, hidePanels);
    assert.equal(parsed.showResults, false, hidePanels);
    assert.equal(parsed.showKey, false, hidePanels);
  }

  const state = {
    filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
    layerMode: 'presence' as const,
    group: false,
    lines: false,
    showFilters: false,
    showResults: false,
    showKey: false,
  };
  assert.equal(
    new URLSearchParams(buildExploreSearchParams(state)).get('hidePanels'),
    'filters,results,key',
  );
  assert.deepEqual(
    parseExploreSearchParams(Object.fromEntries(new URLSearchParams('hidePanels=filters,results,key'))),
    state,
  );
  assert.deepEqual(
    parseExploreSearchParams(Object.fromEntries(new URLSearchParams('hidePanels=key,results,filters'))),
    state,
  );
});

test('hidePanels ignores unknown tokens', () => {
  const parsed = parseExploreSearchParams({ hidePanels: 'filters,sidebar,results,key' });
  assert.equal(parsed.showFilters, false);
  assert.equal(parsed.showResults, false);
  assert.equal(parsed.showKey, false);
});

test('viewport requires all three of lat/lng/zoom to be present and finite', () => {
  const parsed = parseExploreSearchParams({ lat: '38.9', lng: 'not-a-number', zoom: '10' });
  assert.equal(parsed.viewport, undefined);
});

test('viewportForState resolves a known postal code to its bbox midpoint', () => {
  const dc = viewportForState('DC');
  assert.ok(dc);
  assert.ok(dc!.lat > 38.7 && dc!.lat < 39.1);
  assert.ok(dc!.lng > -77.2 && dc!.lng < -76.8);
  assert.equal(dc!.zoom, 6.2);
});

test('viewportForState pulls back to a wider zoom for Alaska and Hawaii', () => {
  assert.equal(viewportForState('AK')?.zoom, 4.5);
  assert.equal(viewportForState('HI')?.zoom, 4.5);
});

test('viewportForState is case-insensitive and returns undefined for an unknown code', () => {
  assert.deepEqual(viewportForState('dc'), viewportForState('DC'));
  assert.equal(viewportForState('ZZ'), undefined);
});

test('nationalViewport centers the continental US resting frame', () => {
  const national = nationalViewport();
  assert.ok(national.lat > 24 && national.lat < 50);
  assert.ok(national.lng > -126 && national.lng < -66);
  assert.ok(national.zoom > 0);
});
