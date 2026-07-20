/**
 * Confirms Explore panel chrome class hooks and left-tab resolution stay stable for CSS and a11y.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  exploreInstrumentsPanelClassName,
  exploreNarrowExclusivePatch,
  exploreResultsPanelClassName,
  exploreStageChromeAttrs,
  resolveExploreLeftTab,
  shouldAcceptExploreServerViewState,
} from './explore-panel-chrome';

test('instruments panel class reflects visible vs hidden state', () => {
  assert.equal(
    exploreInstrumentsPanelClassName({ visible: true }),
    'ds-explore-stage__instruments',
  );
  assert.equal(
    exploreInstrumentsPanelClassName({ visible: false }),
    'ds-explore-stage__instruments ds-explore-stage__instruments--hidden',
  );
});

test('results panel class combines hidden and dimmed modifiers independently', () => {
  assert.equal(
    exploreResultsPanelClassName({ visible: true, dimmed: false }),
    'ds-explore-stage__results',
  );
  assert.equal(
    exploreResultsPanelClassName({ visible: false, dimmed: false }),
    'ds-explore-stage__results ds-explore-stage__results--hidden',
  );
  assert.equal(
    exploreResultsPanelClassName({ visible: true, dimmed: true }),
    'ds-explore-stage__results ds-explore-stage__results--dimmed',
  );
});

test('resolveExploreLeftTab closes chassis when both sections are hidden', () => {
  assert.equal(resolveExploreLeftTab({ showFilters: false, showKey: false }), null);
});

test('resolveExploreLeftTab follows the only visible section', () => {
  assert.equal(resolveExploreLeftTab({ showFilters: true, showKey: false }), 'filters');
  assert.equal(resolveExploreLeftTab({ showFilters: false, showKey: true }), 'key');
});

test('resolveExploreLeftTab uses preferredTab when both sections are visible', () => {
  assert.equal(
    resolveExploreLeftTab({ showFilters: true, showKey: true, preferredTab: null }),
    'filters',
  );
  assert.equal(
    resolveExploreLeftTab({ showFilters: true, showKey: true, preferredTab: 'key' }),
    'key',
  );
});

test('stage chrome attrs mirror instrument chassis and results for zoom safe-zones', () => {
  assert.deepEqual(
    exploreStageChromeAttrs({
      instrumentsVisible: true,
      leftTab: 'key',
      resultsVisible: false,
    }),
    {
      'data-instruments': 'open',
      'data-instruments-tab': 'key',
      'data-results': 'closed',
    },
  );
  assert.deepEqual(
    exploreStageChromeAttrs({
      instrumentsVisible: false,
      leftTab: null,
      resultsVisible: true,
    }),
    {
      'data-instruments': 'closed',
      'data-instruments-tab': 'none',
      'data-results': 'open',
    },
  );
});

test('narrow exclusive patch collapses the competing primary panel', () => {
  assert.deepEqual(exploreNarrowExclusivePatch({ opening: 'instruments' }), {
    showResults: false,
  });
  assert.deepEqual(exploreNarrowExclusivePatch({ opening: 'results' }), {
    showFilters: false,
    showKey: false,
  });
});

test('resolveExploreLeftTab treats exclusive single-section open as one tab', () => {
  // After Hide → Show filters (or tab select), only one section is URL-visible.
  assert.equal(
    resolveExploreLeftTab({ showFilters: true, showKey: false, preferredTab: 'key' }),
    'filters',
  );
  assert.equal(
    resolveExploreLeftTab({ showFilters: false, showKey: true, preferredTab: 'filters' }),
    'key',
  );
});

test('shouldAcceptExploreServerViewState ignores echo of the last client push', () => {
  assert.equal(
    shouldAcceptExploreServerViewState({
      incomingHref: '/explore?panels=filters',
      lastPushedHref: '/explore?panels=filters',
    }),
    false,
  );
  assert.equal(
    shouldAcceptExploreServerViewState({
      incomingHref: '/explore?panels=filters',
      lastPushedHref: null,
    }),
    true,
  );
});

test('shouldAcceptExploreServerViewState prefers live address bar over stale RSC', () => {
  // Client opened filters via replaceState; Next still re-supplies panels-closed initial.
  assert.equal(
    shouldAcceptExploreServerViewState({
      incomingHref: '/explore',
      lastPushedHref: '/explore?panels=filters',
      liveHref: '/explore?panels=filters',
    }),
    false,
  );
  // Genuine navigation / back-forward: live URL and last push disagree with incoming → accept.
  assert.equal(
    shouldAcceptExploreServerViewState({
      incomingHref: '/explore',
      lastPushedHref: '/explore?panels=filters',
      liveHref: '/explore',
    }),
    true,
  );
});
