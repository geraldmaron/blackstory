/**
 * Pure class-name / data-attribute helpers for Explore panel chrome: the left instrument
 * chassis (Filters | Color key tabs), the records rail/sheet, and stage data hooks that keep
 * MapLibre zoom clear of open panels. Keeps ExploreMapExperience JSX readable and gives tests
 * a stable contract for CSS and a11y.
 */

export type ExploreLeftTab = 'filters' | 'key';

export function exploreInstrumentsPanelClassName(options: { readonly visible: boolean }): string {
  return options.visible
    ? 'ds-explore-stage__instruments'
    : 'ds-explore-stage__instruments ds-explore-stage__instruments--hidden';
}

export function exploreResultsPanelClassName(options: {
  readonly visible: boolean;
  readonly dimmed: boolean;
}): string {
  const parts = ['ds-explore-stage__results'];
  if (!options.visible) parts.push('ds-explore-stage__results--hidden');
  if (options.dimmed) parts.push('ds-explore-stage__results--dimmed');
  return parts.join(' ');
}

/**
 * Resolves which left-tab content is active. Chassis is closed when both sections are hidden.
 * When only one section is visible, that tab wins; when both are visible, `preferredTab`
 * selects (default Filters).
 */
export function resolveExploreLeftTab(options: {
  readonly showFilters: boolean;
  readonly showKey: boolean;
  readonly preferredTab?: ExploreLeftTab | null;
}): ExploreLeftTab | null {
  const { showFilters, showKey, preferredTab = null } = options;
  if (!showFilters && !showKey) return null;
  if (showFilters && !showKey) return 'filters';
  if (!showFilters && showKey) return 'key';
  return preferredTab === 'key' ? 'key' : 'filters';
}

export type ExploreStageChromeAttrs = {
  readonly 'data-instruments': 'open' | 'closed';
  readonly 'data-instruments-tab': ExploreLeftTab | 'none';
  readonly 'data-results': 'open' | 'closed';
};

/**
 * Stage data attributes drive layout + MapLibre zoom safe-zones via attribute selectors
 * on the explore stage (sibling of the canvas plate).
 */
export function exploreStageChromeAttrs(options: {
  readonly instrumentsVisible: boolean;
  readonly leftTab: ExploreLeftTab | null;
  readonly resultsVisible: boolean;
}): ExploreStageChromeAttrs {
  return {
    'data-instruments': options.instrumentsVisible ? 'open' : 'closed',
    'data-instruments-tab': options.leftTab ?? 'none',
    'data-results': options.resultsVisible ? 'open' : 'closed',
  };
}

/** Narrow / tablet breakpoint where only one primary panel should occupy the map. */
export const EXPLORE_SINGLE_PANEL_MEDIA = '(max-width: 64rem)';

/**
 * When opening the instrument chassis or records on a narrow viewport, collapse the
 * competing primary panel so sheets never stack over the map/zoom control.
 */
export function exploreNarrowExclusivePatch(options: {
  readonly opening: 'instruments' | 'results';
}): { readonly showResults: boolean } | { readonly showFilters: boolean; readonly showKey: boolean } {
  if (options.opening === 'instruments') {
    return { showResults: false };
  }
  return { showFilters: false, showKey: false };
}
