/**
 * Overview statistics for the `/history` browse surface. Aggregates matched record counts,
 * visible connection totals, kind composition from the filtered node set, and decade density
 * from the graph release artifact (pre-filter slice membership).
 */
import type { GraphReleaseArtifact } from '@repo/domain';
import type { HistoryEdgeView, HistoryNodeView } from './build-history-graph';

export type HistoryOverview = {
  readonly totalRecords: number;
  readonly totalConnections: number;
  readonly kindCounts: ReadonlyArray<{ readonly kind: string; readonly count: number }>;
  readonly decadeDensity: ReadonlyArray<{ readonly decade: string; readonly count: number }>;
};

export function buildHistoryOverview(
  nodes: readonly HistoryNodeView[],
  edges: readonly HistoryEdgeView[],
  artifact: GraphReleaseArtifact,
): HistoryOverview {
  const kindMap = new Map<string, number>();
  for (const node of nodes) {
    kindMap.set(node.kind, (kindMap.get(node.kind) ?? 0) + 1);
  }

  const kindCounts = [...kindMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, count]) => ({ kind, count }));

  const decadeDensity = artifact.decadeViews.map((view) => ({
    decade: view.decade,
    count: view.nodeIds.length,
  }));

  return {
    totalRecords: nodes.length,
    totalConnections: edges.length,
    kindCounts,
    decadeDensity,
  };
}
