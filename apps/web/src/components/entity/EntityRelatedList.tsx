/**
 * Renders an entity's related-entry list from hydrated neighbor stubs (learning-index
 * 1-hop). Falls back to typed related edges with id-only copy when stubs are missing.
 * Never uses seed-only getPublicEntity for live-safe neighbor names.
 */

import React from 'react';
import Link from 'next/link';
import type { PublicEntityView, RelatedNeighborView } from '../../data/public-seed';
import { KindBadge } from '../map-experience';
import { EntityLinkDiscoveryHint, humanizeEntityId } from './EntityLink';
import { humanizeToken } from './format';
import { RecordGapNotice } from './RecordGapNotice';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type EntityRelatedListProps = {
  readonly entity: PublicEntityView;
  readonly labelledBy: string;
  /** When true, render continueLearning stubs instead of relatedNeighbors. */
  readonly continueLearning?: boolean;
  /** When true, show a muted note that record names link onward. */
  readonly showDiscoveryHint?: boolean;
};

function neighborLabelMap(entity: PublicEntityView): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const neighbor of [...(entity.relatedNeighbors ?? []), ...(entity.continueLearning ?? [])]) {
    if (neighbor.displayName.trim().length > 0) {
      map.set(neighbor.id, neighbor.displayName);
    }
  }
  return map;
}

function NeighborLink({ neighbor }: { readonly neighbor: RelatedNeighborView }) {
  return (
    <li key={`${neighbor.id}_${neighbor.relationType}_${neighbor.direction}`}>
      <Link className="ds-story-link" href={`/entity/${neighbor.id}`}>
        <span className="ds-story-link__meta">
          <span className="ds-story-link__meta-row">
            <KindBadge kind={neighbor.kind} density="compact" />
            <span aria-hidden="true">·</span>
            <span>{humanizeToken(neighbor.relationType)}</span>
          </span>
        </span>
        <h3 className="ds-story-link__title">{neighbor.displayName}</h3>
        <p className="ds-story-link__summary">
          {neighbor.summary.trim().length > 0
            ? neighbor.summary
            : `${humanizeToken(neighbor.relationType)} connection to this record.`}
        </p>
      </Link>
    </li>
  );
}

export function EntityRelatedList({
  entity,
  labelledBy,
  continueLearning = false,
  showDiscoveryHint = false,
}: EntityRelatedListProps) {
  const stubs = continueLearning
    ? (entity.continueLearning ?? [])
    : (entity.relatedNeighbors ?? []);

  if (stubs.length === 0 && !continueLearning) {
    const related = entity.related ?? [];
    if (related.length === 0) {
      return <RecordGapNotice kind="related" />;
    }
    const labels = neighborLabelMap(entity);
    return (
      <>
        {showDiscoveryHint ? <EntityLinkDiscoveryHint /> : null}
        <ul className="ds-story-rail" aria-labelledby={labelledBy}>
          {related.map((entry) => {
            const displayName = labels.get(entry.id) ?? humanizeEntityId(entry.id);
            return (
              <li key={`${entry.id}_${entry.type}`}>
                <Link className="ds-story-link" href={`/entity/${entry.id}`}>
                  <span className="ds-story-link__meta">{humanizeToken(entry.type)}</span>
                  <h3 className="ds-story-link__title">{displayName}</h3>
                  <p className="ds-story-link__summary">
                    Open this related record to continue learning.
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  if (stubs.length === 0) {
    return null;
  }

  return (
    <>
      {showDiscoveryHint ? <EntityLinkDiscoveryHint /> : null}
      <ul className="ds-story-rail" aria-labelledby={labelledBy}>
        {stubs.map((neighbor) => (
          <NeighborLink key={`${neighbor.id}_${neighbor.relationType}`} neighbor={neighbor} />
        ))}
      </ul>
    </>
  );
}
