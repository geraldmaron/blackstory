/**
 * Presentational record anatomy card (kind → name → story → facts → CTA). Explore mounts this
 * in the spotlight shell as a preview-first selection; the copper CTA is the off-ramp to the
 * full entity page. Also used for SSR smoke tests and any other compact record surface.
 */
import React from 'react';
import Link from 'next/link';
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
import { KindBadge } from './KindBadge';
import { StatusMark } from './StatusMark';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source (same note as
// `@repo/ui`'s own components, e.g. MapExplorer.tsx).
void React;

export type NarrativeCardProps = {
  readonly feature: ExploreMapFeature;
  readonly onClose?: () => void;
};

function radiusAffordanceLabel(feature: ExploreMapFeature): string {
  const { geoPrecisionTier, radiusMeters } = feature.properties;
  if (radiusMeters === undefined) {
    return `Shown at ${geoPrecisionTier} precision (radius affordance unavailable).`;
  }
  const km = radiusMeters / 1000;
  const distance = km >= 1 ? `${km.toFixed(km < 10 ? 1 : 0)} km` : `${Math.round(radiusMeters)} m`;
  return `Shown at ${geoPrecisionTier} precision — the marker represents a ±${distance} area, not an exact address.`;
}

export function NarrativeCard({ feature, onClose }: NarrativeCardProps) {
  const { properties } = feature;
  const kindEncoding = displayEncodingFor(properties.kind, properties.mapTone);
  const era = eraFactLink(properties.eraBuckets);
  const statePostalCode = properties.statePostalCode?.trim().toUpperCase();
  const statusHref =
    properties.status !== undefined ? searchHrefForStatus(properties.status) : undefined;
  const evidenceLabel = `${properties.evidenceCount} accepted claim${properties.evidenceCount === 1 ? '' : 's'}`;

  return (
    <article
      className="ds-nc"
      aria-labelledby="ds-nc-title"
      aria-describedby="ds-nc-story"
      tabIndex={-1}
      data-entity-id={properties.entityId}
    >
      <p className="ds-nc__kicker">Selected record</p>
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
      </div>

      <h3 className="ds-nc__title" id="ds-nc-title">
        <Link className="ds-nc__title-link" href={properties.href} scroll={false}>
          {properties.displayName}
        </Link>
      </h3>
      <p className="ds-nc__story" id="ds-nc-story">
        {properties.oneLineStory}
      </p>

      <dl className="ds-nc__facts">
        <div className="ds-nc__fact">
          <dt>Where</dt>
          <dd className="ds-mono">
            {statePostalCode ? (
              <Link
                className="ds-nc__fact-link"
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
        <div className="ds-nc__fact">
          <dt>Era</dt>
          <dd>
            {era.href ? (
              <Link
                className="ds-nc__fact-link"
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
        <div className="ds-nc__fact">
          <dt>Evidence</dt>
          <dd>
            <Link
              className="ds-nc__fact-link"
              href={entityEvidenceHref(properties.href)}
              aria-label={`View ${evidenceLabel} on full record`}
            >
              {evidenceLabel}
            </Link>
          </dd>
        </div>
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
              '—'
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
              href={`/search?topic=${encodeURIComponent(tag)}`}
            >
              {tag}
            </Link>
          ))}
        </p>
      ) : null}

      <p className="ds-nc__precision">{radiusAffordanceLabel(feature)}</p>

      <Link className="ds-cta ds-cta--copper ds-nc__action" href={properties.href} scroll={false}>
        Open full record
      </Link>
    </article>
  );
}
