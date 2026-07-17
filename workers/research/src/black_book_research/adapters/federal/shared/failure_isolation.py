"""Failure isolation for federal adapter runs (BB-046)."""

from __future__ import annotations

from black_book_research.adapters.run_health import evaluate_run_health
from black_book_research.adapters.types import SourceRegistryEntry

from .types import FederalParseResult, IsolatedFederalRunResult


class FederalAdapterRunContext:
    __slots__ = ("run_id", "started_at", "registry_entry")

    def __init__(
        self,
        *,
        run_id: str,
        started_at: str,
        registry_entry: SourceRegistryEntry,
    ) -> None:
        self.run_id = run_id
        self.started_at = started_at
        self.registry_entry = registry_entry


def build_isolated_federal_run_result(
    *,
    context: FederalAdapterRunContext,
    parse_result: FederalParseResult | None = None,
    error: Exception | None = None,
    completed_at: str,
    consecutive_quarantines: int = 0,
    dead_letter_threshold: int = 3,
) -> IsolatedFederalRunResult:
    adapter_id = context.registry_entry.contract.adapter_id

    if error is not None:
        return IsolatedFederalRunResult(
            adapter_id=adapter_id,
            run_id=context.run_id,
            outcome="dead_letter",
            candidate_count=0,
            issues=(f"adapter_error:{error}",),
            completed_at=completed_at,
            publication_impact="none",
            candidates=(),
        )

    parsed = parse_result or FederalParseResult(candidates=(), rejected=(), filtered_export_count=0)
    contract = context.registry_entry.contract
    health = evaluate_run_health(
        expected_count=contract.volume.expected_records_per_run,
        actual_count=len(parsed.candidates),
        count_tolerance_fraction=contract.volume.count_tolerance_fraction,
        expected_schema_version=contract.expected_schema_version,
        observed_schema_version=contract.expected_schema_version,
    )

    outcome = health.outcome
    issues = list(health.details)
    if parsed.rejected:
        issues.append(f"retention_rejected:{len(parsed.rejected)}")
    if parsed.filtered_export_count:
        issues.append(f"large_export_filtered:{parsed.filtered_export_count}")

    if outcome == "quarantined" and consecutive_quarantines + 1 >= dead_letter_threshold:
        outcome = "dead_letter"
        issues.append("consecutive_quarantine_threshold_exceeded")

    candidates = parsed.candidates if outcome == "success" else ()
    return IsolatedFederalRunResult(
        adapter_id=adapter_id,
        run_id=context.run_id,
        outcome=outcome,
        candidate_count=len(candidates),
        issues=tuple(issues),
        completed_at=completed_at,
        publication_impact="none",
        candidates=candidates,
    )
