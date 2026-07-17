/**
 * Narrative off-ramp card for a single selected map point: every point opens a card with
 * name, era, one-line story, evidence count, and confidence affordance linking to the entity
 * page. Purely presentational and SSR-render-safe — the map canvas and the synchronized list both
 * open the same card for the same feature, so the two experiences stay observably in sync.
 */
import React from 'react';
import { Card } from '@black-book/ui';
import { CONFIDENCE_TIER_GLYPH } from '../../lib/map-experience/dignity-style';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source (same note as
// `@black-book/ui`'s own components, e.g. MapExplorer.tsx).
void React;

export type NarrativeCardProps = {
  readonly feature: ExploreMapFeature;
  readonly onClose?: () => void;
};

function eraLabel(eraBuckets: readonly string[]): string {
  if (eraBuckets.length === 0) return 'Undated';
  if (eraBuckets.length === 1) return eraBuckets[0]!;
  return `${eraBuckets[0]} \u2013 ${eraBuckets[eraBuckets.length - 1]}`;
}

function radiusAffordanceLabel(feature: ExploreMapFeature): string {
  const { geoPrecisionTier, radiusMeters } = feature.properties;
  if (radiusMeters === undefined) {
    return `Shown at ${geoPrecisionTier} precision (radius affordance unavailable).`;
  }
  const km = radiusMeters / 1000;
  const distance = km >= 1 ? `${km.toFixed(km < 10 ? 1 : 0)} km` : `${Math.round(radiusMeters)} m`;
  return `Shown at ${geoPrecisionTier} precision \u2014 the marker represents a \u00b1${distance} area, not an exact address.`;
}

export function NarrativeCard({ feature, onClose }: NarrativeCardProps) {
  const { properties } = feature;
  const glyph = CONFIDENCE_TIER_GLYPH[properties.confidenceTier] ?? CONFIDENCE_TIER_GLYPH.unrated;

  return (
    <Card
      title={properties.displayName}
      meta={
        <>
          <span className="bb-mono">{properties.kind}</span>
          <span className="bb-mono">{eraLabel(properties.eraBuckets)}</span>
        </>
      }
      className="bb-explore-narrative-card"
    >
      {onClose ? (
        <button
          type="button"
          className="bb-button bb-button--secondary bb-explore-narrative-card__close"
          onClick={onClose}
          aria-label={`Close ${properties.displayName} card`}
        >
          Close
        </button>
      ) : null}

      <p className="bb-sans">{properties.oneLineStory}</p>

      {properties.topicTags.length > 0 ? (
        <p className="bb-explore-narrative-card__tags" aria-label="Topics">
          {properties.topicTags.slice(0, 2).map((tag) => (
            <a
              key={tag}
              className="bb-entity-tag"
              href={`/search?topic=${encodeURIComponent(tag)}`}
            >
              {tag}
            </a>
          ))}
        </p>
      ) : null}

      <dl className="bb-explore-narrative-card__facts">
        <div>
          <dt>Evidence</dt>
          <dd>
            {properties.evidenceCount} accepted claim{properties.evidenceCount === 1 ? '' : 's'}
          </dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>
            <span aria-hidden="true">{glyph}</span>{' '}
            {properties.confidenceTier === 'unrated' ? 'Unrated' : `${properties.confidenceTier} confidence`}
          </dd>
        </div>
        {properties.status ? (
          <div>
            <dt>Status</dt>
            <dd>{properties.status}</dd>
          </div>
        ) : null}
      </dl>

      <p className="bb-sans bb-explore-narrative-card__precision">{radiusAffordanceLabel(feature)}</p>

      <a className="bb-cta bb-cta--ink" href={properties.href}>
        Open full record
      </a>
    </Card>
  );
}
