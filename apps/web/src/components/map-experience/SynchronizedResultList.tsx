/**
 * The accessible list peer for the map. When `onSelect` is provided (explore), activating a
 * row focuses that record on the map and opens the narrative spotlight — the full entity page
 * stays one copper CTA away. Without `onSelect`, rows remain plain links (legacy/standalone).
 *
 * Selection highlighting (`selectedId` / `aria-current`) mirrors the map when a point is open.
 *
 * Meta rows use a fixed labeled layout (Kind / Era / Confidence / Evidence / Where)
 * so cards stay uniform when optional fields are sparse.
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
  readonly labelledBy?: string;
  readonly className?: string;
  /** When set, list rows select the map record instead of navigating away. */
  readonly onSelect?: (entityId: string) => void;
};

function eraLabel(eraBuckets: readonly string[]): string {
  if (eraBuckets.length === 0) return 'Undated';
  if (eraBuckets.length === 1) return eraBuckets[0]!;
  return `${eraBuckets[0]} \u2013 ${eraBuckets[eraBuckets.length - 1]}`;
}

export function SynchronizedResultList({
  features,
  selectedId,
  labelledBy,
  className,
  onSelect,
}: SynchronizedResultListProps) {
  return (
    <ul className={cx('bp-result-list', 'bp-explore-result-list', className)} aria-labelledby={labelledBy}>
      {features.map((feature) => {
        const { properties } = feature;
        const isSelected = properties.entityId === selectedId;
        const body = (
          <>
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
          </>
        );

        return (
          <li
            key={properties.entityId}
            className={cx('bp-result-list__item', isSelected && 'bp-result-list__item--selected')}
          >
            {onSelect ? (
              <button
                type="button"
                className="bp-result-list__link bp-result-list__link--button"
                aria-current={isSelected ? 'true' : undefined}
                data-entity-id={properties.entityId}
                onClick={() => onSelect(properties.entityId)}
              >
                {body}
              </button>
            ) : (
              <Link
                className="bp-result-list__link"
                href={properties.href}
                aria-current={isSelected ? 'true' : undefined}
                data-entity-id={properties.entityId}
              >
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
