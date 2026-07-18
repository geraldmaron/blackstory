/**
 * Synchronized list peer for `/history`. Every item is a real link to the entity
 * page — click/activate always navigates. Selection highlighting still mirrors
 * the graph when a node is open; graph visualization can select without blocking
 * list navigation to the full record.
 */
import React from 'react';
import { cx } from '@blap/ui';
import type { HistoryNodeView } from '../../lib/history/build-history-graph';

void React;

export type HistoryResultListProps = {
  readonly nodes: readonly HistoryNodeView[];
  readonly selectedId?: string;
  readonly labelledBy?: string;
  readonly className?: string;
};

export function HistoryResultList({
  nodes,
  selectedId,
  labelledBy,
  className,
}: HistoryResultListProps) {
  return (
    <ul className={cx('bp-result-list', 'bp-history-result-list', className)} aria-labelledby={labelledBy}>
      {nodes.map((node) => {
        const isSelected = node.entityId === selectedId;

        return (
          <li key={node.entityId} className="bp-result-list__item">
            <a
              className="bp-result-list__link"
              href={node.href}
              aria-current={isSelected ? 'true' : undefined}
              data-entity-id={node.entityId}
            >
              <h3 className="bp-result-list__title">{node.displayName}</h3>
              <p className="bp-result-list__summary">{node.summary}</p>
              <div className="bp-result-list__meta">
                <span className="bp-mono">{node.kind}</span>
                <span className="bp-sans">{node.statusLabel}</span>
                <span className="bp-sans">
                  {node.evidenceCount} claim{node.evidenceCount === 1 ? '' : 's'}
                </span>
              </div>
            </a>
            {/* Sibling of the entity link, never inside it — nested <a> is
                invalid HTML and hydration-breaks. Plain inline links, not
                CTA pills: these are references, not actions. */}
            {node.factLinks.length > 0 ? (
              <p className="bp-sans bp-history-result-list__facts">
                Related fact{node.factLinks.length === 1 ? '' : 's'}:{' '}
                {node.factLinks.map((fact, index) => (
                  <React.Fragment key={fact.href}>
                    {index > 0 ? ', ' : null}
                    <a className="bp-history-result-list__fact-link" href={fact.href}>
                      {fact.label}
                    </a>
                  </React.Fragment>
                ))}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
