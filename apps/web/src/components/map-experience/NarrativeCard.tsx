/**
 * Narrative off-ramp card for a single selected map point. Anatomy follows the
 * cognitive-accessibility law (design-direction-v5 §v5.1): one consistent record
 * order everywhere — kind slug → name → one-line story → labeled facts → tags →
 * precision note → single action. Every fact carries a literal label (Era,
 * Evidence, Confidence, Status); nothing is inferred from position or glued
 * together. Close is a small icon key in the top corner, not a competing action.
 * Purely presentational and SSR-render-safe — the map canvas and the
 * synchronized list both open the same card for the same feature.
 */
import React from 'react';
import Link from 'next/link';
import { CONFIDENCE_TIER_GLYPH } from '../../lib/map-experience/dignity-style';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source (same note as
// `@blap/ui`'s own components, e.g. MapExplorer.tsx).
void React;

export type NarrativeCardProps = {
  readonly feature: ExploreMapFeature;
  readonly onClose?: () => void;
};

function eraLabel(eraBuckets: readonly string[]): string {
  if (eraBuckets.length === 0) return 'Undated';
  if (eraBuckets.length === 1) return eraBuckets[0]!;
  return `${eraBuckets[0]} – ${eraBuckets[eraBuckets.length - 1]}`;
}

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
  const glyph = CONFIDENCE_TIER_GLYPH[properties.confidenceTier] ?? CONFIDENCE_TIER_GLYPH.unrated;

  return (
    <article className="bp-nc" aria-label={properties.displayName}>
      <div className="bp-nc__top">
        <p className="bp-nc__slug">{properties.kind}</p>
        {onClose ? (
          <button
            type="button"
            className="bp-nc__close"
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

      <h3 className="bp-nc__title">{properties.displayName}</h3>
      <p className="bp-nc__story">{properties.oneLineStory}</p>

      <dl className="bp-nc__facts">
        <div className="bp-nc__fact">
          <dt>Era</dt>
          <dd>{eraLabel(properties.eraBuckets)}</dd>
        </div>
        <div className="bp-nc__fact">
          <dt>Evidence</dt>
          <dd>
            {properties.evidenceCount} accepted claim{properties.evidenceCount === 1 ? '' : 's'}
          </dd>
        </div>
        <div className="bp-nc__fact">
          <dt>Confidence</dt>
          <dd>
            <span aria-hidden="true">{glyph}</span>{' '}
            {properties.confidenceTier === 'unrated' ? 'Unrated' : `${properties.confidenceTier} confidence`}
          </dd>
        </div>
        {properties.status ? (
          <div className="bp-nc__fact">
            <dt>Status</dt>
            <dd>{properties.status}</dd>
          </div>
        ) : null}
      </dl>

      {properties.topicTags.length > 0 ? (
        <p className="bp-nc__tags" aria-label="Topics">
          {properties.topicTags.slice(0, 2).map((tag) => (
            <Link
              key={tag}
              className="bp-entity-tag"
              href={`/search?topic=${encodeURIComponent(tag)}`}
            >
              {tag}
            </Link>
          ))}
        </p>
      ) : null}

      <p className="bp-nc__precision">{radiusAffordanceLabel(feature)}</p>

      <a className="bp-cta bp-cta--copper bp-nc__action" href={properties.href}>
        Open full record
      </a>
    </article>
  );
}
