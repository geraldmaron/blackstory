"""Category membership gate — category presence never implies automatic inclusion (BB-045)."""

from __future__ import annotations

from .category_graph import (
    DEFAULT_WIKIMEDIA_CATEGORY_GRAPH,
    CategoryGraph,
    list_seed_category_titles,
    traverse_category_graph,
)
from .types import WikimediaCategoryGateResult


def evaluate_category_gate(
    page_categories: tuple[str, ...],
    *,
    graph: CategoryGraph = DEFAULT_WIKIMEDIA_CATEGORY_GRAPH,
) -> WikimediaCategoryGateResult:
    seed_titles = {title.lower() for title in list_seed_category_titles(graph)}
    matched = tuple(category for category in page_categories if category.lower() in seed_titles)
    traversed_ids = traverse_category_graph(graph, page_categories)
    title_by_id = {node.id: node.title for node in graph.nodes}
    traversed_categories = tuple(title_by_id[node_id] for node_id in traversed_ids if node_id in title_by_id)

    if not matched:
        return WikimediaCategoryGateResult(
            passed=False,
            matched_seed_categories=(),
            traversed_categories=traversed_categories,
            reason="No curated seed category membership",
        )

    return WikimediaCategoryGateResult(
        passed=True,
        matched_seed_categories=matched,
        traversed_categories=traversed_categories,
        reason=f"Matched seed categories: {', '.join(matched)}",
    )


def assert_category_gate_passed(result: WikimediaCategoryGateResult) -> None:
    if not result.passed:
        raise ValueError(f"Wikimedia category gate failed: {result.reason}")
