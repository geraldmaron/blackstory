/**
 * Synchronized list peer for `/history`. Every item links to the
 * entity page; selection state mirrors the graph panel and narrative card. Keyboard and
 * screen-reader users reach every node and edge off-ramp without relying on the graph visualization.
 */
import React from 'react';
import { cx } from '@black-book/ui';
import type { HistoryNodeView } from '../../lib/history/build-history-graph';

void React;

export type HistoryResultListProps = {
  readonly nodes: readonly HistoryNodeView[];
  readonly selectedId?: string;
  readonly onSelect?: (entityId: string) => void;
  readonly labelledBy?: string;
  readonly className?: string;
};

export function HistoryResultList({
  nodes,
  selectedId,
  onSelect,
  labelledBy,
  className,
}: HistoryResultListProps) {
  return (
    <ul className={cx('bb-result-list', 'bb-history-result-list', className)} aria-labelledby={labelledBy}>
      {nodes.map((node) => {
        const isSelected = node.entityId === selectedId;

        return (
          <li key={node.entityId} className="bb-result-list__item">
            <a
              className="bb-result-list__link"
              href={node.href}
              aria-current={isSelected ? 'true' : undefined}
              data-entity-id={node.entityId}
              onClick={
                onSelect
                  ? (event) => {
                      event.preventDefault();
                      onSelect(node.entityId);
                    }
                  : undefined
              }
            >
              <h3 className="bb-result-list__title">{node.displayName}</h3>
              <p className="bb-result-list__summary">{node.summary}</p>
              <div className="bb-result-list__meta">
                <span className="bb-mono">{node.kind}</span>
                <span className="bb-sans">{node.statusLabel}</span>
                <span className="bb-sans">
                  {node.evidenceCount} claim{node.evidenceCount === 1 ? '' : 's'}
                </span>
              </div>
              {node.factLinks.length > 0 ? (
                <p className="bb-sans bb-history-result-list__facts">
                  Related fact{node.factLinks.length === 1 ? '' : 's'}:{' '}
                  {node.factLinks.map((fact, index) => (
                    <React.Fragment key={fact.href}>
                      {index > 0 ? ', ' : null}
                      <a className="bb-cta bb-cta--ghost" href={fact.href}>
                        {fact.label}
                      </a>
                    </React.Fragment>
                  ))}
                </p>
              ) : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
