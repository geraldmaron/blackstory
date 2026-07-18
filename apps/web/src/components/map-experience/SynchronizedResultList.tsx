/**
 * The accessible list peer for the map — synchronized list is a full keyboard + screen-reader
 * peer with shared filter/viewport URL state (a peer, not an afterthought). Every item is a real
 * link to the entity page; selection state (`selectedId`) mirrors whatever point is open on the
 * map, in both directions — selecting a list item and selecting a map point produce the same
 * `onSelect` callback, so keyboard-only and screen-reader users reach every narrative off-ramp
 * the map offers without touching the canvas.
 *
 * Meta rows use a fixed labeled layout (Kind / Era / Confidence / Evidence / Where) so cards
 * stay uniform when optional fields are sparse — missing Where renders an em dash, never a
 * shifting slot order.
 */
import React from 'react';
import Link from 'next/link';
import { cx } from '@blap/ui';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';
import { ConfidenceMark } from './ConfidenceMark';
import { KindBadge } from './KindBadge';

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
    <ul className={cx('bp-result-list', 'bp-explore-result-list', className)} aria-labelledby={labelledBy}>
      {features.map((feature) => {
        const { properties } = feature;
        const isSelected = properties.entityId === selectedId;

        return (
          <li key={properties.entityId} className="bp-result-list__item">
            <Link
              className="bp-result-list__link"
              href={properties.href}
              aria-current={isSelected ? 'true' : undefined}
              data-entity-id={properties.entityId}
              {...(onSelect
                ? {
                    onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
                      // A synchronized selection (highlight on the map + open its narrative card)
                      // is a progressive enhancement over the always-working link navigation
                      // only intercept the click when a live map is actually mounted to react to it.
                      event.preventDefault();
                      onSelect(properties.entityId);
                    },
                  }
                : {})}
            >
              <h3 className="bp-result-list__title">{properties.displayName}</h3>
              <p className="bp-result-list__summary">{properties.oneLineStory}</p>
              <dl className="bp-result-list__meta bp-result-list__meta--labeled">
                <div className="bp-result-meta">
                  <dt>Kind</dt>
                  <dd>
                    <KindBadge
                      kind={properties.kind}
                      density="compact"
                      {...(properties.mapTone !== undefined ? { mapTone: properties.mapTone } : {})}
                    />
                  </dd>
                </div>
                <div className="bp-result-meta">
                  <dt>Era</dt>
                  <dd className="bp-mono">{eraLabel(properties.eraBuckets)}</dd>
                </div>
                <div className="bp-result-meta">
                  <dt>Confidence</dt>
                  <dd>
                    <ConfidenceMark tier={properties.confidenceTier} labeled className="bp-sans" />
                  </dd>
                </div>
                <div className="bp-result-meta">
                  <dt>Evidence</dt>
                  <dd className="bp-sans">
                    {properties.evidenceCount} claim{properties.evidenceCount === 1 ? '' : 's'}
                  </dd>
                </div>
                <div className="bp-result-meta">
                  <dt>Where</dt>
                  <dd className="bp-mono">{properties.statePostalCode ?? '—'}</dd>
                </div>
              </dl>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
