/**
 * Progressive-disclosure graph panel for `/history`. Groups nodes by kind with equal visual
 * weight (dignity rule: no violence-heat styling). Selected nodes reveal their evidence-backed
 * edges; every node links to its entity page.
 */
import React from 'react';
import { cx, EmptyState } from '@blap/ui';
import type { HistoryEdgeView, HistoryNodeView } from '../../lib/history/build-history-graph';
import { HISTORY_GAP_COPY } from '../../lib/history/copy';

void React;

export type HistoryGraphPanelProps = {
  readonly nodes: readonly HistoryNodeView[];
  readonly edges: readonly HistoryEdgeView[];
  readonly selectedId?: string;
  readonly selectedEdgeId?: string;
  readonly sparseDecade: boolean;
  readonly onSelectNode?: (entityId: string) => void;
  readonly onSelectEdge?: (edgeId: string) => void;
  readonly labelledBy?: string;
  readonly className?: string;
};

function groupNodesByKind(nodes: readonly HistoryNodeView[]): ReadonlyMap<string, readonly HistoryNodeView[]> {
  const groups = new Map<string, HistoryNodeView[]>();
  for (const node of nodes) {
    const bucket = groups.get(node.kind) ?? [];
    bucket.push(node);
    groups.set(node.kind, bucket);
  }
  return groups;
}

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

  const groups = groupNodesByKind(nodes);

  return (
    <section
      className={cx('bp-history-graph', className)}
      aria-labelledby={labelledBy}
      aria-live="polite"
    >
      {[...groups.entries()].map(([kind, kindNodes]) => (
        <div key={kind} className="bp-history-graph__group">
          <h3 className="bp-history-graph__group-title">{kind.charAt(0).toUpperCase() + kind.slice(1)}</h3>
          <ul className="bp-history-graph__nodes">
            {kindNodes.map((node) => {
              const isSelected = node.entityId === selectedId;
              const nodeEdges = edgesForNode(node.entityId, edges);

              return (
                <li key={node.entityId} className="bp-history-graph__node">
                  <div className="bp-history-graph__node-header">
                    <button
                      type="button"
                      className={cx(
                        'bp-history-graph__node-button',
                        isSelected && 'bp-history-graph__node-button--selected',
                      )}
                      aria-pressed={isSelected}
                      aria-expanded={isSelected}
                      {...(onSelectNode
                        ? { onClick: () => onSelectNode(node.entityId) }
                        : {})}
                    >
                      <span className="bp-history-graph__node-name">{node.displayName}</span>
                      <span className="bp-mono bp-history-graph__node-status">{node.statusLabel}</span>
                    </button>
                    <a className="bp-cta bp-cta--quiet bp-history-graph__node-link" href={node.href}>
                      Open record
                    </a>
                  </div>

                  {isSelected && nodeEdges.length > 0 ? (
                    <details open className="bp-history-graph__connections">
                      <summary>Connections ({nodeEdges.length})</summary>
                      <ul>
                        {nodeEdges.map((edge) => (
                          <li key={edge.edgeId}>
                            <button
                              type="button"
                              className={cx(
                                'bp-history-graph__edge-button',
                                selectedEdgeId === edge.edgeId && 'bp-history-graph__edge-button--selected',
                              )}
                              aria-pressed={selectedEdgeId === edge.edgeId}
                              {...(onSelectEdge
                                ? { onClick: () => onSelectEdge(edge.edgeId) }
                                : {})}
                            >
                              {edge.sentence}
                              <span className="bp-mono">
                                {edge.evidenceCount} citation{edge.evidenceCount === 1 ? '' : 's'}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {edges.length === 0 ? (
        <EmptyState title={HISTORY_GAP_COPY.noConnections.title}>
          {HISTORY_GAP_COPY.noConnections.body}
        </EmptyState>
      ) : null}
    </section>
  );
}
