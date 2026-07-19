/**
 * Adaptive layout for the `/history` relationship graph. Chooses a readable mode by
 * data volume — kind aggregation at catalog scale, ego-neighborhood when a record is
 * selected, and a sparse record graph only when the filtered set is small — so the
 * viz never dumps a labeled hairball. Positions are deterministic for identical inputs.
 */
import {
  displayEncodingFor,
  kindEncodingFor,
  mapToneFromTopics,
  type MapEntityGlyph,
} from '../map-experience/kind-encoding';
import type { HistoryEdgeView, HistoryNodeView } from './build-history-graph';

/** Max records before the viz collapses to kind hubs (explore-scale density). */
export const HISTORY_RECORD_GRAPH_MAX = 24;

/** Cap on ego-neighborhood satellites around a selected record. */
export const HISTORY_NEIGHBORHOOD_MAX = 18;

export type HistoryGraphLayoutMode = 'aggregate' | 'records' | 'neighborhood';

export type LayoutHistoryGraphOptions = {
  readonly width: number;
  readonly height: number;
  readonly seed?: number;
  readonly selectedId?: string;
  /** Override adaptive threshold (tests). */
  readonly recordGraphMax?: number;
  readonly neighborhoodMax?: number;
};

export type LayoutHistoryGraphNode = {
  /** Entity id, or `kind:<kind>` for aggregate hubs. */
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly shade: string;
  readonly glyph: MapEntityGlyph;
  readonly role: 'record' | 'kind-hub';
  readonly connectionCount: number;
  /** Present on kind hubs and used for sizing. */
  readonly recordCount?: number;
  readonly statusLabel?: string;
  readonly entityId?: string;
  readonly x: number;
  readonly y: number;
  readonly r: number;
};

export type LayoutHistoryGraphEdge = {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  /** Edge weight (1 for record edges; inter-kind count for aggregate). */
  readonly weight: number;
  readonly sentence?: string;
  readonly evidenceCount?: number;
  readonly edgeId?: string;
};

export type LayoutHistoryGraphResult = {
  readonly mode: HistoryGraphLayoutMode;
  readonly truncated: boolean;
  readonly totalNodeCount: number;
  readonly layoutNodes: readonly LayoutHistoryGraphNode[];
  readonly layoutEdges: readonly LayoutHistoryGraphEdge[];
  readonly modeNotice: string;
};

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function encodingForNode(node: HistoryNodeView) {
  const tone = mapToneFromTopics(node.topicTags);
  return displayEncodingFor(node.kind, tone);
}

function encodingForKind(kind: string) {
  return kindEncodingFor(kind);
}

function hubRadius(count: number, maxCount: number): number {
  const minR = 18;
  const maxR = 36;
  if (maxCount <= 0) return minR;
  return minR + Math.round((count / maxCount) * (maxR - minR));
}

function recordRadius(connectionCount: number): number {
  return clamp(8 + Math.min(connectionCount, 6), 8, 14);
}

export function resolveHistoryGraphMode(
  nodeCount: number,
  selectedId: string | undefined,
  selectedInView: boolean,
  recordGraphMax: number = HISTORY_RECORD_GRAPH_MAX,
): HistoryGraphLayoutMode {
  if (selectedId && selectedInView) return 'neighborhood';
  if (nodeCount <= recordGraphMax) return 'records';
  return 'aggregate';
}

