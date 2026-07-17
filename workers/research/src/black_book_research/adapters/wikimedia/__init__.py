"""Wikimedia discovery adapter package (BB-045)."""

from .bulk import parse_wikimedia_bulk_batch
from .category_gate import assert_category_gate_passed, evaluate_category_gate
from .category_graph import DEFAULT_WIKIMEDIA_CATEGORY_GRAPH
from .normalizer import (
    candidates_equivalent,
    normalize_wikimedia_api_fetch,
    normalize_wikimedia_bulk_batch,
)
from .search import (
    assert_search_snippets_not_copied,
    build_api_fetch_from_fixtures,
    parse_mediawiki_search_response,
)
from .types import (
    WIKIMEDIA_ADAPTER_ID,
    WIKIMEDIA_PARSER_VERSION,
    WIKIMEDIA_PAYLOAD_SCHEMA_VERSION,
)

__all__ = [
    "DEFAULT_WIKIMEDIA_CATEGORY_GRAPH",
    "WIKIMEDIA_ADAPTER_ID",
    "WIKIMEDIA_PARSER_VERSION",
    "WIKIMEDIA_PAYLOAD_SCHEMA_VERSION",
    "assert_category_gate_passed",
    "assert_search_snippets_not_copied",
    "build_api_fetch_from_fixtures",
    "candidates_equivalent",
    "evaluate_category_gate",
    "normalize_wikimedia_api_fetch",
    "normalize_wikimedia_bulk_batch",
    "parse_mediawiki_search_response",
    "parse_wikimedia_bulk_batch",
]
