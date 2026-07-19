/**
 * The accessible list peer for the map. Rows are links to the entity record page — the same
 * destination as clicking a map pin. Selection highlighting (`selectedId` / `aria-current`)
 * mirrors the map copper ring when returning from “View on map” (`?selected=`).
 *
 * Meta rows use a fixed labeled layout (Kind / Era / Confidence / Evidence / Where)
 * so rows stay uniform when optional fields are sparse. Metadata values link to explore,
 * search, or entity anchors independently of the row’s primary select/open control.
 */
import React from 'react';
import Link from 'next/link';
import { cx } from '@repo/ui';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';
import { displayEncodingFor } from '../../lib/map-experience/kind-encoding';
import {
  entityEvidenceHref,
  eraFactLink,
  exploreHrefForKind,
  exploreHrefForState,
  searchHrefForStatus,
} from '../../lib/map-experience/metadata-hrefs';
import { ConfidenceMark } from './ConfidenceMark';
import { StatusMark } from './StatusMark';
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

type ResultRowMetaProps = {
  readonly feature: ExploreMapFeature;
};

function ResultRowMeta({ feature }: ResultRowMetaProps) {
  const { properties } = feature;
  const kindEncoding = displayEncodingFor(properties.kind, properties.mapTone);
  const era = eraFactLink(properties.eraBuckets);
  const statePostalCode = properties.statePostalCode?.trim().toUpperCase();
  const statusHref =
    properties.status !== undefined ? searchHrefForStatus(properties.status) : undefined;
  const evidenceLabel = `${properties.evidenceCount} accepted claim${properties.evidenceCount === 1 ? '' : 's'}`;

  return (
    <dl className="ds-result-list__meta ds-result-list__meta--labeled">
      <div className="ds-result-meta">
        <dt>Kind</dt>
        <dd>
          <Link
            className="ds-result-meta__link ds-result-meta__link--kind"
            href={exploreHrefForKind(properties.kind)}
            aria-label={`Browse ${kindEncoding.label} records`}
          >
            <KindBadge
              kind={properties.kind}
              density="compact"
              {...(properties.mapTone !== undefined ? { mapTone: properties.mapTone } : {})}
            />
          </Link>
        </dd>
      </div>
      <div className="ds-result-meta">
        <dt>Era</dt>
        <dd className="ds-mono">
          {era.href ? (
            <Link
              className="ds-result-meta__link"
              href={era.href}
              aria-label={`Browse records from the ${era.label}`}
            >
              {era.label}
            </Link>
          ) : (
            era.label
          )}
        </dd>
      </div>
      <div className="ds-result-meta">
        <dt>Confidence</dt>
        <dd>
          <ConfidenceMark tier={properties.confidenceTier} labeled className="ds-sans" />
        </dd>
      </div>
      <div className="ds-result-meta">
        <dt>Evidence</dt>
        <dd className="ds-sans">
          <Link
            className="ds-result-meta__link"
            href={entityEvidenceHref(properties.href)}
            aria-label={`View ${evidenceLabel} on full record`}
          >
            {evidenceLabel}
          </Link>
        </dd>
      </div>
      <div className="ds-result-meta">
        <dt>Where</dt>
        <dd className="ds-mono">
          {statePostalCode ? (
            <Link
              className="ds-result-meta__link"
              href={exploreHrefForState(statePostalCode)}
              aria-label={`View records in ${statePostalCode}`}
            >
              {statePostalCode}
            </Link>
          ) : (
            '—'
          )}
        </dd>
      </div>
      {properties.status !== undefined ? (
        <div className="ds-result-meta">
          <dt>Status</dt>
          <dd>
            {statusHref ? (
              <Link
                className="ds-result-meta__link"
                href={statusHref}
                aria-label={`Search records with status ${properties.status}`}
              >
                <StatusMark status={properties.status} labeled />
              </Link>
            ) : (
              <StatusMark status={properties.status} labeled />
            )}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

export function SynchronizedResultList({
  features,
  selectedId,
  labelledBy,
  className,
  onSelect,
}: SynchronizedResultListProps) {
  return (
    <ul
      className={cx('ds-result-list', 'ds-explore-result-list', className)}
      aria-labelledby={labelledBy}
    >
      {features.map((feature) => {
        const { properties } = feature;
        const isSelected = properties.entityId === selectedId;
        const primaryControlProps = {
          className: cx(
            'ds-result-list__link',
            onSelect ? 'ds-result-list__link--button' : undefined,
          ),
          'aria-current': isSelected ? ('true' as const) : undefined,
          'data-entity-id': properties.entityId,
        };

        return (
          <li
            key={properties.entityId}
            className={cx('ds-result-list__item', isSelected && 'ds-result-list__item--selected')}
          >
            {onSelect ? (
              <button
                type="button"
                {...primaryControlProps}
                onClick={() => onSelect(properties.entityId)}
              >
                <h3 className="ds-result-list__title">{properties.displayName}</h3>
                <p className="ds-result-list__summary">{properties.oneLineStory}</p>
              </button>
            ) : (
              <Link {...primaryControlProps} href={properties.href}>
                <h3 className="ds-result-list__title">{properties.displayName}</h3>
                <p className="ds-result-list__summary">{properties.oneLineStory}</p>
              </Link>
            )}
            <ResultRowMeta feature={feature} />
          </li>
        );
      })}
    </ul>
  );
}
