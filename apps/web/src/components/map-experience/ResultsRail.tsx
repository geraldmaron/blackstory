/**
 * Results — right instrument, z 20. The list side of the map/list pair.
 *
 * Windowed on purpose. `/history` renders all 4,078 records as anchors in one document and the
 * cost shows; this rail carries the same population inside a fixed-height scroller and renders
 * only the rows in view plus a small overscan (design-direction-v9-atlas.md §5.3, WP-12).
 *
 * Windowing and `role="listbox"` are in tension: assistive tech counts the options it can see, and
 * a window shows perhaps twenty of four thousand. `aria-setsize` and `aria-posinset` carry the
 * real position and total on every rendered option, which is exactly the case those attributes
 * exist for.
 *
 * Row anatomy is `18px 1fr auto` — glyph, name over meta, save. The place truncates because it is
 * the only part of the meta line with a variable length; era and grade never do, because a
 * half-printed evidence grade is worse than no evidence grade. It also drops an address head that
 * repeats the name directly above it, which was spending that variable length on a second copy of
 * the line the reader had just read.
 */
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@repo/ui';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';
import {
  gradeDescription,
  gradeForConfidence,
  gradeLabel,
} from '../../lib/map-experience/evidence-grade';
import type { PhotoIndex } from '../../lib/map-experience/use-photo-index';
import { placeDetail, placeLabelFor } from '../../lib/map-experience/place-label';
import { meterLevelForTier, RecordMeter } from '../entity/RecordChrome';
import { KindGlyph } from './KindGlyph';
import './results-rail.css';

void React;

/** Fixed row height. Windowing needs a known row box; variable heights would need measurement. */
export const RESULTS_ROW_HEIGHT = 54;
/** Rows rendered above and below the viewport so a fast scroll does not show blank space. */
const OVERSCAN = 6;

export type ResultsSort = 'oldest' | 'newest';

/** One active, clearable narrowing constraint (docs/ui/patterns-lens-handoff.md §3). Rendered as
 * a chip naming what narrowed the set, with a control to clear just that one. */
export type ResultsConstraint = {
  readonly key: string;
  readonly label: string;
  readonly onClear: () => void;
};

export type ResultsRailProps = {
  readonly features: readonly ExploreMapFeature[];
  readonly total: number;
  readonly selectedId?: string | undefined;
  readonly onSelect: (feature: ExploreMapFeature) => void;
  readonly sort: ResultsSort;
  readonly onSortChange: (sort: ResultsSort) => void;
  readonly savedIds?: ReadonlySet<string>;
  readonly onToggleSave?: (feature: ExploreMapFeature) => void;
  readonly onHide?: () => void;
  /** Every constraint currently narrowing the set, arrived by URL or set in the Lens — excluding
   * `selected`, `collection` and `find`, which address rather than narrow. */
  readonly constraints?: readonly ResultsConstraint[];
  /** Rendered in place of the list when nothing matches. Never a bare "no results". */
  readonly emptyState?: React.ReactNode;
  /**
   * The surface's photo index, when the reader has already caused it to load. A row whose
   * record is in it shows the photo as a thumbnail in the glyph column; every other row keeps
   * the kind glyph. Fails closed: no index, no photo, no placeholder.
   */
  readonly photos?: PhotoIndex | null;
  /** Fires once the pointer or focus first enters the rail: the caller's cue to load photos. */
  readonly onIntent?: () => void;
  readonly className?: string;
};

function eraLabel(feature: ExploreMapFeature): string {
  return feature.properties.eraBuckets[0] ?? 'Undated';
}

/**
 * The row prints the name on its own line, so the place beneath it drops any address head that
 * merely restates that name: "100 Block North Greenwood Avenue" over "Tulsa, Oklahoma" rather
 * than over a truncated second copy of itself.
 */
function placeLabel(feature: ExploreMapFeature): string {
  return placeDetail(feature.properties.displayName, placeLabelFor(feature));
}

/** Exported for the windowing test: which slice of a list a given scroll position renders. */
export function resultsWindow(
  count: number,
  scrollTop: number,
  viewportHeight: number,
): { readonly first: number; readonly last: number } {
  const height = viewportHeight > 0 ? viewportHeight : RESULTS_ROW_HEIGHT * 12;
  const first = Math.max(0, Math.floor(scrollTop / RESULTS_ROW_HEIGHT) - OVERSCAN);
  const visible = Math.ceil(height / RESULTS_ROW_HEIGHT) + OVERSCAN * 2;
  return { first, last: Math.min(count, first + visible) };
}

