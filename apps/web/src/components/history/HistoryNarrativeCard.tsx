/**
 * Narrative off-ramp card for a selected history graph node. Mirrors
 * `NarrativeCard` name, kind, status-as-of-decade, evidence count, and links to the entity page
 * and any published facts.
 */
import React from 'react';
import Link from 'next/link';
import { Card } from '@repo/ui';
import type { HistoryNodeView } from '../../lib/history/build-history-graph';
import { entityEvidenceHref, exploreHrefForKind } from '../../lib/map-experience/metadata-hrefs';

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
          <Link className="ds-mono ds-history-narrative-card__kind-link" href={exploreHrefForKind(node.kind)}>
            {node.kind}
          </Link>
          <span className="ds-sans">{statusMeta}</span>
        </>
      }
      className="ds-history-narrative-card"
    >
      {onClose ? (
        <button
          type="button"
          className="ds-button ds-button--secondary ds-history-narrative-card__close"
          onClick={onClose}
          aria-label={`Close ${node.displayName} card`}
        >
          Close
        </button>
      ) : null}

      <p className="ds-sans">{node.summary}</p>

      <dl className="ds-history-narrative-card__facts">
        <div>
          <dt>Status in view</dt>
          <dd>{node.statusLabel}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>
            <Link className="ds-history-narrative-card__fact-link" href={entityEvidenceHref(node.href)}>
              {node.evidenceCount} accepted claim{node.evidenceCount === 1 ? '' : 's'}
            </Link>
          </dd>
        </div>
      </dl>

      {node.factLinks.length > 0 ? (
        <div className="ds-history-narrative-card__facts-links">
          <p className="ds-sans">Published facts referencing this record:</p>
          <ul>
            {node.factLinks.map((fact) => (
              <li key={fact.href}>
                <Link className="ds-cta ds-cta--ghost" href={fact.href}>
                  {fact.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Link className="ds-cta ds-cta--ink" href={node.href}>
        Open full record
      </Link>
    </Card>
  );
}
