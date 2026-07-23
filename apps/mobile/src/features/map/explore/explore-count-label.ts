/**
 * Shared Explore count copy for the floating mast and records rail — viewport-scoped
 * list size plus the full loaded release total so readers never confuse ~700 in view
 * with ~1,365 geo-anchored records in the active release.
 */
import type { FilterState } from '@/lib/route-params';
import { hasActiveFilters } from '@/lib/route-params';

export type ExploreCountLabelInput = {
  readonly inViewCount: number;
  readonly releaseCount: number;
  /** "In view" once the map reports a region; "All records" before that. */
  readonly scopeLabel: string;
  readonly filters: FilterState;
  readonly showDemoHint?: boolean;
};

export type ExploreCountLabel = {
  /** Full mast line (includes "in view" when dual). */
  readonly inline: string;
  /** Compact line beside a separate scopeLabel (avoids "In view / 712 in view"). */
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
  if (count === 1) return filtered ? `1 record${filtered}` : '1 record';
  return filtered
    ? `${formatLocaleCount(count)} records${filtered}`
    : `${formatLocaleCount(count)} records`;
}

function dualCountInline(input: ExploreCountLabelInput): string {
  const filtered = filteredSuffix(input.filters);
  const inView =
    input.inViewCount === 0
      ? `None${filtered} in view`
      : input.inViewCount === 1
        ? `1${filtered} in view`
        : `${formatLocaleCount(input.inViewCount)}${filtered} in view`;
  const inRelease =
    input.releaseCount === 1
      ? '1 in release'
      : `${formatLocaleCount(input.releaseCount)} in release`;
  return `${inView} · ${inRelease}`;
}

function singleCountRailPhrase(count: number, filters: FilterState): string {
  const isFiltered = hasActiveFilters(filters);
  if (count === 0) return isFiltered ? 'None filtered' : 'None';
  if (count === 1) return isFiltered ? '1 filtered' : '1 pinned';
  return isFiltered
    ? `${formatLocaleCount(count)} filtered`
    : `${formatLocaleCount(count)} pinned`;
}

/** Dual copy without repeating "in view" when scopeLabel already carries that word. */
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
    input.scopeLabel === 'In view' && input.releaseCount !== input.inViewCount;

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
  const inViewA11y =
    input.inViewCount === 0
      ? `None in view${filtered}`
      : input.inViewCount === 1
        ? `1 in view${filtered}`
        : `${formatLocaleCount(input.inViewCount)} in view${filtered}`;
  const releasePhrase =
    input.releaseCount === 1 ? '1 in release' : `${formatLocaleCount(input.releaseCount)} in release`;
  return {
    inline,
    railInline,
    accessibilityLabel: `${input.scopeLabel}, ${inViewA11y}, ${releasePhrase}`,
  };
}
