/**
 * Learning-index topic and era chips, linking into the records index and the explore filters.
 *
 * Notability labels are deliberately not chips. They are rubric sentences ("The entity is a
 * documented site of a historically significant event of..."), and squeezing one into a chip
 * meant truncating it mid-word, so the record shipped a visibly cut-off sentence sitting in a
 * pill next to two one-word tags. The inclusion rationale is a sentence and renders as one, in
 * the record's rail; see `page.tsx`.
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
    return `/records?topic=${encodeURIComponent(value)}`;
  }
  return exploreHrefForEra(value);
}

export function EntityTopicTags({ entity }: EntityTopicTagsProps) {
  const themes = entity.topicTags ?? [];
  const eras = entity.eraBuckets ?? [];
  if (themes.length === 0 && eras.length === 0) {
    return null;
  }

  return (
    <div className="ds-entity-tags" role="group" aria-label="Topics and eras">
      {themes.map((tag) => (
        <Link
          key={`theme-${tag}`}
          className="ds-entity-tag"
          href={chipHref('theme', tag)}
          prefetch={false}
        >
          {tag}
        </Link>
      ))}
      {eras.map((era) => (
        <Link
          key={`era-${era}`}
          className="ds-entity-tag ds-entity-tag--era"
          href={chipHref('era', era)}
          prefetch={false}
        >
          {era}
        </Link>
      ))}
    </div>
  );
}
