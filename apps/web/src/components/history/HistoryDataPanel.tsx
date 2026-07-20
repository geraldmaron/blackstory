/**
 * Data panel for `/history` that replaces the relationship-graph SVG. Surfaces
 * available view-model fields: kind composition (filterable), connection coverage,
 * top connected records / published edges, and selected-node connections — plus a
 * cited “From the archive” framing strip.
 */
import React, { useMemo } from 'react';
import Link from 'next/link';
import { cx, EmptyState } from '@repo/ui';
import type { HistoryEdgeView, HistoryNodeView } from '../../lib/history/build-history-graph';
import { HISTORY_GAP_COPY } from '../../lib/history/copy';
import { kindEncodingFor } from '../../lib/map-experience/kind-encoding';
import { HistoryDidYouKnow } from './HistoryDidYouKnow';

void React;

export type HistoryDataPanelProps = {
  readonly nodes: readonly HistoryNodeView[];
  readonly edges: readonly HistoryEdgeView[];
  readonly selectedId?: string;
  readonly selectedEdgeId?: string;
  readonly sparseDecade: boolean;
  readonly onSelectNode?: (entityId: string) => void;
  readonly onSelectEdge?: (edgeId: string) => void;
  readonly onSelectKind?: (kind: string) => void;
  readonly activeKind?: string;
  readonly labelledBy?: string;
  readonly className?: string;
};

function edgesForNode(
  nodeId: string,
  edges: readonly HistoryEdgeView[],
): readonly HistoryEdgeView[] {
  return edges.filter((edge) => edge.fromEntityId === nodeId || edge.toEntityId === nodeId);
}

