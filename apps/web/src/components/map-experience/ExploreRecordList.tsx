/**
 * The record list in the Explore column: the register row, windowed.
 *
 * Windowed on purpose: the column carries the whole archive (thousands of rows) inside one fixed
 * scroller and renders only the rows in view plus a small overscan. Windowing and
 * `role="listbox"` are in tension, because assistive tech counts the options it can see, so
 * `aria-setsize` and `aria-posinset` carry the real position and total on every rendered option.
 *
 * Row anatomy follows the Records register (two lines, 1px rules between rows). Line one: the
 * name, and its documented decade in mono at the right (the earliest, or under a brushed range the
 * first one inside it). Line two: the kind as a word and the place, and the grade letter with its
 * source count at the right. Every row is the same height, which is what the windowing depends on.
 */
'use client';

import { KindGlyph } from './KindGlyph';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@repo/ui';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';
import {
  gradeDescription,
  gradeForConfidence,
  gradeLabel,
} from '../../lib/map-experience/evidence-grade';
import { placeDetail, placeLabelFor } from '../../lib/map-experience/place-label';
import { rowDecadeLabel } from '../../lib/map-experience/explore-rows';
import type { CollectionPeriod } from '../../lib/discovery/collection-period';
import { kindLabelForMark } from '../entity/record-mark';
import { usePhotos } from '../../lib/map-experience/use-photo-index';
import './explore-record-list.css';

void React;

/** Fixed row height (explore-record-list.css). Windowing needs a known row box. */
export const RESULTS_ROW_HEIGHT = 68;
/** Rows rendered above and below the viewport so a fast scroll does not show blank space. */
const OVERSCAN = 6;

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

/** "A · 3 sources". The letter alone when the record carries no counted source. */
export function gradeWithSources(
  confidenceTier: Parameters<typeof gradeForConfidence>[0],
  evidenceCount: number,
): string {
  const letter = gradeLabel(gradeForConfidence(confidenceTier));
  if (!(evidenceCount > 0)) return letter;
  return `${letter} · ${evidenceCount.toLocaleString('en-US')} ${evidenceCount === 1 ? 'source' : 'sources'}`;
}

export type ExploreRecordListProps = {
  readonly features: readonly ExploreMapFeature[];
  readonly selectedId?: string | undefined;
  readonly onSelect: (feature: ExploreMapFeature) => void;
  /** Distance text per entity id ("0.4 mi") while a place is located. */
  readonly distanceLabels?: ReadonlyMap<string, string> | null;
  /** Rendered in place of the list when nothing matches. Never a bare "no results". */
  readonly emptyState?: React.ReactNode;
  /** The brushed decade range: each row then shows its first decade inside it. */
  readonly period?: CollectionPeriod | undefined;
  /**
   * The photo route (`/atlas/photos`): only the rows in view are asked for (`usePhotos`). A row
   * without a photo shows a sand tile with its kind glyph. Omitted until the map has painted.
   */
  readonly photosUrl?: string | undefined;
  readonly className?: string;
};

export function ExploreRecordList({
  features,
  selectedId,
  onSelect,
  distanceLabels,
  emptyState,
  period,
  className,
  photosUrl,
}: ExploreRecordListProps) {
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
  }, [features.length === 0]);

  // A new set of records starts at its top, not wherever the last one was scrolled to.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = 0;
    setScrollTop(0);
  }, [features]);

  const range = useMemo(
    () => resultsWindow(features.length, scrollTop, viewportHeight),
    [features.length, scrollTop, viewportHeight],
  );

  const visibleIds = features
    .slice(range.first, range.last)
    .map((feature) => feature.properties.entityId);
  const photos = usePhotos(photosUrl ?? '', photosUrl ? visibleIds : []);

  /** Keep the selected row in view when the selection comes from the map rather than a click. */
  useEffect(() => {
    if (!selectedId) return;
    const index = features.findIndex((feature) => feature.properties.entityId === selectedId);
    const scroller = scrollerRef.current;
    if (index < 0 || !scroller) return;
    const top = index * RESULTS_ROW_HEIGHT;
    const bottom = top + RESULTS_ROW_HEIGHT;
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (bottom > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = bottom - scroller.clientHeight;
    }
  }, [features, selectedId]);

  if (features.length === 0) {
    return <div className={cx('ds-xlist', 'ds-xlist--empty', className)}>{emptyState}</div>;
  }

  const rows = features.slice(range.first, range.last);
  const focusIndex = Math.max(
    0,
    features.findIndex((feature) => feature.properties.entityId === selectedId),
  );

  return (
    <div className={cx('ds-xlist', className)} ref={scrollerRef} onScroll={onScroll}>
      <div
        className="ds-xlist__rows"
        role="listbox"
        aria-label="Records"
        style={{ height: `${features.length * RESULTS_ROW_HEIGHT}px` }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          const current = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]');
          const sibling =
            event.key === 'ArrowDown'
              ? current?.nextElementSibling
              : current?.previousElementSibling;
          if (sibling instanceof HTMLElement) {
            event.preventDefault();
            sibling.focus();
          }
        }}
      >
        {rows.map((feature, offset) => {
          const index = range.first + offset;
          const { properties } = feature;
          const id = properties.entityId;
          const selected = id === selectedId;
          const distance = distanceLabels?.get(id);
          const kind = kindLabelForMark(properties.kind) ?? 'Record';
          const place = placeDetail(properties.displayName, placeLabelFor(feature));
          const grade = gradeForConfidence(properties.confidenceTier);

          return (
            <div
              key={id}
              role="option"
              aria-selected={selected}
              aria-posinset={index + 1}
              aria-setsize={features.length}
              tabIndex={index === focusIndex ? 0 : -1}
              className={cx('ds-xlist__row', selected && 'ds-xlist__row--selected')}
              style={{ transform: `translateY(${index * RESULTS_ROW_HEIGHT}px)` }}
              onClick={() => onSelect(feature)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(feature);
                }
              }}
            >
              <span className="ds-xlist__thumb" aria-hidden="true">
                {photos[id]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote Commons thumbnail
                  <img src={photos[id]!.url} alt="" loading="lazy" decoding="async" />
                ) : (
                  <KindGlyph kind={properties.kind} size={18} />
                )}
              </span>
              <span className="ds-xlist__line">
                <span className="ds-xlist__name">{properties.displayName}</span>
                <span className="ds-xlist__decade">
                  {rowDecadeLabel(properties.eraBuckets, period)}
                </span>
              </span>
              <span className="ds-xlist__line">
                <span className="ds-xlist__meta">
                  {distance ? `${distance} · ` : ''}
                  {kind}
                  {place ? ` · ${place}` : ''}
                </span>
                <span className="ds-xlist__grade" title={gradeDescription(grade)}>
                  {gradeWithSources(properties.confidenceTier, properties.evidenceCount)}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
