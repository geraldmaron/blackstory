/**
 * Edge citation panel for progressive disclosure exposes relationship evidence within
 * two interactions (select edge → view citations). No evidence-free connection renders in the
 * graph slice builder; this panel surfaces the backing citations for the selected edge.
 */
import React from 'react';
import Link from 'next/link';
import { Card } from '@repo/ui';
import type { HistoryEdgeView } from '../../lib/history/build-history-graph';

void React;

export type HistoryEdgePanelProps = {
  readonly edge: HistoryEdgeView;
  readonly onClose?: () => void;
};

export function HistoryEdgePanel({ edge, onClose }: HistoryEdgePanelProps) {
  return (
    <Card title="Documented connection" meta={<span className="ds-mono">{edge.type.replaceAll('_', ' ')}</span>}>
      {onClose ? (
        <button
          type="button"
          className="ds-button ds-button--secondary ds-history-edge-panel__close"
          onClick={onClose}
          aria-label="Close connection details"
        >
          Close
        </button>
      ) : null}

      <p className="ds-sans">{edge.sentence}</p>

      {edge.timespan?.validFrom ? (
        <p className="ds-sans ds-history-edge-panel__timespan">
          Documented from {edge.timespan.validFrom}
          {edge.timespan.validTo ? ` through ${edge.timespan.validTo}` : ', ongoing'}.
        </p>
      ) : null}

      <section aria-label="Supporting citations">
        <h3 className="ds-section__kicker">Citations ({edge.evidenceCount})</h3>
        <ol className="ds-qualify-list">
          {edge.citations.map((citation) => (
            <li key={citation.id}>
              {citation.href ? (
                <a href={citation.href} className="ds-cta ds-cta--ghost">
                  {citation.label}
                </a>
              ) : (
                <span className="ds-sans">{citation.label}</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className="ds-history-edge-panel__endpoints">
        <Link className="ds-cta ds-cta--ghost" href={`/entity/${edge.fromEntityId}`}>
          {edge.fromDisplayName}
        </Link>
        <span aria-hidden="true">↔</span>
        <Link className="ds-cta ds-cta--ghost" href={`/entity/${edge.toEntityId}`}>
          {edge.toDisplayName}
        </Link>
      </div>
    </Card>
  );
}