export function ResultsRail({
  features,
  total,
  selectedId,
  onSelect,
  sort,
  onSortChange,
  savedIds,
  onToggleSave,
  onHide,
  constraints,
  emptyState,
  photos,
  onIntent,
  className,
}: ResultsRailProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setViewportHeight(scroller.clientHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setViewportHeight(scroller.clientHeight));
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const range = useMemo(
    () => resultsWindow(features.length, scrollTop, viewportHeight),
    [features.length, scrollTop, viewportHeight],
  );

  /** Keep the selected row reachable when selection comes from the map rather than a click. */
  useEffect(() => {
    if (!selectedId) return;
    const index = features.findIndex((feature) => feature.properties.entityId === selectedId);
    if (index < 0) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const top = index * RESULTS_ROW_HEIGHT;
    const bottom = top + RESULTS_ROW_HEIGHT;
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (bottom > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = bottom - scroller.clientHeight;
    }
  }, [features, selectedId]);

  const rows = features.slice(range.first, range.last);

  return (
    <section
      className={cx('ds-results', className)}
      aria-label="Records in view"
      onPointerEnter={onIntent}
      onFocus={onIntent}
    >
      <header className="ds-results__head">
        <h2 className="ds-results__title">Records</h2>
        <span className="ds-results__count">
          {features.length.toLocaleString('en-US')} of {total.toLocaleString('en-US')}
        </span>
        <button
          type="button"
          className="ds-results__sort"
          onClick={() => onSortChange(sort === 'oldest' ? 'newest' : 'oldest')}
          aria-label={`Sort order: ${sort === 'oldest' ? 'oldest first' : 'newest first'}`}
        >
          {sort === 'oldest' ? 'OLDEST' : 'NEWEST'}
        </button>
        {onHide ? (
          <button
            type="button"
            className="ds-results__hide"
            onClick={onHide}
            aria-label="Hide records"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 3.5 10.5 8 6 12.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </header>

      {constraints && constraints.length > 0 ? (
        <div className="ds-results__constraints" role="group" aria-label="Active constraints">
          {constraints.map((constraint) => (
            <button
              key={constraint.key}
              type="button"
              className="ds-results__constraint"
              onClick={constraint.onClear}
              aria-label={`Clear constraint: ${constraint.label}`}
            >
              {constraint.label}
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3.5 3.5l9 9m0-9-9 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ))}
        </div>
      ) : null}

      {features.length === 0 ? (
        <div className="ds-results__empty">{emptyState}</div>
      ) : (
        <div className="ds-results__scroller" ref={scrollerRef} onScroll={onScroll}>
          <div
            className="ds-results__list"
            role="listbox"
            aria-label="Records"
            style={{ height: `${features.length * RESULTS_ROW_HEIGHT}px` }}
          >
            {rows.map((feature, offset) => {
              const index = range.first + offset;
              const id = feature.properties.entityId;
              const selected = id === selectedId;
              const saved = savedIds?.has(id) ?? false;
              const grade = gradeForConfidence(feature.properties.confidenceTier);
              const photo = photos?.[id];

              return (
                <div
                  key={id}
                  role="option"
                  aria-selected={selected}
                  aria-posinset={index + 1}
                  aria-setsize={features.length}
                  tabIndex={selected ? 0 : -1}
                  className={cx(
                    'ds-results__row',
                    selected && 'ds-results__row--selected',
                    photo && 'ds-results__row--photo',
                  )}
                  data-grade={feature.properties.confidenceTier}
                  style={{ transform: `translateY(${index * RESULTS_ROW_HEIGHT}px)` }}
                  onClick={() => onSelect(feature)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect(feature);
                    }
                  }}
                >
                  {photo ? (
                    /*
                     * The thumbnail takes the glyph's column, not a new one: the row's anatomy
                     * stays `glyph · text · save` and its height stays fixed, which is what the
                     * windowing depends on. The kind is still stated in the meta line's glyph
                     * for the map, so the row loses no channel. Decorative: the name beside it
                     * is the accessible identity.
                     */
                    <span className="ds-results__thumb" aria-hidden="true">
                      {/* eslint-disable-next-line @next/next/no-img-element -- public CDN URL, the record's own photo */}
                      <img src={photo.url} alt="" loading="lazy" decoding="async" />
                    </span>
                  ) : (
                    <KindGlyph
                      kind={feature.properties.kind}
                      {...(feature.properties.mapTone
                        ? { mapTone: feature.properties.mapTone }
                        : {})}
                      size={13}
                      className="ds-results__glyph"
                    />
                  )}

                  <span className="ds-results__text">
                    <span className="ds-results__name">{feature.properties.displayName}</span>
                    <span className="ds-results__meta">
                      <span className="ds-results__place">{placeLabel(feature)}</span>
                      <span className="ds-results__sep" aria-hidden="true">
                        ·
                      </span>
                      <span className="ds-results__era">{eraLabel(feature)}</span>
                      {/*
                       * The grade is the record's assessment, not a third piece of metadata, so
                       * it leaves the middot chain and takes the right edge of the row. Down a
                       * scrolling rail the marks line up in one column a reader can read
                       * vertically; chained after "Undated ·" they read as trivia of equal
                       * weight to the era, which is what made this the weakest grade in the
                       * product once the sheet and the record page both grew a meter.
                       */}
                      <span className="ds-results__grade">
                        <RecordMeter
                          className="ds-results__grade-meter"
                          level={meterLevelForTier(feature.properties.confidenceTier)}
                          tone={feature.properties.confidenceTier}
                          label={gradeDescription(grade)}
                        />
                        <span className="ds-results__grade-letter" aria-hidden="true">
                          {gradeLabel(grade)}
                        </span>
                      </span>
                    </span>
                  </span>

                  {onToggleSave ? (
                    <button
                      type="button"
                      className={cx('ds-results__save', saved && 'ds-results__save--on')}
                      aria-pressed={saved}
                      aria-label={
                        saved
                          ? `Remove ${feature.properties.displayName} from saved`
                          : `Save ${feature.properties.displayName}`
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleSave(feature);
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M4 2.6h8a.6.6 0 0 1 .6.6v10.2L8 10.6l-4.6 2.8V3.2a.6.6 0 0 1 .6-.6Z"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinejoin="round"
                          fill={saved ? 'currentColor' : 'none'}
                        />
                      </svg>
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
