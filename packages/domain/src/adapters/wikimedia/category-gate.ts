/**
 * Category membership gate — category presence never implies automatic inclusion (BB-045).
 */
import {
  DEFAULT_WIKIMEDIA_CATEGORY_GRAPH,
  listSeedCategoryTitles,
  resolveGraphNodeIdByTitle,
  traverseCategoryGraph,
  type CategoryGraph,
} from './category-graph.js';
import type { WikimediaCategoryGateResult } from './types.js';

export type EvaluateCategoryGateInput = {
  readonly pageCategories: readonly string[];
  readonly graph?: CategoryGraph;
};

/**
 * Fail-closed gate: a page is eligible only when it matches at least one curated seed category.
 * Expand/reference categories may appear in traversal metadata but never grant inclusion alone.
 */
export function evaluateCategoryGate(input: EvaluateCategoryGateInput): WikimediaCategoryGateResult {
  const graph = input.graph ?? DEFAULT_WIKIMEDIA_CATEGORY_GRAPH;
  const seedTitles = new Set(listSeedCategoryTitles(graph).map((title) => title.toLowerCase()));
  const matchedSeedCategories = input.pageCategories.filter((category) =>
    seedTitles.has(category.toLowerCase()),
  );

  const traversedNodeIds = traverseCategoryGraph(graph, input.pageCategories);
  const traversedCategories = traversedNodeIds
    .map((nodeId) => graph.nodes.find((node) => node.id === nodeId)?.title)
    .filter((title): title is string => Boolean(title));

  if (matchedSeedCategories.length === 0) {
    const referenceOnly = input.pageCategories.some((category) => {
      const nodeId = resolveGraphNodeIdByTitle(graph, category);
      if (!nodeId) {
        return false;
      }
      const node = graph.nodes.find((entry) => entry.id === nodeId);
      return node?.role === 'reference' || node?.role === 'expand';
    });

    return {
      passed: false,
      matchedSeedCategories: [],
      traversedCategories,
      reason: referenceOnly
        ? 'Page categories match expand/reference nodes only; seed category required'
        : 'No curated seed category membership',
    };
  }

  return {
    passed: true,
    matchedSeedCategories,
    traversedCategories,
    reason: `Matched seed categories: ${matchedSeedCategories.join(', ')}`,
  };
}

export function assertCategoryGatePassed(result: WikimediaCategoryGateResult): void {
  if (!result.passed) {
    throw new Error(`Wikimedia category gate failed: ${result.reason}`);
  }
}
