/**
 * Edge citation panel for progressive disclosure exposes relationship evidence within
 * two interactions (select edge → view citations). No evidence-free connection renders in the
 * graph slice builder; this panel surfaces the backing citations for the selected edge.
 */
import React from 'react';
import { Card } from '@black-book/ui';
import type { HistoryEdgeView } from '../../lib/history/build-history-graph';

void React;

export type HistoryEdgePanelProps = {
  readonly edge: HistoryEdgeView;
  readonly onClose?: () => void;
};

export function HistoryEdgePanel({ edge, onClose }: HistoryEdgePanelProps) {
  return (
    <Card title="Documented connection" meta={<span className="bb-mono">{edge.type.replaceAll('_', ' ')}</span>}>
      {onClose ? (
        <button
          type="button"
          className="bb-button bb-button--secondary bb-history-edge-panel__close"
          onClick={onClose}
          aria-label="Close connection details"
        >
          Close
        </button>
      ) : null}

      <p className="bb-sans">{edge.sentence}</p>

      {edge.timespan?.validFrom ? (
        <p className="bb-sans bb-history-edge-panel__timespan">
          Documented from {edge.timespan.validFrom}
          {edge.timespan.validTo ? ` through ${edge.timespan.validTo}` : ', ongoing'}.
        </p>
      ) : null}

      <section aria-label="Supporting citations">
        <h3 className="bb-section__kicker">Citations ({edge.evidenceCount})</h3>
        <ol className="bb-qualify-list">
          {edge.citations.map((citation) => (
            <li key={citation.id}>
              {citation.href ? (
                <a href={citation.href} className="bb-cta bb-cta--ghost">
                  {citation.label}
                </a>
              ) : (
                <span className="bb-sans">{citation.label}</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className="bb-history-edge-panel__endpoints">
        <a className="bb-cta bb-cta--ghost" href={`/entity/${edge.fromEntityId}`}>
          {edge.fromDisplayName}
        </a>
        <span aria-hidden="true">↔</span>
        <a className="bb-cta bb-cta--ghost" href={`/entity/${edge.toEntityId}`}>
          {edge.toDisplayName}
        </a>
      </div>
    </Card>
  );
}