function buildKindRows(nodes: readonly HistoryNodeView[]): readonly {
  readonly kind: string;
  readonly count: number;
  readonly connected: number;
}[] {
  const map = new Map<string, { count: number; connected: number }>();
  for (const node of nodes) {
    const current = map.get(node.kind) ?? { count: 0, connected: 0 };
    current.count += 1;
    if (node.connectionCount > 0) current.connected += 1;
    map.set(node.kind, current);
  }
  return [...map.entries()]
    .map(([kind, stats]) => ({ kind, count: stats.count, connected: stats.connected }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}

export function HistoryDataPanel({
  nodes,
  edges,
  selectedId,
  selectedEdgeId,
  sparseDecade,
  onSelectNode,
  onSelectEdge,
  onSelectKind,
  activeKind = 'all',
  labelledBy,
  className,
}: HistoryDataPanelProps) {
  const kindRows = useMemo(() => buildKindRows(nodes), [nodes]);
  const maxKindCount = kindRows.reduce((max, row) => Math.max(max, row.count), 0);
  const connectedNodes = useMemo(
    () => nodes.filter((node) => node.connectionCount > 0).length,
    [nodes],
  );
  const topConnected = useMemo(
    () =>
      [...nodes]
        .filter((node) => node.connectionCount > 0)
        .sort(
          (a, b) =>
            b.connectionCount - a.connectionCount || a.displayName.localeCompare(b.displayName),
        )
        .slice(0, 8),
    [nodes],
  );
  const topEdges = useMemo(
    () =>
      [...edges]
        .sort((a, b) => b.evidenceCount - a.evidenceCount || a.sentence.localeCompare(b.sentence))
        .slice(0, 6),
    [edges],
  );

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
      className={cx('ds-history-data', className)}
      aria-labelledby={labelledBy}
      aria-live="polite"
    >
      <p className="ds-mono ds-history-data__lede">
        {edges.length > 0
          ? `${nodes.length} record${nodes.length === 1 ? '' : 's'} in view · ${edges.length} published connection${
              edges.length === 1 ? '' : 's'
            } · ${connectedNodes} linked`
          : `${nodes.length} record${nodes.length === 1 ? '' : 's'} across ${kindRows.length} kind${
              kindRows.length === 1 ? '' : 's'
            } — select a kind to filter the list.`}
      </p>

      <div className="ds-history-data__kinds">
        <h3 className="ds-history-data__section-label">Kind composition</h3>
        <ul className="ds-history-data__kind-list">
          {kindRows.map((row) => {
            const encoding = kindEncodingFor(row.kind);
            const widthPercent =
              maxKindCount > 0 ? Math.max(6, Math.round((row.count / maxKindCount) * 100)) : 0;
            const isActive = activeKind === row.kind;
            const label = `${encoding.label}: ${row.count} records, ${row.connected} with connections`;

            return (
              <li key={row.kind}>
                <button
                  type="button"
                  className={cx(
                    'ds-history-data__kind-row',
                    isActive && 'ds-history-data__kind-row--active',
                  )}
                  aria-pressed={isActive}
                  aria-label={label}
                  {...(onSelectKind ? { onClick: () => onSelectKind(row.kind) } : {})}
                >
                  <span className="ds-history-data__kind-meta">
                    <span
                      className={cx(
                        'ds-legend-glyph',
                        `ds-legend-glyph--${encoding.glyph}`,
                        'ds-history-data__kind-glyph',
                      )}
                      style={
                        encoding.glyph === 'ring'
                          ? { borderColor: encoding.shade, background: 'transparent' }
                          : { background: encoding.shade, borderColor: encoding.shade }
                      }
                      aria-hidden="true"
                    />
                    <span className="ds-history-data__kind-name">{encoding.label}</span>
                    <span className="ds-mono ds-history-data__kind-count">{row.count}</span>
                  </span>
                  <span className="ds-history-data__kind-bar" aria-hidden="true">
                    <span
                      className="ds-history-data__kind-bar-fill"
                      style={{ width: `${widthPercent}%`, background: encoding.shade }}
                    />
                  </span>
                  <span className="ds-mono ds-history-data__kind-linked">
                    {row.connected} linked
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {topEdges.length > 0 ? (
        <div className="ds-history-data__edges">
          <h3 className="ds-history-data__section-label">Documented connections</h3>
          <ul className="ds-history-data__edge-list">
            {topEdges.map((edge) => (
              <li key={edge.edgeId}>
                <button
                  type="button"
                  className={cx(
                    'ds-history-data__edge-button',
                    selectedEdgeId === edge.edgeId && 'ds-history-data__edge-button--selected',
                  )}
                  aria-pressed={selectedEdgeId === edge.edgeId}
                  {...(onSelectEdge ? { onClick: () => onSelectEdge(edge.edgeId) } : {})}
                >
                  <span className="ds-history-data__edge-sentence">{edge.sentence}</span>
                  <span className="ds-mono ds-history-data__edge-meta">
                    {edge.type.replace(/_/g, ' ')} · {edge.evidenceCount} citation
                    {edge.evidenceCount === 1 ? '' : 's'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {topEdges.length === 0 && topConnected.length > 0 ? (
        <div className="ds-history-data__connected">
          <h3 className="ds-history-data__section-label">Most connected in view</h3>
          <ul className="ds-history-data__connected-list">
            {topConnected.map((node) => (
              <li key={node.entityId}>
                <button
                  type="button"
                  className={cx(
                    'ds-history-data__connected-button',
                    selectedId === node.entityId && 'ds-history-data__connected-button--selected',
                  )}
                  {...(onSelectNode ? { onClick: () => onSelectNode(node.entityId) } : {})}
                >
                  <span className="ds-history-data__connected-name">{node.displayName}</span>
                  <span className="ds-mono ds-history-data__connected-meta">
                    {kindEncodingFor(node.kind).label} · {node.connectionCount} connection
                    {node.connectionCount === 1 ? '' : 's'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {selectedNode && selectedNodeEdges.length > 0 ? (
        <details open className="ds-history-data__selection">
          <summary>
            Connections for {selectedNode.displayName} ({selectedNodeEdges.length})
          </summary>
          <p className="ds-history-data__selection-header">
            <Link className="ds-cta ds-cta--quiet" href={selectedNode.href}>
              Open record
            </Link>
            <span className="ds-mono">
              {selectedNode.evidenceCount} claim{selectedNode.evidenceCount === 1 ? '' : 's'} ·{' '}
              {selectedNode.connectionCount} connection
              {selectedNode.connectionCount === 1 ? '' : 's'}
            </span>
          </p>
          <ul>
            {selectedNodeEdges.map((edge) => (
              <li key={edge.edgeId}>
                <button
                  type="button"
                  className={cx(
                    'ds-history-data__edge-button',
                    selectedEdgeId === edge.edgeId && 'ds-history-data__edge-button--selected',
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

      <HistoryDidYouKnow seed={nodes.length + edges.length} count={2} />
    </section>
  );
}
