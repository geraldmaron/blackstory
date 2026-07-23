/**
 * Learning-index topic / era / notability chips linking into history and explore filters.
 */
import React from 'react';
import Link from 'next/link';
import type { PublicEntityView } from '../../data/public-seed';
import { exploreHrefForEra } from '../../lib/map-experience/metadata-hrefs';

void React;

export type EntityTopicTagsProps = {
  readonly entity: PublicEntityView;
};

function chipHref(kind: 'theme' | 'era', value: string): string {
  if (kind === 'theme') {
    return `/history?topic=${encodeURIComponent(value)}`;
  }
  return exploreHrefForEra(value);
}

export function EntityTopicTags({ entity }: EntityTopicTagsProps) {
  const themes = entity.topicTags ?? [];
  const eras = entity.eraBuckets ?? [];
  const notability = entity.notabilityLabels ?? [];

  if (themes.length === 0 && eras.length === 0 && notability.length === 0) {
    return null;
  }

  return (
    <div className="ds-entity-tags" role="group" aria-label="Topics and eras">
      {themes.map((tag) => (
        <Link key={`theme-${tag}`} className="ds-entity-tag" href={chipHref('theme', tag)}>
          {tag}
        </Link>
      ))}
      {eras.map((era) => (
        <Link
          key={`era-${era}`}
          className="ds-entity-tag ds-entity-tag--era"
          href={chipHref('era', era)}
        >
          {era}
        </Link>
      ))}
      {notability.slice(0, 2).map((label) => (
        <span key={`note-${label.slice(0, 24)}`} className="ds-entity-tag ds-entity-tag--note">
          {label.length > 72 ? `${label.slice(0, 69)}…` : label}
        </span>
      ))}
    </div>
  );
}
