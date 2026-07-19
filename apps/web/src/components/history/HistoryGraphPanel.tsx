/**
 * Progressive-disclosure graph panel for `/history`. Renders an SVG network of nodes and edges
 * with equal visual weight per kind (dignity rule: no violence-heat styling). Selected nodes
 * reveal their evidence-backed connections below the graph.
 */
import React from 'react';
import Link from 'next/link';
import { cx, EmptyState } from '@repo/ui';
import type { HistoryEdgeView, HistoryNodeView } from '../../lib/history/build-history-graph';
import { HISTORY_GAP_COPY } from '../../lib/history/copy';
import { HistoryGraphViz } from './HistoryGraphViz';

void React;

export type HistoryGraphPanelProps = {
  readonly nodes: readonly HistoryNodeView[];
  readonly edges: readonly HistoryEdgeView[];
  readonly selectedId?: string;
  readonly selectedEdgeId?: string;
  readonly sparseDecade: boolean;
  readonly onSelectNode?: (entityId: string) => void;
  readonly onSelectEdge?: (edgeId: string) => void;
  readonly onSelectKind?: (kind: string) => void;
  readonly labelledBy?: string;
  readonly className?: string;
};

function edgesForNode(nodeId: string, edges: readonly HistoryEdgeView[]): readonly HistoryEdgeView[] {
  return edges.filter((edge) => edge.fromEntityId === nodeId || edge.toEntityId === nodeId);
}

export function HistoryGraphPanel({
  nodes,
  edges,
  selectedId,
  selectedEdgeId,
  sparseDecade,
  onSelectNode,
  onSelectEdge,
  onSelectKind,
  labelledBy,
  className,
}: HistoryGraphPanelProps) {
  if (sparseDecade) {
    const copy = HISTORY_GAP_COPY.sparseDecade;
    return <EmptyState title={copy.title}>{copy.body}</EmptyState>;
  }

  if (nodes.length === 0) {
    const copy = HISTORY_GAP_COPY.noFilterMatch;
    return <EmptyState title={copy.title}>{copy.body}</EmptyState>;
  }

  const selectedNode = selectedId ? nodes.find((node) => node.entityId === selectedId) : undefined;
  const selectedNodeEdges = selectedNode ? edgesForNode(selectedNode.entityId, edges) : [];

  return (
    <section
      className={cx('ds-history-graph', className)}
      aria-labelledby={labelledBy}
      aria-live="polite"
    >
      <HistoryGraphViz
        nodes={nodes}
        edges={edges}
        {...(selectedId ? { selectedId } : {})}
        {...(selectedEdgeId ? { selectedEdgeId } : {})}
        {...(onSelectNode ? { onSelectNode } : {})}
        {...(onSelectEdge ? { onSelectEdge } : {})}
        {...(onSelectKind ? { onSelectKind } : {})}
      />

      {selectedNode && selectedNodeEdges.length > 0 ? (
        <details open className="ds-history-graph__connections">
          <summary>
            Connections for {selectedNode.displayName} ({selectedNodeEdges.length})
          </summary>
          <p className="ds-history-graph__node-header">
            <Link className="ds-cta ds-cta--quiet ds-history-graph__node-link" href={selectedNode.href}>
              Open record
            </Link>
          </p>
          <ul>
            {selectedNodeEdges.map((edge) => (
              <li key={edge.edgeId}>
                <button
                  type="button"
                  className={cx(
                    'ds-history-graph__edge-button',
                    selectedEdgeId === edge.edgeId && 'ds-history-graph__edge-button--selected',
                  )}
                  aria-pressed={selectedEdgeId === edge.edgeId}
                  {...(onSelectEdge ? { onClick: () => onSelectEdge(edge.edgeId) } : {})}
                >
                  {edge.sentence}
                  <span className="ds-mono">
                    {edge.evidenceCount} citation{edge.evidenceCount === 1 ? '' : 's'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {edges.length === 0 ? (
        <EmptyState title={HISTORY_GAP_COPY.noConnections.title}>
          {HISTORY_GAP_COPY.noConnections.body}
        </EmptyState>
      ) : null}
    </section>
  );
}
