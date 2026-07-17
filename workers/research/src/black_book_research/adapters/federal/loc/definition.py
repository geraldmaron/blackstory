"""Library of Congress adapter definition (BB-046)."""

from __future__ import annotations

from black_book_research.adapters.types import RateLimitPolicy

from ..shared.contract_builder import (
    DEFAULT_FEDERAL_EXPORT_FILTER,
    DEFAULT_FEDERAL_RETENTION,
    FEDERAL_PUBLIC_DOMAIN_RIGHTS,
    build_federal_adapter_definition,
)
from ..shared.types import FederalRetentionRules

LOC_ADAPTER_ID = "loc-collections-v1"
LOC_PARSER_VERSION = "parser-1.0.0"

loc_adapter_definition = build_federal_adapter_definition(
    family="loc",
    adapter_id=LOC_ADAPTER_ID,
    parser_version=LOC_PARSER_VERSION,
    display_name="Library of Congress Collections",
    classification="primary_archival",
    stable_id_scheme="loc-lccn",
    source_id="src_loc",
    organization_id="org_loc",
    rights=FEDERAL_PUBLIC_DOMAIN_RIGHTS,
    permitted_claim_classes=("biographical_fact", "geographic_fact", "institutional_fact"),
    rate_limits=RateLimitPolicy(requests_per_minute=20, burst=3),
    expected_records_per_run=50,
    refresh_schedule="0 4 * * 2",
    retention=FederalRetentionRules(
        required_fields=DEFAULT_FEDERAL_RETENTION.required_fields,
        min_title_length=DEFAULT_FEDERAL_RETENTION.min_title_length,
        allowed_classifications=("primary_archival", "government_record"),
        require_canonical_url=DEFAULT_FEDERAL_RETENTION.require_canonical_url,
    ),
    export_filter=type(DEFAULT_FEDERAL_EXPORT_FILTER)(
        max_payload_bytes=DEFAULT_FEDERAL_EXPORT_FILTER.max_payload_bytes,
        strip_keys=DEFAULT_FEDERAL_EXPORT_FILTER.strip_keys + ("imageTiles", "marcRecord"),
        essential_keys=(
            "stableIdentifier",
            "title",
            "canonicalUrl",
            "classification",
            "lccn",
            "date",
            "subjects",
        ),
    ),
)
