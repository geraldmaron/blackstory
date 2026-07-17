"""Builds BB-037 adapter contracts for federal archive source families (BB-046)."""

from __future__ import annotations

from black_book_research.adapters.types import (
    ADAPTER_CANDIDATE_SCHEMA_VERSION,
    GeographicCoverage,
    RateLimitPolicy,
    RightsPolicy,
    SourceAdapterContract,
    SourceAdapterPolicy,
    VolumeExpectation,
)

from .kill_switch import federal_adapter_kill_switch_id
from .types import FederalAdapterDefinition, FederalAdapterFamily, FederalExportFilterPolicy, FederalRetentionRules

FEDERAL_PUBLIC_DOMAIN_RIGHTS = RightsPolicy(
    default_status="public_domain",
    publication_permissions=("cite", "short_excerpt"),
    prohibited_uses=("biometric_extraction", "full_text_republication"),
)

FEDERAL_GOVERNMENT_RECORD_RIGHTS = RightsPolicy(
    default_status="public_domain",
    publication_permissions=("cite", "short_excerpt", "substantial_excerpt"),
    prohibited_uses=("biometric_extraction", "commercial_reuse"),
)

FEDERAL_SECONDARY_RIGHTS = RightsPolicy(
    default_status="licensed",
    publication_permissions=("cite", "short_excerpt"),
    prohibited_uses=("full_text_republication", "unattributed_reuse"),
)

DEFAULT_FEDERAL_EXPORT_FILTER = FederalExportFilterPolicy(
    max_payload_bytes=8192,
    strip_keys=("fullText", "ocrText", "mediaStream", "binaryBlob", "attachments"),
    essential_keys=(
        "id",
        "stableIdentifier",
        "title",
        "canonicalUrl",
        "classification",
        "date",
        "subjects",
    ),
)

DEFAULT_FEDERAL_RETENTION = FederalRetentionRules(
    required_fields=("stableIdentifier", "title"),
    min_title_length=3,
    allowed_classifications=("primary_archival", "government_record", "reputable_secondary"),
    require_canonical_url=True,
)


def build_federal_adapter_definition(
    *,
    family: FederalAdapterFamily,
    adapter_id: str,
    parser_version: str,
    display_name: str,
    classification: str,
    stable_id_scheme: str,
    source_id: str,
    organization_id: str,
    rights: RightsPolicy,
    permitted_claim_classes: tuple[str, ...],
    rate_limits: RateLimitPolicy,
    expected_records_per_run: int,
    refresh_schedule: str,
    retention: FederalRetentionRules,
    export_filter: FederalExportFilterPolicy,
    count_tolerance_fraction: float = 0.25,
) -> FederalAdapterDefinition:
    kill_switch_id = federal_adapter_kill_switch_id(adapter_id)
    policy = SourceAdapterPolicy(
        snapshot_mode="selective",
        rights=rights,
        permitted_claim_classes=permitted_claim_classes,
        refresh_schedule=refresh_schedule,
        notes=f"Federal {family} adapter; fixture-only ingestion (BB-046).",
    )
    contract = SourceAdapterContract(
        adapter_id=adapter_id,
        parser_version=parser_version,
        display_name=display_name,
        classification=classification,
        stable_id_scheme=stable_id_scheme,
        policy=policy,
        rights=rights,
        permitted_claim_classes=permitted_claim_classes,
        rate_limits=rate_limits,
        volume=VolumeExpectation(
            expected_records_per_run=expected_records_per_run,
            count_tolerance_fraction=count_tolerance_fraction,
        ),
        geographic_coverage=GeographicCoverage(countries=("US",)),
        expected_schema_version=ADAPTER_CANDIDATE_SCHEMA_VERSION,
        refresh_schedule=refresh_schedule,
    )
    evidence_source: dict[str, object] = {
        "id": source_id,
        "organizationId": organization_id,
        "displayName": display_name,
        "classification": classification,
        "adapterId": adapter_id,
        "stableIdScheme": stable_id_scheme,
        "policy": policy,
        "adapterEnabled": True,
        "killSwitchId": kill_switch_id,
    }
    return FederalAdapterDefinition(
        family=family,
        adapter_id=adapter_id,
        kill_switch_id=kill_switch_id,
        contract=contract,
        evidence_source=evidence_source,
        rights=rights,
        retention=retention,
        export_filter=export_filter,
    )
