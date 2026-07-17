"""Adapter run health evaluation mirroring domain run-health (BB-037)."""

from __future__ import annotations

from .types import EvaluateRunHealthResult, RunHealthIssue


def _is_count_within_tolerance(
    expected: int, actual: int, tolerance_fraction: float
) -> bool:
    if expected == 0:
        return actual == 0
    delta = abs(actual - expected) / expected
    return delta <= tolerance_fraction


def evaluate_run_health(
    *,
    expected_count: int,
    actual_count: int,
    expected_schema_version: str,
    observed_schema_version: str,
    count_tolerance_fraction: float = 0.15,
    null_field_rate: float | None = None,
    max_null_field_rate: float | None = None,
    missing_required_fields: tuple[str, ...] = (),
) -> EvaluateRunHealthResult:
    issues: list[RunHealthIssue] = []
    details: list[str] = []

    if not _is_count_within_tolerance(
        expected_count, actual_count, count_tolerance_fraction
    ):
        issues.append("record_count_drift")
        details.append(
            "Record count drift: "
            f"expected {expected_count}, got {actual_count} "
            f"(tolerance {count_tolerance_fraction})"
        )

    if observed_schema_version != expected_schema_version:
        issues.append("schema_version_drift")
        details.append(
            "Schema version drift: "
            f"expected {expected_schema_version}, got {observed_schema_version}"
        )

    if (
        null_field_rate is not None
        and max_null_field_rate is not None
        and null_field_rate > max_null_field_rate
    ):
        issues.append("null_field_spike")
        details.append(
            f"Null field rate {null_field_rate} exceeds max {max_null_field_rate}"
        )

    if missing_required_fields:
        issues.append("missing_required_field")
        details.append(f"Missing required fields: {', '.join(missing_required_fields)}")

    outcome = "quarantined" if issues else "success"
    return EvaluateRunHealthResult(
        outcome=outcome, issues=tuple(issues), details=tuple(details)
    )


def should_quarantine_run(result: EvaluateRunHealthResult) -> bool:
    return result.outcome == "quarantined"


def should_dead_letter_run(consecutive_quarantines: int, threshold: int = 3) -> bool:
    return consecutive_quarantines >= threshold
