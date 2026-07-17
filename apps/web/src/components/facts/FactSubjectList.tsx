/**
 * Renders typed `subjects` edges from a fact to CanonicalEntity records.
 *
 * Each subject links to the entity detail page when the id is known in the seed catalog. The list
 * documents that these edges are also graph-view input for (mirrored into synthetic `cites`
 * relationships at publish time see `packages/domain/src/facts/subjects.ts`).
 */
import React from 'react';
import type { FactRecord } from '@black-book/domain';
import { humanizeToken } from './format';

export type FactSubjectListProps = {
  readonly subjects: FactRecord['subjects'];
  readonly labelledBy?: string;
};

export function FactSubjectList({ subjects, labelledBy }: FactSubjectListProps) {
  return (
    <section {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}>
      <ul className="bb-stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {subjects.map((subject) => (
          <li key={`${subject.entityId}_${subject.kind}`}>
            <a className="bb-cta bb-cta--ink" href={`/entity/${subject.entityId}`}>
              {subject.entityId}
            </a>
            <span className="bb-sans" style={{ marginLeft: 'var(--bb-space-2)', color: 'var(--bb-ink-muted)' }}>
              {humanizeToken(subject.kind)}
              {subject.role ? ` · ${humanizeToken(subject.role)}` : ''}
            </span>
          </li>
        ))}
      </ul>
      <p className="bb-sans" style={{ margin: 'var(--bb-space-3) 0 0 0', color: 'var(--bb-ink-muted)' }}>
        These subject edges feed the published history graph (BB-092) — mirrored into browse-graph
        relationships at publish time so fact-only entity linkages are not silently absent.
      </p>
    </section>
  );
}
