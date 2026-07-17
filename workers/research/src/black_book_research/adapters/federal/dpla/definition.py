"""Digital Public Library of America adapter definition (BB-046)."""

from __future__ import annotations

from black_book_research.adapters.types import RateLimitPolicy

from ..shared.contract_builder import (
    DEFAULT_FEDERAL_EXPORT_FILTER,
    DEFAULT_FEDERAL_RETENTION,
    FEDERAL_SECONDARY_RIGHTS,
    build_federal_adapter_definition,
)
from ..shared.types import FederalRetentionRules

DPLA_ADAPTER_ID = "dpla-items-v1"
DPLA_PARSER_VERSION = "parser-1.0.0"

dpla_adapter_definition = build_federal_adapter_definition(
    family="dpla",
    adapter_id=DPLA_ADAPTER_ID,
    parser_version=DPLA_PARSER_VERSION,
    display_name="Digital Public Library of America",
    classification="reputable_secondary",
    stable_id_scheme="dpla-item",
    source_id="src_dpla",
    organization_id="org_dpla",
    rights=FEDERAL_SECONDARY_RIGHTS,
    permitted_claim_classes=("biographical_fact", "geographic_fact"),
    rate_limits=RateLimitPolicy(requests_per_minute=60, burst=10),
    expected_records_per_run=200,
    refresh_schedule="0 3 * * 3",
    retention=FederalRetentionRules(
        required_fields=DEFAULT_FEDERAL_RETENTION.required_fields,
        min_title_length=DEFAULT_FEDERAL_RETENTION.min_title_length,
        allowed_classifications=(
            "primary_archival",
            "government_record",
            "reputable_secondary",
        ),
        require_canonical_url=DEFAULT_FEDERAL_RETENTION.require_canonical_url,
    ),
    export_filter=type(DEFAULT_FEDERAL_EXPORT_FILTER)(
        max_payload_bytes=4096,
        strip_keys=DEFAULT_FEDERAL_EXPORT_FILTER.strip_keys + ("aggregatedPreview", "providerRecord"),
        essential_keys=(
            "stableIdentifier",
            "title",
            "canonicalUrl",
            "classification",
            "provider",
            "date",
        ),
    ),
)
