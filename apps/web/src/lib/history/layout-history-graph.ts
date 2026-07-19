/**
 * Deterministic kind-clustered layout for the `/history` graph SVG. Caps node count,
 * filters edges to the laid-out set, and uses a seeded PRNG so identical inputs always
 * produce identical coordinates.
 */
import type { HistoryEdgeView, HistoryNodeView } from './build-history-graph';

export type LayoutHistoryGraphOptions = {
  readonly width: number;
  readonly height: number;
  readonly seed?: number;
  readonly maxNodes?: number;
};

export type LayoutHistoryGraphNode = {
  readonly entityId: string;
  readonly displayName: string;
  readonly kind: string;
  readonly statusLabel: string;
  readonly connectionCount: number;
  readonly x: number;
  readonly y: number;
};

export type LayoutHistoryGraphEdge = {
  readonly edgeId: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly sentence: string;
  readonly evidenceCount: number;
};

export type LayoutHistoryGraphResult = {
  readonly truncated: boolean;
  readonly totalNodeCount: number;
  readonly layoutNodes: readonly LayoutHistoryGraphNode[];
  readonly layoutEdges: readonly LayoutHistoryGraphEdge[];
};

const DEFAULT_MAX_NODES = 80;

/** Mulberry32 — fast, deterministic 32-bit PRNG. */
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

function compareNodesForTruncation(a: HistoryNodeView, b: HistoryNodeView): number {
  if (b.connectionCount !== a.connectionCount) {
    return b.connectionCount - a.connectionCount;
  }
  return a.displayName.localeCompare(b.displayName);
}

type SimNode = {
  readonly entityId: string;
  readonly displayName: string;
  readonly kind: string;
  readonly statusLabel: string;
  readonly connectionCount: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  clusterX: number;
  clusterY: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function runForceLayout(
  simNodes: SimNode[],
  edgePairs: ReadonlyArray<readonly [string, string]>,
  width: number,
  height: number,
  random: () => number,
): void {
  const padding = 28;
  const minX = padding;
  const maxX = width - padding;
  const minY = padding;
  const maxY = height - padding;
  const nodeById = new Map(simNodes.map((node) => [node.entityId, node]));

  for (let iteration = 0; iteration < 48; iteration += 1) {
    const cooling = 1 - iteration / 48;

    for (let i = 0; i < simNodes.length; i += 1) {
      for (let j = i + 1; j < simNodes.length; j += 1) {
        const a = simNodes[i]!;
        const b = simNodes[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const distSq = dx * dx + dy * dy + 0.01;
        const dist = Math.sqrt(distSq);
        const minDist = 22;
        if (dist < minDist) {
          const force = ((minDist - dist) / dist) * 0.35 * cooling;
          dx *= force;
          dy *= force;
          a.vx -= dx;
          a.vy -= dy;
          b.vx += dx;
          b.vy += dy;
        }
      }
    }

    for (const [fromId, toId] of edgePairs) {
      const from = nodeById.get(fromId);
      const to = nodeById.get(toId);
      if (!from || !to) continue;
      let dx = to.x - from.x;
      let dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy + 0.01);
      const target = 56;
      const force = ((dist - target) / dist) * 0.04 * cooling;
      dx *= force;
      dy *= force;
      from.vx += dx;
      from.vy += dy;
      to.vx -= dx;
      to.vy -= dy;
    }

    for (const node of simNodes) {
      const clusterPull = 0.012 * cooling;
      node.vx += (node.clusterX - node.x) * clusterPull;
      node.vy += (node.clusterY - node.y) * clusterPull;
      node.vx += (random() - 0.5) * 0.02 * cooling;
      node.vy += (random() - 0.5) * 0.02 * cooling;
      node.vx *= 0.82;
      node.vy *= 0.82;
      node.x = clamp(node.x + node.vx, minX, maxX);
      node.y = clamp(node.y + node.vy, minY, maxY);
    }
  }
}

export function layoutHistoryGraph(
  nodes: readonly HistoryNodeView[],
  edges: readonly HistoryEdgeView[],
  options: LayoutHistoryGraphOptions,
): LayoutHistoryGraphResult {
  const { width, height, seed = 1, maxNodes = DEFAULT_MAX_NODES } = options;
  const totalNodeCount = nodes.length;
  const truncated = totalNodeCount > maxNodes;
  const random = createSeededRandom(seed);

  const selectedNodes = truncated
    ? [...nodes].sort(compareNodesForTruncation).slice(0, maxNodes)
    : [...nodes];

  const visibleIds = new Set(selectedNodes.map((node) => node.entityId));

  const kinds = [...new Set(selectedNodes.map((node) => node.kind))].sort((a, b) => a.localeCompare(b));
  const nodesByKind = new Map<string, HistoryNodeView[]>();
  for (const node of selectedNodes) {
    const bucket = nodesByKind.get(node.kind) ?? [];
    bucket.push(node);
    nodesByKind.set(node.kind, bucket);
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const clusterRadius = Math.min(width, height) * 0.32;
  const simNodes: SimNode[] = [];

  kinds.forEach((kind, kindIndex) => {
    const kindNodes = nodesByKind.get(kind) ?? [];
    const clusterAngle = (kindIndex / kinds.length) * Math.PI * 2 - Math.PI / 2;
    const clusterX = centerX + Math.cos(clusterAngle) * clusterRadius;
    const clusterY = centerY + Math.sin(clusterAngle) * clusterRadius;
    const innerRadius = Math.min(36 + kindNodes.length * 4, clusterRadius * 0.55);

    kindNodes.forEach((node, nodeIndex) => {
      const nodeAngle =
        kindNodes.length === 1
          ? clusterAngle + Math.PI
          : (nodeIndex / kindNodes.length) * Math.PI * 2;
      const jitter = (random() - 0.5) * 8;
      simNodes.push({
        entityId: node.entityId,
        displayName: node.displayName,
        kind: node.kind,
        statusLabel: node.statusLabel,
        connectionCount: node.connectionCount,
        x: clusterX + Math.cos(nodeAngle) * innerRadius + jitter,
        y: clusterY + Math.sin(nodeAngle) * innerRadius + jitter,
        vx: 0,
        vy: 0,
        clusterX,
        clusterY,
      });
    });
  });

  const edgePairs: Array<[string, string]> = [];
  const layoutEdges: LayoutHistoryGraphEdge[] = [];

  for (const edge of edges) {
    if (!visibleIds.has(edge.fromEntityId) || !visibleIds.has(edge.toEntityId)) continue;
    edgePairs.push([edge.fromEntityId, edge.toEntityId]);
    layoutEdges.push({
      edgeId: edge.edgeId,
      fromEntityId: edge.fromEntityId,
      toEntityId: edge.toEntityId,
      sentence: edge.sentence,
      evidenceCount: edge.evidenceCount,
    });
  }

  runForceLayout(simNodes, edgePairs, width, height, random);

  const layoutNodes: LayoutHistoryGraphNode[] = simNodes.map((node) => ({
    entityId: node.entityId,
    displayName: node.displayName,
    kind: node.kind,
    statusLabel: node.statusLabel,
    connectionCount: node.connectionCount,
    x: node.x,
    y: node.y,
  }));

  return {
    truncated,
    totalNodeCount,
    layoutNodes,
    layoutEdges,
  };
}
