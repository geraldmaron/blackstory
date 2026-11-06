/**
 * CollectionContext: the one strip that says which collection the reader is holding and lets
 * them choose how to look at it, as a map or as a list. Records and the embedded Explore browse
 * surface render the same strip so the choice reads the same in both places.
 *
 * Two different things are counted and kept apart on purpose:
 *   - the collection: every record the shared narrowing (q, sort, facets) matches, located or not;
 *   - the map: the part of that collection that can be drawn, further limited by temporary map
 *     constraints (nearby, a time sweep, overlapping pins) that never change membership.
 *
 * The view choice is navigation, not a toolbar: native anchors with real hrefs and
 * `aria-current="page"` on the active one, so it works with JavaScript off and needs no
 * roving-focus keyboard model. Labels are the nav destinations, Map and Records.
 *
 * Composition: the count reads as the heading of the collection and the Map / Records anchors are
 * one segmented control opposite it. DOM order stays views first, then facts; CSS places the
 * facts first visually. Callers choose the placement through `className`: `ds-collection--atlas`
 * (boxed, over the map) or `ds-collection--flat` (inside the Records workbench, no box of its own).
 *
 * Docs: docs/ui/patterns-collection-context.md.
 */
import React from 'react';
import { cx } from '@repo/ui';
import './collection-context.css';

void React;

export type CollectionView = 'map' | 'records' | 'chronology';

/** The named story a collection is built from. Absent for an unnamed query. */
export type CollectionSource = {
  readonly label: string;
  readonly href: string;
  /** Linked records that are not in this public release: a count, never names. */
  readonly unresolvedCount?: number;
};

export type CollectionContextProps = {
  /** Which view is on screen. Its link stays a real anchor, marked `aria-current="page"`. */
  readonly activeView: CollectionView;
  /** Supplied by the caller (`atlasHref` / `recordsHref(...)`); never rebuilt here. */
  readonly mapHref: string;
  readonly recordsHref: string;
  /** Third view, same collection regrouped by documented decade. Omitted when not offered. */
  readonly chronologyHref?: string;
  /** Names the story behind a story collection, linking back to it. */
  readonly source?: CollectionSource;
  /**
   * Set when the named collection cannot be shown (unknown story, unreadable address, failed
   * read). It replaces the count: an unresolved collection is neither "Counting" nor zero.
   */
  readonly unresolved?: string;
  /**
   * Optional decade-range controls, folded behind a native disclosure so the strip stays compact
   * over the map. The caller supplies the form (`CollectionPeriodControls`); it is never nested
   * inside another form here.
   */
  readonly period?: React.ReactNode;
  /** Summary text for the disclosure, e.g. the active range. */
  readonly periodSummary?: string;
  /** Records in the collection, located or not. `null` while the catalog facts are unavailable. */
  readonly matched: number | null;
  /** Collection members that can be drawn on the map. `null` when unknown. */
  readonly drawable?: number | null;
  /**
   * Drawn members left after temporary map constraints. Only meaningful with `mapLimits`;
   * without them the map shows every drawable member.
   */
  readonly onMap?: number | null;
  /** Plain-language names of temporary map constraints in force ("nearby", "decade sweep"). */
  readonly mapLimits?: readonly string[];
  /** False while the catalog is loading: counts read "Counting" and the other view is inert. */
  readonly ready?: boolean;
  /** Announce count changes politely. Only for a surface that changes without a page load. */
  readonly announce?: boolean;
  readonly className?: string;
};

function n(value: number): string {
  return value.toLocaleString('en-US');
}

function records(value: number): string {
  return `${n(value)} ${value === 1 ? 'record' : 'records'}`;
}

/** The collection sentence: membership only, no map claims. */
export function collectionCountText(matched: number | null): string {
  if (matched === null) return 'Counting records in this collection';
  if (matched === 0) return 'No records match this collection';
  return `${records(matched)} in this collection`;
}

/**
 * The map sentence. Never says every match is drawn: records without a public map anchor stay in
 * the collection and are named as such.
 */