function layoutAggregate(
  nodes: readonly HistoryNodeView[],
  edges: readonly HistoryEdgeView[],
  width: number,
  height: number,
): Omit<LayoutHistoryGraphResult, 'totalNodeCount'> {
  const kindCounts = new Map<string, number>();
  for (const node of nodes) {
    kindCounts.set(node.kind, (kindCounts.get(node.kind) ?? 0) + 1);
  }

  const kinds = [...kindCounts.keys()].sort((a, b) => a.localeCompare(b));
  const maxCount = Math.max(...kindCounts.values(), 1);
  const centerX = width / 2;
  const centerY = height / 2;
  const ring = Math.min(width, height) * 0.28;

  const layoutNodes: LayoutHistoryGraphNode[] = kinds.map((kind, index) => {
    const encoding = encodingForKind(kind);
    const count = kindCounts.get(kind) ?? 0;
    const angle =
      kinds.length === 1 ? -Math.PI / 2 : (index / kinds.length) * Math.PI * 2 - Math.PI / 2;
    return {
      id: `kind:${kind}`,
      kind,
      label: encoding.label,
      shade: encoding.shade,
      glyph: encoding.glyph,
      role: 'kind-hub' as const,
      connectionCount: 0,
      recordCount: count,
      x: centerX + Math.cos(angle) * ring,
      y: centerY + Math.sin(angle) * ring,
      r: hubRadius(count, maxCount),
    };
  });

  const nodeKindById = new Map(nodes.map((node) => [node.entityId, node.kind]));
  const interKind = new Map<string, number>();
  for (const edge of edges) {
    const fromKind = nodeKindById.get(edge.fromEntityId);
    const toKind = nodeKindById.get(edge.toEntityId);
    if (!fromKind || !toKind || fromKind === toKind) continue;
    const [a, b] = fromKind < toKind ? [fromKind, toKind] : [toKind, fromKind];
    const key = `${a}|${b}`;
    interKind.set(key, (interKind.get(key) ?? 0) + 1);
  }

  const layoutEdges: LayoutHistoryGraphEdge[] = [...interKind.entries()].map(([key, weight]) => {
    const [fromKind, toKind] = key.split('|') as [string, string];
    return {
      id: `kind-edge:${key}`,
      fromId: `kind:${fromKind}`,
      toId: `kind:${toKind}`,
      weight,
    };
  });

  // Attach hub connection counts from inter-kind weights.
  const hubDegree = new Map<string, number>();
  for (const edge of layoutEdges) {
    hubDegree.set(edge.fromId, (hubDegree.get(edge.fromId) ?? 0) + edge.weight);
    hubDegree.set(edge.toId, (hubDegree.get(edge.toId) ?? 0) + edge.weight);
  }

  const withDegrees = layoutNodes.map((node) => ({
    ...node,
    connectionCount: hubDegree.get(node.id) ?? 0,
  }));

  return {
    mode: 'aggregate',
    truncated: false,
    layoutNodes: withDegrees,
    layoutEdges,
    modeNotice:
      'Grouped by kind — select a kind to filter, or open a record from the list to focus its connections.',
  };
}

function layoutNeighborhood(
  nodes: readonly HistoryNodeView[],
  edges: readonly HistoryEdgeView[],
  selectedId: string,
  width: number,
  height: number,
  neighborhoodMax: number,
  random: () => number,
): Omit<LayoutHistoryGraphResult, 'totalNodeCount'> {
  const byId = new Map(nodes.map((node) => [node.entityId, node]));
  const selected = byId.get(selectedId);
  if (!selected) {
    return layoutRecords(nodes, edges, width, height, neighborhoodMax, random);
  }

  const neighborIds = new Set<string>();
  const touchingEdges: HistoryEdgeView[] = [];
  for (const edge of edges) {
    const otherId =
      edge.fromEntityId === selectedId
        ? edge.toEntityId
        : edge.toEntityId === selectedId
          ? edge.fromEntityId
          : undefined;
    if (!otherId || !byId.has(otherId)) continue;
    neighborIds.add(otherId);
    touchingEdges.push(edge);
  }

  const neighbors = [...neighborIds]
    .map((id) => byId.get(id))
    .filter((node): node is HistoryNodeView => node !== undefined)
    .sort(
      (a, b) => b.connectionCount - a.connectionCount || a.displayName.localeCompare(b.displayName),
    )
    .slice(0, neighborhoodMax);

  const truncated = neighborIds.size > neighbors.length;
  const centerX = width / 2;
  const centerY = height / 2;
  const selectedEncoding = encodingForNode(selected);

  const layoutNodes: LayoutHistoryGraphNode[] = [
    {
      id: selected.entityId,
      entityId: selected.entityId,
      kind: selected.kind,
      label: selected.displayName,
      shade: selectedEncoding.shade,
      glyph: selectedEncoding.glyph,
      role: 'record',
      connectionCount: selected.connectionCount,
      statusLabel: selected.statusLabel,
      x: centerX,
      y: centerY,
      r: recordRadius(selected.connectionCount) + 4,
    },
  ];

  const ring = Math.min(width, height) * 0.34;
  neighbors.forEach((node, index) => {
    const encoding = encodingForNode(node);
    const angle =
      neighbors.length === 1
        ? -Math.PI / 2
        : (index / neighbors.length) * Math.PI * 2 - Math.PI / 2;
    const jitter = (random() - 0.5) * 6;
    layoutNodes.push({
      id: node.entityId,
      entityId: node.entityId,
      kind: node.kind,
      label: node.displayName,
      shade: encoding.shade,
      glyph: encoding.glyph,
      role: 'record',
      connectionCount: node.connectionCount,
      statusLabel: node.statusLabel,
      x: centerX + Math.cos(angle) * ring + jitter,
      y: centerY + Math.sin(angle) * ring + jitter,
      r: recordRadius(node.connectionCount),
    });
  });

  const visible = new Set(layoutNodes.map((node) => node.id));
  const layoutEdges: LayoutHistoryGraphEdge[] = touchingEdges
    .filter((edge) => visible.has(edge.fromEntityId) && visible.has(edge.toEntityId))
    .map((edge) => ({
      id: edge.edgeId,
      edgeId: edge.edgeId,
      fromId: edge.fromEntityId,
      toId: edge.toEntityId,
      weight: 1,
      sentence: edge.sentence,
      evidenceCount: edge.evidenceCount,
    }));

  return {
    mode: 'neighborhood',
    truncated,
    layoutNodes,
    layoutEdges,
    modeNotice: truncated
      ? `Showing the closest connections for this record (${neighbors.length} of ${neighborIds.size}).`
      : neighbors.length === 0
        ? 'This record has no published connections in the current view.'
        : 'Focused on this record and its published connections.',
  };
}

