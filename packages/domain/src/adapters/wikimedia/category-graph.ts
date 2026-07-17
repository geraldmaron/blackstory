/**
 * Curated Wikipedia category graph for bounded discovery traversal (BB-045).
 * Membership in any category does not imply inclusion — see category-gate.ts.
 */
export type CategoryGraphNodeRole = 'seed' | 'expand' | 'reference';

export type CategoryGraphNode = {
  readonly id: string;
  readonly title: string;
  readonly role: CategoryGraphNodeRole;
  readonly description?: string;
};

export type CategoryGraphEdge = {
  readonly from: string;
  readonly to: string;
  readonly relation: 'parent' | 'child';
};

export type CategoryGraph = {
  readonly version: string;
  readonly project: string;
  readonly nodes: readonly CategoryGraphNode[];
  readonly edges: readonly CategoryGraphEdge[];
};

/** Default curated graph for US public-history and biographical discovery seeds. */
export const DEFAULT_WIKIMEDIA_CATEGORY_GRAPH: CategoryGraph = {
  version: 'wikimedia-category-graph.v1',
  project: 'en.wikipedia.org',
  nodes: [
    {
      id: 'cat_african_american_history',
      title: 'Category:African-American history',
      role: 'seed',
      description: 'Seed category for civil-rights and Black history discovery.',
    },
    {
      id: 'cat_civil_rights_movement',
      title: 'Category:Civil rights movement',
      role: 'seed',
    },
    {
      id: 'cat_african_american_activists',
      title: 'Category:African-American activists',
      role: 'seed',
    },
    {
      id: 'cat_national_register_places',
      title: 'Category:National Register of Historic Places',
      role: 'expand',
      description: 'Expand traversal only; membership alone does not include a page.',
    },
    {
      id: 'cat_births_by_year',
      title: 'Category:Births by year',
      role: 'reference',
      description: 'Reference taxonomy; never grants inclusion on its own.',
    },
    {
      id: 'cat_deaths_by_year',
      title: 'Category:Deaths by year',
      role: 'reference',
    },
  ],
  edges: [
    { from: 'cat_african_american_history', to: 'cat_civil_rights_movement', relation: 'parent' },
    { from: 'cat_civil_rights_movement', to: 'cat_african_american_activists', relation: 'parent' },
    { from: 'cat_african_american_history', to: 'cat_national_register_places', relation: 'child' },
  ],
};

const nodeIndex = (graph: CategoryGraph): ReadonlyMap<string, CategoryGraphNode> =>
  new Map(graph.nodes.map((node) => [node.id, node]));

export function getCategoryGraphNode(
  graph: CategoryGraph,
  nodeId: string,
): CategoryGraphNode | undefined {
  return nodeIndex(graph).get(nodeId);
}

export function listSeedCategoryTitles(graph: CategoryGraph): readonly string[] {
  return graph.nodes.filter((node) => node.role === 'seed').map((node) => node.title);
}

export function listExpandCategoryTitles(graph: CategoryGraph): readonly string[] {
  return graph.nodes.filter((node) => node.role === 'expand').map((node) => node.title);
}

/** Traverse curated graph from page categories to related graph node ids (bounded, no live API). */
export function traverseCategoryGraph(
  graph: CategoryGraph,
  pageCategories: readonly string[],
): readonly string[] {
  const normalizedPageCategories = new Set(pageCategories.map(normalizeCategoryTitle));
  const visited = new Set<string>();
  const queue = graph.nodes
    .filter((node) => normalizedPageCategories.has(normalizeCategoryTitle(node.title)))
    .map((node) => node.id);

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);
    for (const edge of graph.edges) {
      const neighbor =
        edge.from === currentId ? edge.to : edge.to === currentId ? edge.from : undefined;
      if (neighbor && !visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return [...visited];
}

export function normalizeCategoryTitle(title: string): string {
  return title.trim().replace(/\s+/g, '_');
}

export function resolveGraphNodeIdByTitle(
  graph: CategoryGraph,
  categoryTitle: string,
): string | undefined {
  const normalized = normalizeCategoryTitle(categoryTitle);
  const match = graph.nodes.find(
    (node) => normalizeCategoryTitle(node.title) === normalized,
  );
  return match?.id;
}
