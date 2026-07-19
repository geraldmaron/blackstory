/**
 * SVG network visualization for `/history` graph panel. Renders evidence-backed nodes and edges
 * with equal visual weight per kind (shape encoding, not heat color), keyboard selection, and
 * copper accent for the active node.
 */
import React, { useMemo } from 'react';
import { cx } from '@repo/ui';
import type { HistoryEdgeView, HistoryNodeView } from '../../lib/history/build-history-graph';
import {
  layoutHistoryGraph,
  type LayoutHistoryGraphNode,
} from '../../lib/history/layout-history-graph';
import { kindEncodingFor } from '../../lib/map-experience/kind-encoding';

void React;

const GRAPH_WIDTH = 640;
const GRAPH_HEIGHT = 420;
const NODE_HIT_RADIUS = 18;
const NODE_VISUAL_RADIUS = 10;

const TRUNCATION_NOTICE =
  'Showing the most connected records in this view. Clear filters or switch decades to see more.';

export type HistoryGraphVizProps = {
  readonly nodes: readonly HistoryNodeView[];
  readonly edges: readonly HistoryEdgeView[];
  readonly selectedId?: string;
  readonly selectedEdgeId?: string;
  readonly onSelectNode?: (entityId: string) => void;
  readonly onSelectEdge?: (edgeId: string) => void;
  readonly className?: string;
};

function nodeAriaLabel(node: LayoutHistoryGraphNode): string {
  return `${node.displayName}, ${node.kind}, ${node.statusLabel}`;
}

function renderNodeShape(kind: string, selected: boolean): React.ReactNode {
  const glyph = kindEncodingFor(kind).glyph;
  const className = cx(
    'ds-history-graph-viz__node-shape',
    selected && 'ds-history-graph-viz__node-shape--selected',
  );

  switch (glyph) {
    case 'square':
      return (
        <rect
          className={className}
          x={-NODE_VISUAL_RADIUS}
          y={-NODE_VISUAL_RADIUS}
          width={NODE_VISUAL_RADIUS * 2}
          height={NODE_VISUAL_RADIUS * 2}
          rx={2}
        />
      );
    case 'diamond':
      return (
        <polygon
          className={className}
          points={`0,${-NODE_VISUAL_RADIUS} ${NODE_VISUAL_RADIUS},0 0,${NODE_VISUAL_RADIUS} ${-NODE_VISUAL_RADIUS},0`}
        />
      );
    case 'ring':
      return (
        <>
          <circle className={className} r={NODE_VISUAL_RADIUS} fill="none" strokeWidth={2.5} />
          <circle className="ds-history-graph-viz__node-core" r={NODE_VISUAL_RADIUS * 0.45} />
        </>
      );
    case 'circle':
    default:
      return <circle className={className} r={NODE_VISUAL_RADIUS} />;
  }
}

export function HistoryGraphViz({
  nodes,
  edges,
  selectedId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  className,
}: HistoryGraphVizProps) {
  const layout = useMemo(
    () => layoutHistoryGraph(nodes, edges, { width: GRAPH_WIDTH, height: GRAPH_HEIGHT, seed: 1 }),
    [nodes, edges],
  );

  const positionById = useMemo(
    () => new Map(layout.layoutNodes.map((node) => [node.entityId, node])),
    [layout.layoutNodes],
  );

  return (
    <div className={cx('ds-history-graph-viz', className)}>
      {layout.truncated ? (
        <p className="ds-mono ds-history-graph-viz__truncation" role="status">
          {TRUNCATION_NOTICE} ({layout.layoutNodes.length} of {layout.totalNodeCount} records)
        </p>
      ) : null}

      <svg
        className="ds-history-graph-viz__svg"
        viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
        width="100%"
        height={GRAPH_HEIGHT}
        aria-label="History records and their evidence-backed connections"
      >
        <g className="ds-history-graph-viz__edges" aria-hidden={layout.layoutEdges.length === 0}>
          {layout.layoutEdges.map((edge) => {
            const from = positionById.get(edge.fromEntityId);
            const to = positionById.get(edge.toEntityId);
            if (!from || !to) return null;
            const isSelected = selectedEdgeId === edge.edgeId;
            const edgeLabel = edge.sentence;

            return (
              <g key={edge.edgeId} className="ds-history-graph-viz__edge">
                <line
                  className={cx(
                    'ds-history-graph-viz__edge-line',
                    isSelected && 'ds-history-graph-viz__edge-line--selected',
                  )}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                />
                {onSelectEdge ? (
                  <line
                    className="ds-history-graph-viz__edge-hit"
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    tabIndex={0}
                    role="button"
                    aria-label={edgeLabel}
                    aria-pressed={isSelected}
                    onClick={() => onSelectEdge(edge.edgeId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectEdge(edge.edgeId);
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
            const isSelected = node.entityId === selectedId;
            const label = nodeAriaLabel(node);

            return (
              <g
                key={node.entityId}
                className={cx(
                  'ds-history-graph-viz__node',
                  isSelected && 'ds-history-graph-viz__node--selected',
                )}
                transform={`translate(${node.x} ${node.y})`}
              >
                {renderNodeShape(node.kind, isSelected)}
                <circle className="ds-history-graph-viz__node-hit" r={NODE_HIT_RADIUS} />
                {onSelectNode ? (
                  <circle
                    className="ds-history-graph-viz__node-focus"
                    r={NODE_HIT_RADIUS}
                    tabIndex={0}
                    role="button"
                    aria-label={label}
                    aria-pressed={isSelected}
                    onClick={() => onSelectNode(node.entityId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectNode(node.entityId);
                      }
                    }}
                  />
                ) : null}
                <text
                  className="ds-history-graph-viz__node-label"
                  y={NODE_VISUAL_RADIUS + 14}
                  textAnchor="middle"
                  aria-hidden="true"
                >
                  <tspan className="ds-history-graph-viz__node-name">{node.displayName}</tspan>
                  <tspan className="ds-history-graph-viz__node-kind" x={0} dy="1.1em">
                    {node.kind}
                  </tspan>
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
