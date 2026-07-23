/**
 * Presentational record anatomy card (kind → name → story → facts → CTA). Explore mounts this
 * in the spotlight shell as a preview-first selection; the copper CTA is the off-ramp to the
 * full entity page. Close control floats on the card surface (absolute) so it does not steal
 * a layout row from kind/title. Also used for SSR smoke tests and any other compact record surface.
 */
import React from 'react';
import Link from 'next/link';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';
import { displayEncodingFor } from '../../lib/map-experience/kind-encoding';
import {
  entityEvidenceHref,
  exploreHrefForKind,
  searchHrefForStatus,
} from '../../lib/map-experience/metadata-hrefs';
import { entityEraFact } from '../../lib/map-experience/entity-era-facts';
import { exploreWhereMapsLink } from '../../lib/map-experience/explore-where-maps-link';
import { radiusAffordanceLabel } from '../../lib/map-experience/geo-precision';
import {
  RecordAnatomyPanel,
  type RecordAnatomyFact,
  type RecordAnatomyPlace,
} from '../patterns/RecordAnatomyPanel';
import {
  RecordBrowseControls,
  type RecordBrowseControlsProps,
} from '../patterns/RecordBrowseControls';
import { ConfidenceMark } from './ConfidenceMark';
import { KindBadge } from './KindBadge';
import { StatusMark } from './StatusMark';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source (same note as
// `@repo/ui`'s own components, e.g. MapExplorer.tsx).
void React;

export type NarrativeCardBrowseControlsProps = Omit<RecordBrowseControlsProps, 'className'>;

export type NarrativeCardProps = {
  readonly feature: ExploreMapFeature;
  readonly onClose?: () => void;
  readonly browseControls?: NarrativeCardBrowseControlsProps;
};

export function NarrativeCard({ feature, onClose, browseControls }: NarrativeCardProps) {
  const { properties } = feature;
  const kindEncoding = displayEncodingFor(properties.kind, properties.mapTone);
  const era = entityEraFact({
    eraBuckets: properties.eraBuckets,
  });
  const whereMaps = exploreWhereMapsLink(feature);
  const whereLabel = whereMaps?.label ?? 'Place withheld';
  const statusHref =
    properties.status !== undefined ? searchHrefForStatus(properties.status) : undefined;
  const evidenceLabel = `${properties.evidenceCount} accepted claim${properties.evidenceCount === 1 ? '' : 's'}`;
  const [lng, lat] = feature.geometry.coordinates;
  const mapPrecision = properties.precision as RecordAnatomyPlace['precision'];
  const anatomyPlace: RecordAnatomyPlace = {
    lat,
    lng,
    label: properties.displayName,
    precision: mapPrecision,
    precisionCaption: radiusAffordanceLabel(
      properties.geoPrecisionTier,
      properties.radiusMeters,
    ),
  };
  const kindIcon =
    properties.mapTone !== undefined
      ? { variant: 'record-kind' as const, kind: properties.kind, mapTone: properties.mapTone }
      : { variant: 'record-kind' as const, kind: properties.kind };
  const anatomyFacts: readonly RecordAnatomyFact[] = [
    {
      key: 'kind',
      label: 'Kind',
      value: (
        <Link
          className="ds-record-anatomy__fact-link"
          href={exploreHrefForKind(properties.kind)}
          aria-label={`Browse ${kindEncoding.label} records`}
        >
          {kindEncoding.label}
        </Link>
      ),
      icon: kindIcon,
    },
    {
      key: 'where',
      label: 'Where',
      value: whereLabel,
      icon: { variant: 'record-where' },
    },
    {
      key: 'era',
      label: 'Era',
      value: era.href ? (
        <Link
          className="ds-record-anatomy__fact-link"
          href={era.href}
          aria-label={`Browse records from the ${era.label}`}
        >
          {era.label}
        </Link>
      ) : (
        era.label
      ),
      icon: { variant: 'record-era' },
    },
    {
      key: 'evidence',
      label: 'Evidence',
      value: (
        <Link
          className="ds-record-anatomy__fact-link"
          href={entityEvidenceHref(properties.href)}
          aria-label={`View ${evidenceLabel} on full record`}
        >
          {evidenceLabel}
        </Link>
      ),
      icon: { variant: 'record-evidence', tier: properties.confidenceTier },
    },
  ];

  return (
    <article
      className="ds-nc"
      aria-labelledby="ds-nc-title"
      aria-describedby="ds-nc-story"
      tabIndex={-1}
      data-entity-id={properties.entityId}
    >
      {onClose ? (
        <button
          type="button"
          className="ds-nc__close"
          onClick={onClose}
          aria-label={`Close ${properties.displayName} card`}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : null}

      <p className="ds-nc__kicker">Selected record</p>

      {browseControls ? (
        <div className="ds-nc__browse-toolbar">
          <RecordBrowseControls {...browseControls} />
        </div>
      ) : null}

      <div className="ds-nc__top">
        <div className="ds-nc__kind-rule" style={{ borderColor: kindEncoding.shade }}>
          <Link
            className="ds-nc__kind-link"
            href={exploreHrefForKind(properties.kind)}
            aria-label={`Browse ${kindEncoding.label} records`}
          >
            <KindBadge
              kind={properties.kind}
              {...(properties.mapTone !== undefined ? { mapTone: properties.mapTone } : {})}
            />
          </Link>
        </div>
      </div>

      <h3 className="ds-nc__title" id="ds-nc-title">
        <Link className="ds-nc__title-link" href={properties.href} scroll={false}>
          {properties.displayName}
        </Link>
      </h3>
      <p className="ds-nc__story" id="ds-nc-story">
        {properties.oneLineStory}
      </p>

      <RecordAnatomyPanel facts={anatomyFacts} place={anatomyPlace} />

      <dl className="ds-nc__facts">
        <div className="ds-nc__fact">
          <dt>Confidence</dt>
          <dd>
            <ConfidenceMark tier={properties.confidenceTier} labeled />
          </dd>
        </div>
        <div className="ds-nc__fact">
          <dt>Status</dt>
          <dd>
            {properties.status ? (
              statusHref ? (
                <Link
                  className="ds-nc__fact-link"
                  href={statusHref}
                  aria-label={`Search records with status ${properties.status}`}
                >
                  <StatusMark status={properties.status} labeled />
                </Link>
              ) : (
                <StatusMark status={properties.status} labeled />
              )
            ) : (
              'Not stated'
            )}
          </dd>
        </div>
      </dl>

      {properties.topicTags.length > 0 ? (
        <p className="ds-nc__tags" aria-label="Topics">
          {properties.topicTags.slice(0, 2).map((tag) => (
            <Link
              key={tag}
              className="ds-entity-tag"
              href={`/history?topic=${encodeURIComponent(tag)}`}
            >
              {tag}
            </Link>
          ))}
        </p>
      ) : null}

      <Link className="ds-cta ds-cta--copper ds-nc__action" href={properties.href} scroll={false}>
        Open full record
      </Link>
    </article>
  );
}
