"""Versioned historical query packs public surface (BB-038)."""

from .classification import (
    assert_may_promote_beyond_candidate,
    classify_signal_strength,
    may_promote_beyond_candidate,
    outcome_for_signal_strength,
)
from .discovery import assert_discovery_run_stamped, stamp_discovery_run
from .metrics import (
    EffectivenessMetricStore,
    RecordEffectivenessInput,
    compute_effectiveness_metrics,
    create_in_memory_effectiveness_store,
    record_query_pack_metric,
)
from .pack import (
    BuildQueryPackInput,
    assert_query_pack_valid,
    build_query_pack,
    build_query_pack_version_id,
    compute_query_pack_content_hash,
    evaluate_text_against_terms,
)
from .registry import (
    QueryPackRegistryStore,
    create_in_memory_query_pack_registry,
    get_query_pack,
    list_query_packs,
    register_query_pack,
    resolve_query_pack_for_run,
)
from .terms import (
    assert_query_term_valid,
    assert_query_terms_valid,
    count_redacted_terms,
    to_public_safe_terms,
    to_research_query_terms,
)
from .types import (
    QUERY_PACK_SCHEMA_VERSION,
    ClassifySignalResult,
    DiscoveryRunContext,
    PublicSafeTerm,
    QueryPack,
    QueryPackEffectivenessMetrics,
    QueryPackEffectivenessRecord,
    QueryPackVersion,
    QueryTerm,
    StampedDiscoveryRun,
)

__all__ = [
    "QUERY_PACK_SCHEMA_VERSION",
    "BuildQueryPackInput",
    "ClassifySignalResult",
    "DiscoveryRunContext",
    "EffectivenessMetricStore",
    "PublicSafeTerm",
    "QueryPack",
    "QueryPackEffectivenessMetrics",
    "QueryPackEffectivenessRecord",
    "QueryPackRegistryStore",
    "QueryPackVersion",
    "QueryTerm",
    "RecordEffectivenessInput",
    "StampedDiscoveryRun",
    "assert_discovery_run_stamped",
    "assert_may_promote_beyond_candidate",
    "assert_query_pack_valid",
    "assert_query_term_valid",
    "assert_query_terms_valid",
    "build_query_pack",
    "build_query_pack_version_id",
    "classify_signal_strength",
    "compute_effectiveness_metrics",
    "compute_query_pack_content_hash",
    "count_redacted_terms",
    "create_in_memory_effectiveness_store",
    "create_in_memory_query_pack_registry",
    "evaluate_text_against_terms",
    "get_query_pack",
    "list_query_packs",
    "may_promote_beyond_candidate",
    "outcome_for_signal_strength",
    "record_query_pack_metric",
    "register_query_pack",
    "resolve_query_pack_for_run",
    "stamp_discovery_run",
    "to_public_safe_terms",
    "to_research_query_terms",
]
