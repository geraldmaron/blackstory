/**
 * Synchronized list peer for `/history`. Every item is a real link to the entity
 * page — click/activate always navigates. Selection highlighting still mirrors
 * the graph when a node is open; graph visualization can select without blocking
 * list navigation to the full record.
 */
import React from 'react';
import Link from 'next/link';
import { cx } from '@repo/ui';
import type { HistoryNodeView } from '../../lib/history/build-history-graph';
import { HistoryRipRow } from './HistoryRipRow';

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
    <ul
      className={cx('ds-result-list', 'ds-history-result-list', className)}
      aria-labelledby={labelledBy}
    >
      {nodes.map((node) => {
        const isSelected = node.entityId === selectedId;

        return (
          <li
            key={node.entityId}
            className={cx(
              'ds-result-list__item',
              isSelected && 'ds-history-result-list__item--selected',
              isSelected && 'ds-result-list__item--selected',
            )}
          >
            <Link
              className="ds-history-result-list__row-link"
              href={node.href}
              aria-current={isSelected ? 'true' : undefined}
              data-entity-id={node.entityId}
            >
              <HistoryRipRow node={node} isSelected={isSelected} embeddedInRowLink />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
