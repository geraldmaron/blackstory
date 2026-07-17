/**
 * Renders an entity's BB-092 related-entry list (typed, time-scoped graph edges), never the
 * deprecated hand-authored `relatedIds`. Each item's description is built from the same
 * `relationshipSentence` helper the graph-driven timeline uses (`../../data/entity-graph-seed.ts`),
 * so the "Related" and "Timeline" sections never describe the same edge two different ways.
 */

import React from 'react';
import { relationshipSentence } from '../../data/entity-graph-seed';
import { getPublicEntity, type PublicEntityView } from '../../data/public-seed';
import { humanizeToken } from './format';
import { RecordGapNotice } from './RecordGapNotice';

export type EntityRelatedListProps = {
  readonly entity: PublicEntityView;
  readonly labelledBy: string;
};

export function EntityRelatedList({ entity, labelledBy }: EntityRelatedListProps) {
  const related = entity.related ?? [];
  if (related.length === 0) {
    return <RecordGapNotice kind="related" />;
  }

  return (
    <ul className="bb-story-rail" aria-labelledby={labelledBy}>
      {related.map((entry) => {
        const neighbor: PublicEntityView | undefined = getPublicEntity(entry.id);
        const neighborName = neighbor?.displayName ?? entry.id;
        const sentence = relationshipSentence(entry, entity.displayName, neighborName);
        return (
          <li key={`${entry.id}_${entry.type}`}>
            {neighbor ? (
              <a className="bb-story-link" href={`/entity/${neighbor.id}`}>
                <span className="bb-story-link__meta">
                  {neighbor.kind} · {humanizeToken(entry.type)}
                </span>
                <h3 className="bb-story-link__title">{neighbor.displayName}</h3>
                <p className="bb-story-link__summary">{sentence}</p>
              </a>
            ) : (
              <div className="bb-story-link">
                <span className="bb-story-link__meta">{humanizeToken(entry.type)}</span>
                <p className="bb-story-link__summary">{sentence}</p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
