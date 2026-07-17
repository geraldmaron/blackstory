"""Curated Wikipedia category graph for bounded discovery traversal (BB-045)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

CategoryGraphNodeRole = Literal["seed", "expand", "reference"]


@dataclass(frozen=True, slots=True)
class CategoryGraphNode:
    id: str
    title: str
    role: CategoryGraphNodeRole
    description: str | None = None


@dataclass(frozen=True, slots=True)
class CategoryGraphEdge:
    from_id: str
    to_id: str
    relation: Literal["parent", "child"]


@dataclass(frozen=True, slots=True)
class CategoryGraph:
    version: str
    project: str
    nodes: tuple[CategoryGraphNode, ...]
    edges: tuple[CategoryGraphEdge, ...]


DEFAULT_WIKIMEDIA_CATEGORY_GRAPH = CategoryGraph(
    version="wikimedia-category-graph.v1",
    project="en.wikipedia.org",
    nodes=(
        CategoryGraphNode(
            id="cat_african_american_history",
            title="Category:African-American history",
            role="seed",
            description="Seed category for civil-rights and Black history discovery.",
        ),
        CategoryGraphNode(
            id="cat_civil_rights_movement",
            title="Category:Civil rights movement",
            role="seed",
        ),
        CategoryGraphNode(
            id="cat_african_american_activists",
            title="Category:African-American activists",
            role="seed",
        ),
        CategoryGraphNode(
            id="cat_national_register_places",
            title="Category:National Register of Historic Places",
            role="expand",
        ),
        CategoryGraphNode(
            id="cat_births_by_year",
            title="Category:Births by year",
            role="reference",
        ),
        CategoryGraphNode(
            id="cat_deaths_by_year",
            title="Category:Deaths by year",
            role="reference",
        ),
    ),
    edges=(
        CategoryGraphEdge("cat_african_american_history", "cat_civil_rights_movement", "parent"),
        CategoryGraphEdge("cat_civil_rights_movement", "cat_african_american_activists", "parent"),
        CategoryGraphEdge("cat_african_american_history", "cat_national_register_places", "child"),
    ),
)


def normalize_category_title(title: str) -> str:
    return title.strip().replace(" ", "_")


def list_seed_category_titles(graph: CategoryGraph) -> tuple[str, ...]:
    return tuple(node.title for node in graph.nodes if node.role == "seed")


def traverse_category_graph(graph: CategoryGraph, page_categories: tuple[str, ...]) -> tuple[str, ...]:
    normalized = {normalize_category_title(category) for category in page_categories}
    visited: set[str] = set()
    queue = [
        node.id
        for node in graph.nodes
        if normalize_category_title(node.title) in normalized
    ]

    while queue:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)
        for edge in graph.edges:
            neighbor = edge.to_id if edge.from_id == current else edge.from_id if edge.to_id == current else None
            if neighbor and neighbor not in visited:
                queue.append(neighbor)

    return tuple(sorted(visited))
