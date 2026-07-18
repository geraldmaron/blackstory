/**
 * Data strip of published statistics with the shared source pattern: one group
 * footer when sources match across figures; compact per-item citations only for
 * unique extras. Replaces repeating full SOURCE boxes under every metric.
 */
import React, { type ReactNode } from 'react';
import {
  partitionStripSources,
  SourceFootnote,
  type DataSourceRef,
} from './SourceFootnote';

void React;

export type DataStatItem = {
  readonly id?: string;
  readonly value: string;
  readonly label: string;
  readonly note?: ReactNode;
  /** Sources that apply to this figure (hoisted to a group footer when identical). */
  readonly sources?: readonly DataSourceRef[];
};

export type DataStatStripProps = {
  readonly items: readonly DataStatItem[];
  /**
   * Explicit shared sources for the whole strip. When omitted, identical per-item
   * sources are auto-hoisted to the group footer.
   */
  readonly sources?: readonly DataSourceRef[];
  readonly labelledBy?: string;
};

export function DataStatStrip({ items, sources, labelledBy }: DataStatStripProps) {
  const partitioned = partitionStripSources({
    ...(sources !== undefined ? { groupSources: sources } : {}),
    itemSources: items.map((item) => item.sources),
  });

  return (
    <div className="ds-data-stat-strip">
      <ul className="ds-data-strip" {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}>
        {items.map((item, index) => {
          const extras = partitioned.itemExtras[index] ?? [];
          return (
            <li key={item.id ?? `${item.label}-${index}`} className="ds-data-strip__item">
              <span className="ds-data-strip__value">{item.value}</span>
              <span className="ds-data-strip__label">{item.label}</span>
              {item.note ? <p className="ds-data-strip__note ds-sans">{item.note}</p> : null}
              {extras.length > 0 ? <SourceFootnote sources={extras} density="compact" /> : null}
            </li>
          );
        })}
      </ul>
      {partitioned.groupSources.length > 0 ? (
        <SourceFootnote sources={partitioned.groupSources} density="group" />
      ) : null}
    </div>
  );
}