export function collectionMapText(
  matched: number | null,
  drawable: number | null | undefined,
): string | null {
  if (matched === null || matched === 0 || drawable === null || drawable === undefined) {
    return null;
  }
  const placed = Math.min(drawable, matched);
  const unlocated = matched - placed;
  if (placed === 0) return 'None can be placed on the map';
  if (unlocated === 0) return `${n(placed)} can be placed on the map`;
  return `${n(placed)} can be placed on the map; ${n(unlocated)} ${
    unlocated === 1 ? 'has' : 'have'
  } no mapped location`;
}

/** Temporary map constraints, stated as limits on the view rather than on the collection. */
export function collectionLimitText(
  onMap: number | null | undefined,
  mapLimits: readonly string[] | undefined,
): string | null {
  if (!mapLimits || mapLimits.length === 0) return null;
  const names = mapLimits.join(', ');
  return typeof onMap === 'number'
    ? `Map view limited by ${names}: ${n(onMap)} shown. The collection is unchanged.`
    : `Map view limited by ${names}. The collection is unchanged.`;
}

export function CollectionContext({
  activeView,
  mapHref,
  recordsHref,
  chronologyHref,
  source,
  unresolved,
  period,
  periodSummary,
  matched,
  drawable,
  onMap,
  mapLimits,
  ready = true,
  announce = false,
  className,
}: CollectionContextProps) {
  // An unresolved named collection is explained, not counted; its views stay reachable because
  // each one carries the same collection and says the same thing.
  const counted = unresolved === undefined && ready && matched !== null;
  const views = [
    { id: 'map' as const, label: 'Map', href: mapHref },
    { id: 'records' as const, label: 'Records', href: recordsHref },
    ...(chronologyHref !== undefined
      ? [{ id: 'chronology' as const, label: 'Chronology', href: chronologyHref }]
      : []),
  ];
  const mapText = counted ? collectionMapText(matched, drawable) : null;
  const limitText = counted ? collectionLimitText(onMap, mapLimits) : null;

  return (
    <section
      className={cx('ds-collection', className)}
      aria-label="Collection"
      data-ready={counted ? 'true' : 'false'}
    >
      <nav className="ds-collection__views" aria-label="View this collection as">
        {views.map((view) => {
          const active = view.id === activeView;
          // While facts are unavailable the other view would open a collection nobody has
          // counted; show it as plain text rather than a live link.
          if (!active && !counted && unresolved === undefined) {
            return (
              <span key={view.id} className="ds-collection__view" aria-disabled="true">
                {view.label}
              </span>
            );
          }
          return (
            <a
              key={view.id}
              className="ds-collection__view"
              href={view.href}
              aria-current={active ? 'page' : undefined}
            >
              {view.label}
            </a>
          );
        })}
      </nav>
      <div
        className="ds-collection__facts"
        {...(announce ? { 'aria-live': 'polite' as const, 'aria-atomic': true } : {})}
      >
        <p className="ds-collection__count">
          {unresolved !== undefined
            ? 'This collection cannot be shown'
            : collectionCountText(counted ? matched : null)}
        </p>
        {unresolved !== undefined ? (
          <p className="ds-collection__note" role="status">
            {unresolved}
          </p>
        ) : null}
        {source ? (
          <p className="ds-collection__note ds-collection__source">
            Records this story links to directly: <a href={source.href}>{source.label}</a>
            {source.unresolvedCount
              ? `. ${n(source.unresolvedCount)} linked ${
                  source.unresolvedCount === 1 ? 'record is' : 'records are'
                } not in this public release.`
              : '.'}
          </p>
        ) : null}
        {mapText ? <p className="ds-collection__note">{mapText}</p> : null}
        {limitText ? (
          <p className="ds-collection__note ds-collection__note--limit">{limitText}</p>
        ) : null}
      </div>
      {period ? (
        <details className="ds-collection__period">
          <summary className="ds-collection__period-summary">
            {periodSummary ?? 'Documented decade range'}
          </summary>
          {period}
        </details>
      ) : null}
    </section>
  );
}
