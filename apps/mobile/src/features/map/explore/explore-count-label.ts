/**
 * Shared Explore count copy for the floating mast and records rail — viewport-scoped
 * list size plus the full loaded release total so readers never confuse nearby pins
 * with the full geo-anchored release. Pin Pulse voice: pinned / nearby, not catalog.
 */
import type { FilterState } from '@/lib/route-params';
import { hasActiveFilters } from '@/lib/route-params';

/** Scope once the map reports a camera region. */
export const EXPLORE_SCOPE_NEARBY = 'Nearby';
/** Scope before the first viewport report (full loaded release). */
export const EXPLORE_SCOPE_ALL_PINNED = 'All pinned';

export type ExploreCountLabelInput = {
  readonly inViewCount: number;
  readonly releaseCount: number;
  /** "Nearby" once the map reports a region; "All pinned" before that. */
  readonly scopeLabel: string;
  readonly filters: FilterState;
  readonly showDemoHint?: boolean;
};

export type ExploreCountLabel = {
  /** Full mast line (includes "nearby" when dual). */
  readonly inline: string;
  /** Compact line beside a separate scopeLabel (avoids repeating scope words). */
  readonly railInline: string;
  readonly accessibilityLabel: string;
};

function formatLocaleCount(count: number): string {
  return count.toLocaleString('en-US');
}

function filteredSuffix(filters: FilterState): string {
  return hasActiveFilters(filters) ? ' · filtered' : '';
}

function singleCountPhrase(count: number, filters: FilterState): string {
  const filtered = filteredSuffix(filters);
  if (count === 0) return filtered ? `None${filtered}` : 'None';
  if (count === 1) return filtered ? `1 pinned${filtered}` : '1 pinned';
  return filtered
    ? `${formatLocaleCount(count)} pinned${filtered}`
    : `${formatLocaleCount(count)} pinned`;
}

function dualCountInline(input: ExploreCountLabelInput): string {
  const filtered = filteredSuffix(input.filters);
  const nearby =
    input.inViewCount === 0
      ? `None${filtered} nearby`
      : input.inViewCount === 1
        ? `1${filtered} nearby`
        : `${formatLocaleCount(input.inViewCount)}${filtered} nearby`;
  const inRelease =
    input.releaseCount === 1
      ? '1 in release'
      : `${formatLocaleCount(input.releaseCount)} in release`;
  return `${nearby} · ${inRelease}`;
}

function singleCountRailPhrase(count: number, filters: FilterState): string {
  const isFiltered = hasActiveFilters(filters);
  if (count === 0) return isFiltered ? 'None filtered' : 'None';
  if (count === 1) return isFiltered ? '1 filtered' : '1 pinned';
  return isFiltered
    ? `${formatLocaleCount(count)} filtered`
    : `${formatLocaleCount(count)} pinned`;
}

/** Dual copy without repeating "nearby" when scopeLabel already carries that word. */
function dualCountRailInline(input: ExploreCountLabelInput): string {
  const inView = formatLocaleCount(input.inViewCount);
  const inRelease = formatLocaleCount(input.releaseCount);
  return `${inView} / ${inRelease}`;
}

function demoSuffix(showDemoHint: boolean | undefined): string {
  return showDemoHint ? ' demo fixtures' : '';
}

/** Builds mast/rail count strings from viewport list size and loaded release total. */
export function formatExploreCountLabel(input: ExploreCountLabelInput): ExploreCountLabel {
  const demo = demoSuffix(input.showDemoHint);
  const useDual =
    input.scopeLabel === EXPLORE_SCOPE_NEARBY && input.releaseCount !== input.inViewCount;

  if (!useDual) {
    const phrase = singleCountPhrase(input.inViewCount, input.filters);
    const railPhrase = singleCountRailPhrase(input.inViewCount, input.filters);
    return {
      inline: `${phrase}${demo}`,
      railInline: `${railPhrase}${demo}`,
      accessibilityLabel: `${input.scopeLabel}, ${phrase}`,
    };
  }

  const inline = `${dualCountInline(input)}${demo}`;
  const railInline = `${dualCountRailInline(input)}${demo}`;
  const filtered = filteredSuffix(input.filters);
  const nearbyA11y =
    input.inViewCount === 0
      ? `None nearby${filtered}`
      : input.inViewCount === 1
        ? `1 nearby${filtered}`
        : `${formatLocaleCount(input.inViewCount)} nearby${filtered}`;
  const releasePhrase =
    input.releaseCount === 1 ? '1 in release' : `${formatLocaleCount(input.releaseCount)} in release`;
  return {
    inline,
    railInline,
    accessibilityLabel: `${input.scopeLabel}, ${nearbyA11y}, ${releasePhrase}`,
  };
}
