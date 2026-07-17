"""Approved structured school-history sources adapter definition (BB-046)."""

from __future__ import annotations

from black_book_research.adapters.types import RateLimitPolicy

from ..shared.contract_builder import (
    DEFAULT_FEDERAL_EXPORT_FILTER,
    FEDERAL_SECONDARY_RIGHTS,
    build_federal_adapter_definition,
)
from ..shared.types import FederalRetentionRules

SCHOOL_HISTORY_ADAPTER_ID = "school-history-v1"
SCHOOL_HISTORY_PARSER_VERSION = "parser-1.0.0"

school_history_adapter_definition = build_federal_adapter_definition(
    family="school_history",
    adapter_id=SCHOOL_HISTORY_ADAPTER_ID,
    parser_version=SCHOOL_HISTORY_PARSER_VERSION,
    display_name="Approved Structured School History Sources",
    classification="reputable_secondary",
    stable_id_scheme="school-history-ref",
    source_id="src_school_history",
    organization_id="org_education",
    rights=FEDERAL_SECONDARY_RIGHTS,
    permitted_claim_classes=("institutional_fact", "biographical_fact"),
    rate_limits=RateLimitPolicy(requests_per_minute=10, burst=2),
    expected_records_per_run=40,
    refresh_schedule="0 2 * * 0",
    retention=FederalRetentionRules(
        required_fields=("stableIdentifier", "title", "curriculumTier"),
        min_title_length=5,
        allowed_classifications=("reputable_secondary", "government_record"),
        require_canonical_url=True,
    ),
    export_filter=type(DEFAULT_FEDERAL_EXPORT_FILTER)(
        max_payload_bytes=6144,
        strip_keys=DEFAULT_FEDERAL_EXPORT_FILTER.strip_keys + ("lessonPlanBody", "worksheetPdf"),
        essential_keys=(
            "stableIdentifier",
            "title",
            "canonicalUrl",
            "classification",
            "curriculumTier",
            "gradeBand",
            "publisher",
        ),
    ),
)
