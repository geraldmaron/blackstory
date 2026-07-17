/**
 * Renders an entity's related-entry list from hydrated neighbor stubs (learning-index
 * 1-hop). Falls back to typed related edges with id-only copy when stubs are missing.
 * Never uses seed-only getPublicEntity for live-safe neighbor names.
 */

import React from 'react';
import type { PublicEntityView, RelatedNeighborView } from '../../data/public-seed';
import { humanizeToken } from './format';
import { RecordGapNotice } from './RecordGapNotice';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type EntityRelatedListProps = {
  readonly entity: PublicEntityView;
  readonly labelledBy: string;
  /** When true, render continueLearning stubs instead of relatedNeighbors. */
  readonly continueLearning?: boolean;
};

function NeighborLink({ neighbor }: { readonly neighbor: RelatedNeighborView }) {
  return (
    <li key={`${neighbor.id}_${neighbor.relationType}_${neighbor.direction}`}>
      <a className="bb-story-link" href={`/entity/${neighbor.id}`}>
        <span className="bb-story-link__meta">
          {neighbor.kind} · {humanizeToken(neighbor.relationType)}
        </span>
        <h3 className="bb-story-link__title">{neighbor.displayName}</h3>
        <p className="bb-story-link__summary">
          {neighbor.summary.trim().length > 0
            ? neighbor.summary
            : `${humanizeToken(neighbor.relationType)} connection to this record.`}
        </p>
      </a>
    </li>
  );
}

export function EntityRelatedList({
  entity,
  labelledBy,
  continueLearning = false,
}: EntityRelatedListProps) {
  const stubs = continueLearning
    ? (entity.continueLearning ?? [])
    : (entity.relatedNeighbors ?? []);

  if (stubs.length === 0 && !continueLearning) {
    const related = entity.related ?? [];
    if (related.length === 0) {
      return <RecordGapNotice kind="related" />;
    }
    return (
      <ul className="bb-story-rail" aria-labelledby={labelledBy}>
        {related.map((entry) => (
          <li key={`${entry.id}_${entry.type}`}>
            <a className="bb-story-link" href={`/entity/${entry.id}`}>
              <span className="bb-story-link__meta">{humanizeToken(entry.type)}</span>
              <h3 className="bb-story-link__title">{entry.id}</h3>
              <p className="bb-story-link__summary">
                Open this related record to continue learning.
              </p>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  if (stubs.length === 0) {
    return null;
  }

  return (
    <ul className="bb-story-rail" aria-labelledby={labelledBy}>
      {stubs.map((neighbor) => (
        <NeighborLink key={`${neighbor.id}_${neighbor.relationType}`} neighbor={neighbor} />
      ))}
    </ul>
  );
}
