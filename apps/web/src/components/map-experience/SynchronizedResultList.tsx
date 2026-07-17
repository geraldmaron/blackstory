/**
 * The accessible list peer for the map — synchronized list is a full keyboard + screen-reader
 * peer with shared filter/viewport URL state (a peer, not an afterthought). Every item is a real
 * link to the entity page; selection state (`selectedId`) mirrors whatever point is open on the
 * map, in both directions — selecting a list item and selecting a map point produce the same
 * `onSelect` callback, so keyboard-only and screen-reader users reach every narrative off-ramp
 * the map offers without touching the canvas.
 */
import React from 'react';
import { cx } from '@black-book/ui';
import { CONFIDENCE_TIER_GLYPH } from '../../lib/map-experience/dignity-style';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type SynchronizedResultListProps = {
  readonly features: readonly ExploreMapFeature[];
  readonly selectedId?: string;
  readonly onSelect?: (entityId: string) => void;
  readonly labelledBy?: string;
  readonly className?: string;
};

function eraLabel(eraBuckets: readonly string[]): string {
  if (eraBuckets.length === 0) return 'Undated';
  if (eraBuckets.length === 1) return eraBuckets[0]!;
  return `${eraBuckets[0]} \u2013 ${eraBuckets[eraBuckets.length - 1]}`;
}

export function SynchronizedResultList({
  features,
  selectedId,
  onSelect,
  labelledBy,
  className,
}: SynchronizedResultListProps) {
  return (
    <ul className={cx('bb-result-list', 'bb-explore-result-list', className)} aria-labelledby={labelledBy}>
      {features.map((feature) => {
        const { properties } = feature;
        const isSelected = properties.entityId === selectedId;
        const glyph = CONFIDENCE_TIER_GLYPH[properties.confidenceTier] ?? CONFIDENCE_TIER_GLYPH.unrated;

        return (
          <li key={properties.entityId} className="bb-result-list__item">
            <a
              className="bb-result-list__link"
              href={properties.href}
              aria-current={isSelected ? 'true' : undefined}
              data-entity-id={properties.entityId}
              onClick={
                onSelect
                  ? (event) => {
                      // A synchronized selection (highlight on the map + open its narrative card)
                      // is a progressive enhancement over the always-working link navigation 
                      // only intercept the click when a live map is actually mounted to react to it.
                      event.preventDefault();
                      onSelect(properties.entityId);
                    }
                  : undefined
              }
            >
              <h3 className="bb-result-list__title">{properties.displayName}</h3>
              <p className="bb-result-list__summary">{properties.oneLineStory}</p>
              <div className="bb-result-list__meta">
                <span className="bb-mono">{properties.kind}</span>
                <span className="bb-mono">{eraLabel(properties.eraBuckets)}</span>
                <span className="bb-sans">
                  <span aria-hidden="true">{glyph}</span>{' '}
                  {properties.confidenceTier === 'unrated' ? 'Unrated' : `${properties.confidenceTier} confidence`}
                </span>
                <span className="bb-sans">
                  {properties.evidenceCount} claim{properties.evidenceCount === 1 ? '' : 's'}
                </span>
                {properties.statePostalCode ? (
                  <span className="bb-mono">{properties.statePostalCode}</span>
                ) : null}
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
