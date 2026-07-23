/**
 * Single history rip-list row: title, summary, and label-over-value fact strip (v6 edition).
 */
import React from 'react';
import Link from 'next/link';
import type { HistoryNodeView } from '../../lib/history/build-history-graph';
import { StatusMark } from '../map-experience/StatusMark';
import { EditionFactIcon } from '../patterns/EditionFactIcon';
import { exploreHrefForKind, searchHrefForStatus } from '../../lib/map-experience/metadata-hrefs';
import { searchKindLabelFor } from '../../lib/map-experience/entity-record-facts';

void React;

export type HistoryRipRowProps = {
  readonly node: HistoryNodeView;
  readonly isSelected?: boolean;
};

export function HistoryRipRow({ node, isSelected = false }: HistoryRipRowProps) {
  const kindLabel = searchKindLabelFor(node.kind);
  const kindHref = exploreHrefForKind(node.kind);
  const statusHref =
    node.entityStatus !== undefined ? searchHrefForStatus(node.entityStatus) : undefined;

  return (
    <article
      className="ds-history-edition__rip-row"
      data-entity-id={node.entityId}
      aria-current={isSelected ? 'true' : undefined}
    >
      <h3 className="ds-history-edition__rip-title">
        <Link className="ds-history-edition__rip-link" href={node.href}>
          {node.displayName}
        </Link>
      </h3>
      {node.summary ? <p className="ds-history-edition__rip-summary">{node.summary}</p> : null}
      <dl className="ds-history-edition__rip-facts">
        <div className="ds-history-edition__rip-fact">
          <dt className="ds-history-edition__rip-fact-label">
            <EditionFactIcon variant="record-kind" kind={node.kind} muted />
            Kind
          </dt>
          <dd className="ds-history-edition__rip-fact-value">
            <Link className="ds-history-edition__rip-fact-link" href={kindHref}>
              {kindLabel}
            </Link>
          </dd>
        </div>
        <div className="ds-history-edition__rip-fact">
          <dt className="ds-history-edition__rip-fact-label">
            <EditionFactIcon variant="record-era" />
            Era
          </dt>
          <dd className="ds-history-edition__rip-fact-value">{node.eraLabel}</dd>
        </div>
        {node.statusLabel ? (
          <div className="ds-history-edition__rip-fact">
            <dt className="ds-history-edition__rip-fact-label">Status</dt>
            <dd className="ds-history-edition__rip-fact-value">
              {node.entityStatus && statusHref ? (
                <Link className="ds-history-edition__rip-fact-link" href={statusHref}>
                  <StatusMark status={node.entityStatus} labeled />
                </Link>
              ) : node.entityStatus ? (
                <StatusMark status={node.entityStatus} labeled />
              ) : (
                node.statusLabel
              )}
            </dd>
          </div>
        ) : null}
        <div className="ds-history-edition__rip-fact">
          <dt className="ds-history-edition__rip-fact-label">Evidence</dt>
          <dd className="ds-history-edition__rip-fact-value">
            {node.evidenceCount} claim{node.evidenceCount === 1 ? '' : 's'}
          </dd>
        </div>
      </dl>
    </article>
  );
}
