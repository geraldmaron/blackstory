/**
 * Adaptive SVG relationship visualization for `/history`. Paints with the shared map
 * kind shade + glyph vocabulary (`kind-encoding`), switches between kind aggregation,
 * ego-neighborhood, and sparse record graphs by data volume, and never relies on color alone.
 */
import React, { useMemo } from 'react';
import { cx } from '@repo/ui';
import type { HistoryEdgeView, HistoryNodeView } from '../../lib/history/build-history-graph';
import {
  layoutHistoryGraph,
  type LayoutHistoryGraphNode,
} from '../../lib/history/layout-history-graph';
import { kindEncodingFor, type MapEntityGlyph } from '../../lib/map-experience/kind-encoding';

void React;

const GRAPH_WIDTH = 640;
const GRAPH_HEIGHT = 360;

const KIND_GLYPH_CLASS: Readonly<Record<MapEntityGlyph, string>> = {
  circle: 'ds-legend-glyph--circle',
  square: 'ds-legend-glyph--square',
  diamond: 'ds-legend-glyph--diamond',
  ring: 'ds-legend-glyph--ring',
};

export type HistoryGraphVizProps = {
  readonly nodes: readonly HistoryNodeView[];
  readonly edges: readonly HistoryEdgeView[];
  readonly selectedId?: string;
  readonly selectedEdgeId?: string;
  readonly onSelectNode?: (entityId: string) => void;
  readonly onSelectEdge?: (edgeId: string) => void;
  /** Aggregate hubs call this with a kind value to refine the view. */
  readonly onSelectKind?: (kind: string) => void;
  readonly className?: string;
};

function nodeAriaLabel(node: LayoutHistoryGraphNode): string {
  if (node.role === 'kind-hub') {
    const count = node.recordCount ?? 0;
    return `${node.label} kind, ${count} record${count === 1 ? '' : 's'}`;
  }
  return `${node.label}, ${node.kind}${node.statusLabel ? `, ${node.statusLabel}` : ''}`;
}

function shouldShowLabel(
  node: LayoutHistoryGraphNode,
  mode: string,
  selectedId: string | undefined,
  nodeCount: number,
): boolean {
  if (node.role === 'kind-hub') return true;
  if (mode === 'neighborhood') return true;
  if (selectedId && node.entityId === selectedId) return true;
  return nodeCount <= 12;
}

function truncateLabel(label: string, max = 22): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

function renderNodeShape(node: LayoutHistoryGraphNode, selected: boolean): React.ReactNode {
  const r = node.r;
  const className = cx(
    'ds-history-graph-viz__node-shape',
    selected && 'ds-history-graph-viz__node-shape--selected',
  );
  const fill = node.glyph === 'ring' ? 'none' : node.shade;
  const stroke = selected ? 'var(--ds-accent-graphic)' : node.shade;

  switch (node.glyph) {
    case 'square':
      return (
        <rect
          className={className}
          x={-r}
          y={-r}
          width={r * 2}
          height={r * 2}
          rx={2}
          fill={fill}
          stroke={stroke}
        />
      );
    case 'diamond':
      return (
        <polygon
          className={className}
          points={`0,${-r} ${r},0 0,${r} ${-r},0`}
          fill={fill}
          stroke={stroke}
        />
      );
    case 'ring':
      return (
        <>
          <circle
            className={className}
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth={selected ? 3 : 2.5}
          />
          <circle
            className="ds-history-graph-viz__node-core"
            r={r * 0.4}
            fill={node.shade}
            stroke="none"
          />
        </>
      );
    case 'circle':
    default:
      return <circle className={className} r={r} fill={fill} stroke={stroke} />;
  }
}

