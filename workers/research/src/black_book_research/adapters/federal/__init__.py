"""Federal archive and public-history adapter package (BB-046)."""

from .dpla.definition import DPLA_ADAPTER_ID, dpla_adapter_definition
from .loc.definition import LOC_ADAPTER_ID, loc_adapter_definition
from .nara.definition import NARA_ADAPTER_ID, nara_adapter_definition
from .nps.definition import NPS_ADAPTER_ID, nps_adapter_definition
from .school_history.definition import (
    SCHOOL_HISTORY_ADAPTER_ID,
    school_history_adapter_definition,
)
from .shared.contract_builder import (
    DEFAULT_FEDERAL_EXPORT_FILTER,
    DEFAULT_FEDERAL_RETENTION,
    FEDERAL_GOVERNMENT_RECORD_RIGHTS,
    FEDERAL_PUBLIC_DOMAIN_RIGHTS,
    FEDERAL_SECONDARY_RIGHTS,
    build_federal_adapter_definition,
)
from .shared.export_filter import ExportFilterResult, filter_large_export_payload
from .shared.failure_isolation import FederalAdapterRunContext, build_isolated_federal_run_result
from .shared.kill_switch import (
    FEDERAL_ADAPTER_KILL_SWITCH_PREFIX,
    federal_adapter_kill_switch_id,
    parse_federal_adapter_kill_switch_id,
)
from .shared.parser import parse_federal_fixture_batch
from .shared.retention import partition_by_retention, qualifies_for_candidate_retention
from .shared.types import (
    FederalAdapterDefinition,
    FederalExportFilterPolicy,
    FederalParseResult,
    FederalRejectedRecord,
    FederalRetentionRules,
    IsolatedFederalRunResult,
)

FEDERAL_ADAPTER_DEFINITIONS: tuple[FederalAdapterDefinition, ...] = (
    loc_adapter_definition,
    nara_adapter_definition,
    dpla_adapter_definition,
    nps_adapter_definition,
    school_history_adapter_definition,
)


def get_federal_adapter_definition(adapter_id: str) -> FederalAdapterDefinition | None:
    for definition in FEDERAL_ADAPTER_DEFINITIONS:
        if definition.adapter_id == adapter_id:
            return definition
    return None


__all__ = [
    "DEFAULT_FEDERAL_EXPORT_FILTER",
    "DEFAULT_FEDERAL_RETENTION",
    "DPLA_ADAPTER_ID",
    "FEDERAL_ADAPTER_DEFINITIONS",
    "FEDERAL_ADAPTER_KILL_SWITCH_PREFIX",
    "FEDERAL_GOVERNMENT_RECORD_RIGHTS",
    "FEDERAL_PUBLIC_DOMAIN_RIGHTS",
    "FEDERAL_SECONDARY_RIGHTS",
    "LOC_ADAPTER_ID",
    "NARA_ADAPTER_ID",
    "NPS_ADAPTER_ID",
    "SCHOOL_HISTORY_ADAPTER_ID",
    "ExportFilterResult",
    "FederalAdapterDefinition",
    "FederalAdapterRunContext",
    "FederalExportFilterPolicy",
    "FederalParseResult",
    "FederalRejectedRecord",
    "FederalRetentionRules",
    "IsolatedFederalRunResult",
    "build_federal_adapter_definition",
    "build_isolated_federal_run_result",
    "dpla_adapter_definition",
    "federal_adapter_kill_switch_id",
    "filter_large_export_payload",
    "get_federal_adapter_definition",
    "loc_adapter_definition",
    "nara_adapter_definition",
    "nps_adapter_definition",
    "parse_federal_adapter_kill_switch_id",
    "parse_federal_fixture_batch",
    "partition_by_retention",
    "qualifies_for_candidate_retention",
    "school_history_adapter_definition",
]
