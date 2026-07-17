"""National Park Service and National Register adapter definition (BB-046)."""

from __future__ import annotations

from black_book_research.adapters.types import RateLimitPolicy

from ..shared.contract_builder import (
    DEFAULT_FEDERAL_EXPORT_FILTER,
    DEFAULT_FEDERAL_RETENTION,
    FEDERAL_GOVERNMENT_RECORD_RIGHTS,
    build_federal_adapter_definition,
)
from ..shared.types import FederalRetentionRules

NPS_ADAPTER_ID = "nps-national-register-v1"
NPS_PARSER_VERSION = "parser-1.0.0"

nps_adapter_definition = build_federal_adapter_definition(
    family="nps",
    adapter_id=NPS_ADAPTER_ID,
    parser_version=NPS_PARSER_VERSION,
    display_name="NPS National Register of Historic Places",
    classification="government_record",
    stable_id_scheme="nps-nrhp-ref",
    source_id="src_nps",
    organization_id="org_nps",
    rights=FEDERAL_GOVERNMENT_RECORD_RIGHTS,
    permitted_claim_classes=("geographic_fact", "institutional_fact", "biographical_fact"),
    rate_limits=RateLimitPolicy(requests_per_minute=15, burst=2),
    expected_records_per_run=75,
    refresh_schedule="0 5 * * 4",
    retention=FederalRetentionRules(
        required_fields=DEFAULT_FEDERAL_RETENTION.required_fields,
        min_title_length=DEFAULT_FEDERAL_RETENTION.min_title_length,
        allowed_classifications=("government_record", "primary_archival"),
        require_canonical_url=DEFAULT_FEDERAL_RETENTION.require_canonical_url,
    ),
    export_filter=type(DEFAULT_FEDERAL_EXPORT_FILTER)(
        max_payload_bytes=DEFAULT_FEDERAL_EXPORT_FILTER.max_payload_bytes,
        strip_keys=DEFAULT_FEDERAL_EXPORT_FILTER.strip_keys + ("boundaryGeojson", "photoArchive"),
        essential_keys=(
            "stableIdentifier",
            "title",
            "canonicalUrl",
            "classification",
            "nrhpReference",
            "state",
            "locality",
        ),
    ),
)
