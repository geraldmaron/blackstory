/**
 * Overview statistics for the `/history` browse surface. Aggregates matched record counts,
 * visible connection totals, kind composition from the filtered node set, and decade density
 * from the graph release artifact (pre-filter slice membership).
 */
import type { GraphReleaseArtifact } from '@repo/domain';
import { filterDecadesAtOrBeforeCurrent, buildInclusiveDecadeRange, type DecadeReferenceDate } from '@repo/domain/era';
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
  reference: DecadeReferenceDate = artifact.generatedAt,
): HistoryOverview {
  const kindMap = new Map<string, number>();
  for (const node of nodes) {
    kindMap.set(node.kind, (kindMap.get(node.kind) ?? 0) + 1);
  }

  const kindCounts = [...kindMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, count]) => ({ kind, count }));

  const publishedDecades = filterDecadesAtOrBeforeCurrent(
    artifact.decadeViews.map((view) => view.decade),
    reference,
  );
  const decadeAxis =
    publishedDecades.length === 0
      ? []
      : buildInclusiveDecadeRange(
          publishedDecades[0]!,
          publishedDecades[publishedDecades.length - 1]!,
          reference,
        );
  const decadeDensity = decadeAxis.map((decade) => {
    const view = artifact.decadeViews.find((entry) => entry.decade === decade);
    return {
      decade,
      count: view?.nodeIds.length ?? 0,
    };
  });

  return {
    totalRecords: nodes.length,
    totalConnections: edges.length,
    kindCounts,
    decadeDensity,
  };
}
