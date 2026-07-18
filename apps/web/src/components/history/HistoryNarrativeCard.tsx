/**
 * Narrative off-ramp card for a selected history graph node. Mirrors 
 * `NarrativeCard` name, kind, status-as-of-decade, evidence count, and links to the entity page
 * and any published facts.
 */
import React from 'react';
import { Card } from '@blap/ui';
import type { HistoryNodeView } from '../../lib/history/build-history-graph';

void React;

export type HistoryNarrativeCardProps = {
  readonly node: HistoryNodeView;
  readonly decadeLabel?: string;
  readonly onClose?: () => void;
};

export function HistoryNarrativeCard({ node, decadeLabel, onClose }: HistoryNarrativeCardProps) {
  const statusMeta =
    decadeLabel && node.statusKind === 'status'
      ? `As of ${decadeLabel}`
      : node.statusKind === 'event-window'
        ? 'Event when-span'
        : 'Status';

  return (
    <Card
      title={node.displayName}
      meta={
        <>
          <span className="bp-mono">{node.kind}</span>
          <span className="bp-sans">{statusMeta}</span>
        </>
      }
      className="bp-history-narrative-card"
    >
      {onClose ? (
        <button
          type="button"
          className="bp-button bp-button--secondary bp-history-narrative-card__close"
          onClick={onClose}
          aria-label={`Close ${node.displayName} card`}
        >
          Close
        </button>
      ) : null}

      <p className="bp-sans">{node.summary}</p>

      <dl className="bp-history-narrative-card__facts">
        <div>
          <dt>Status in view</dt>
          <dd>{node.statusLabel}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>
            {node.evidenceCount} accepted claim{node.evidenceCount === 1 ? '' : 's'}
          </dd>
        </div>
      </dl>

      {node.factLinks.length > 0 ? (
        <div className="bp-history-narrative-card__facts-links">
          <p className="bp-sans">Published facts referencing this record:</p>
          <ul>
            {node.factLinks.map((fact) => (
              <li key={fact.href}>
                <a className="bp-cta bp-cta--ghost" href={fact.href}>
                  {fact.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <a className="bp-cta bp-cta--ink" href={node.href}>
        Open full record
      </a>
    </Card>
  );
}