export function HistoryGraphViz({
  nodes,
  edges,
  selectedId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  onSelectKind,
  className,
}: HistoryGraphVizProps) {
  const layout = useMemo(
    () =>
      layoutHistoryGraph(nodes, edges, {
        width: GRAPH_WIDTH,
        height: GRAPH_HEIGHT,
        seed: 1,
        ...(selectedId ? { selectedId } : {}),
      }),
    [nodes, edges, selectedId],
  );

  const positionById = useMemo(
    () => new Map(layout.layoutNodes.map((node) => [node.id, node])),
    [layout.layoutNodes],
  );

  const legendKinds = useMemo(() => {
    const seen = new Map<
      string,
      { kind: string; shade: string; glyph: MapEntityGlyph; label: string }
    >();
    for (const node of layout.layoutNodes) {
      if (seen.has(node.kind)) continue;
      const encoding = kindEncodingFor(node.kind);
      seen.set(node.kind, {
        kind: node.kind,
        shade: encoding.shade,
        glyph: encoding.glyph,
        label: encoding.label,
      });
    }
    return [...seen.values()].sort((a, b) => a.kind.localeCompare(b.kind));
  }, [layout.layoutNodes]);

  const showLabelsForCount = layout.layoutNodes.length;

  return (
    <div className={cx('ds-history-graph-viz', className)} data-mode={layout.mode}>
      <p className="ds-mono ds-history-graph-viz__mode" role="status">
        {layout.modeNotice}
        {layout.mode === 'aggregate'
          ? ` · ${layout.totalNodeCount} records across ${layout.layoutNodes.length} kinds`
          : null}
      </p>

      <svg
        className="ds-history-graph-viz__svg"
        viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
        width="100%"
        height="auto"
        role="img"
        aria-label={
          layout.mode === 'aggregate'
            ? 'Kind relationship overview for records in view'
            : 'History records and their evidence-backed connections'
        }
      >
        <g className="ds-history-graph-viz__edges">
          {layout.layoutEdges.map((edge) => {
            const from = positionById.get(edge.fromId);
            const to = positionById.get(edge.toId);
            if (!from || !to) return null;
            const isSelected = Boolean(edge.edgeId && selectedEdgeId === edge.edgeId);
            const strokeWidth = Math.min(1.25 + edge.weight * 0.35, 4);

            return (
              <g key={edge.id} className="ds-history-graph-viz__edge">
                <line
                  className={cx(
                    'ds-history-graph-viz__edge-line',
                    isSelected && 'ds-history-graph-viz__edge-line--selected',
                  )}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  strokeWidth={strokeWidth}
                />
                {onSelectEdge && edge.edgeId && edge.sentence ? (
                  <line
                    className="ds-history-graph-viz__edge-hit"
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    tabIndex={0}
                    role="button"
                    aria-label={edge.sentence}
                    aria-pressed={isSelected}
                    onClick={() => onSelectEdge(edge.edgeId!)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectEdge(edge.edgeId!);
                      }
                    }}
                  />
                ) : null}
              </g>
            );
          })}
        </g>

        <g className="ds-history-graph-viz__nodes">
          {layout.layoutNodes.map((node) => {
            const isSelected = node.role === 'record' ? node.entityId === selectedId : false;
            const showLabel = shouldShowLabel(node, layout.mode, selectedId, showLabelsForCount);
            const label =
              node.role === 'kind-hub'
                ? `${node.label} (${node.recordCount ?? 0})`
                : truncateLabel(node.label);

            return (
              <g
                key={node.id}
                className={cx(
                  'ds-history-graph-viz__node',
                  isSelected && 'ds-history-graph-viz__node--selected',
                )}
                transform={`translate(${node.x} ${node.y})`}
              >
                {isSelected ? (
                  <circle
                    className="ds-history-graph-viz__selection-ring"
                    r={node.r + 5}
                    fill="none"
                    stroke="var(--ds-accent-graphic)"
                    strokeWidth={2}
                  />
                ) : null}
                {renderNodeShape(node, isSelected)}
                {onSelectNode || onSelectKind ? (
                  <circle
                    className="ds-history-graph-viz__node-focus"
                    r={Math.max(node.r + 6, 18)}
                    tabIndex={0}
                    role="button"
                    aria-label={nodeAriaLabel(node)}
                    aria-pressed={isSelected}
                    onClick={() => {
                      if (node.role === 'kind-hub') {
                        onSelectKind?.(node.kind);
                        return;
                      }
                      if (node.entityId) onSelectNode?.(node.entityId);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (node.role === 'kind-hub') {
                          onSelectKind?.(node.kind);
                          return;
                        }
                        if (node.entityId) onSelectNode?.(node.entityId);
                      }
                    }}
                  />
                ) : null}
                {showLabel ? (
                  <text
                    className="ds-history-graph-viz__node-label"
                    y={node.r + 14}
                    textAnchor="middle"
                    aria-hidden="true"
                  >
                    {label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      {legendKinds.length > 0 ? (
        <ul className="ds-history-graph-viz__legend" aria-label="Kind color key">
          {legendKinds.map((entry) => (
            <li key={entry.kind} className="ds-history-graph-viz__legend-item">
              <span
                className={cx('ds-legend-glyph', KIND_GLYPH_CLASS[entry.glyph])}
                style={
                  entry.glyph === 'ring'
                    ? { borderColor: entry.shade, background: 'transparent' }
                    : { background: entry.shade, borderColor: entry.shade }
                }
                aria-hidden="true"
              />
              <span className="ds-mono">{entry.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