function layoutRecords(
  nodes: readonly HistoryNodeView[],
  edges: readonly HistoryEdgeView[],
  width: number,
  height: number,
  maxNodes: number,
  random: () => number,
): Omit<LayoutHistoryGraphResult, 'totalNodeCount'> {
  const truncated = nodes.length > maxNodes;
  const selectedNodes = truncated
    ? [...nodes]
        .sort(
          (a, b) =>
            b.connectionCount - a.connectionCount || a.displayName.localeCompare(b.displayName),
        )
        .slice(0, maxNodes)
    : [...nodes];

  const kinds = [...new Set(selectedNodes.map((node) => node.kind))].sort((a, b) =>
    a.localeCompare(b),
  );
  const centerX = width / 2;
  const centerY = height / 2;
  const clusterRadius = Math.min(width, height) * (kinds.length <= 2 ? 0.22 : 0.3);

  const layoutNodes: LayoutHistoryGraphNode[] = [];
  kinds.forEach((kind, kindIndex) => {
    const kindNodes = selectedNodes.filter((node) => node.kind === kind);
    const clusterAngle =
      kinds.length === 1 ? -Math.PI / 2 : (kindIndex / kinds.length) * Math.PI * 2 - Math.PI / 2;
    const clusterX = centerX + Math.cos(clusterAngle) * clusterRadius;
    const clusterY = centerY + Math.sin(clusterAngle) * clusterRadius;
    const innerRadius = Math.min(28 + kindNodes.length * 6, clusterRadius * 0.7);

    kindNodes.forEach((node, nodeIndex) => {
      const encoding = encodingForNode(node);
      const nodeAngle =
        kindNodes.length === 1
          ? clusterAngle + Math.PI
          : (nodeIndex / kindNodes.length) * Math.PI * 2;
      const jitter = (random() - 0.5) * 10;
      layoutNodes.push({
        id: node.entityId,
        entityId: node.entityId,
        kind: node.kind,
        label: node.displayName,
        shade: encoding.shade,
        glyph: encoding.glyph,
        role: 'record',
        connectionCount: node.connectionCount,
        statusLabel: node.statusLabel,
        x: clamp(clusterX + Math.cos(nodeAngle) * innerRadius + jitter, 36, width - 36),
        y: clamp(clusterY + Math.sin(nodeAngle) * innerRadius + jitter, 36, height - 36),
        r: recordRadius(node.connectionCount),
      });
    });
  });

  const visible = new Set(layoutNodes.map((node) => node.id));
  const layoutEdges: LayoutHistoryGraphEdge[] = edges
    .filter((edge) => visible.has(edge.fromEntityId) && visible.has(edge.toEntityId))
    .map((edge) => ({
      id: edge.edgeId,
      edgeId: edge.edgeId,
      fromId: edge.fromEntityId,
      toId: edge.toEntityId,
      weight: 1,
      sentence: edge.sentence,
      evidenceCount: edge.evidenceCount,
    }));

  return {
    mode: 'records',
    truncated,
    layoutNodes,
    layoutEdges,
    modeNotice: truncated
      ? `Showing the most connected records (${layoutNodes.length} of ${nodes.length}). Narrow filters for the full set.`
      : 'Records in this view and their published connections.',
  };
}

export function layoutHistoryGraph(
  nodes: readonly HistoryNodeView[],
  edges: readonly HistoryEdgeView[],
  options: LayoutHistoryGraphOptions,
): LayoutHistoryGraphResult {
  const {
    width,
    height,
    seed = 1,
    selectedId,
    recordGraphMax = HISTORY_RECORD_GRAPH_MAX,
    neighborhoodMax = HISTORY_NEIGHBORHOOD_MAX,
  } = options;
  const random = createSeededRandom(seed);
  const selectedInView = Boolean(selectedId && nodes.some((node) => node.entityId === selectedId));
  const mode = resolveHistoryGraphMode(nodes.length, selectedId, selectedInView, recordGraphMax);

  const core =
    mode === 'aggregate'
      ? layoutAggregate(nodes, edges, width, height)
      : mode === 'neighborhood' && selectedId
        ? layoutNeighborhood(nodes, edges, selectedId, width, height, neighborhoodMax, random)
        : layoutRecords(nodes, edges, width, height, recordGraphMax, random);

  return {
    ...core,
    totalNodeCount: nodes.length,
  };
}
