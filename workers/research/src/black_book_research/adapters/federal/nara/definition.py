"""National Archives catalog adapter definition (BB-046)."""

from __future__ import annotations

from black_book_research.adapters.types import RateLimitPolicy

from ..shared.contract_builder import (
    DEFAULT_FEDERAL_EXPORT_FILTER,
    DEFAULT_FEDERAL_RETENTION,
    FEDERAL_GOVERNMENT_RECORD_RIGHTS,
    build_federal_adapter_definition,
)

NARA_ADAPTER_ID = "nara-catalog-v1"
NARA_PARSER_VERSION = "parser-1.2.0"

nara_adapter_definition = build_federal_adapter_definition(
    family="nara",
    adapter_id=NARA_ADAPTER_ID,
    parser_version=NARA_PARSER_VERSION,
    display_name="National Archives Catalog",
    classification="primary_archival",
    stable_id_scheme="nara-naid",
    source_id="src_nara",
    organization_id="org_nara",
    rights=FEDERAL_GOVERNMENT_RECORD_RIGHTS,
    permitted_claim_classes=("biographical_fact", "institutional_fact"),
    rate_limits=RateLimitPolicy(requests_per_minute=30, burst=5),
    expected_records_per_run=100,
    refresh_schedule="0 6 * * 1",
    retention=DEFAULT_FEDERAL_RETENTION,
    export_filter=type(DEFAULT_FEDERAL_EXPORT_FILTER)(
        max_payload_bytes=DEFAULT_FEDERAL_EXPORT_FILTER.max_payload_bytes,
        strip_keys=DEFAULT_FEDERAL_EXPORT_FILTER.strip_keys + ("digitalObjects", "scopeAndContentNote"),
        essential_keys=(
            "stableIdentifier",
            "title",
            "canonicalUrl",
            "classification",
            "recordGroup",
            "series",
        ),
    ),
)
