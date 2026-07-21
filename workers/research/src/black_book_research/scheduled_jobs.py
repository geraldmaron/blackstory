"""BB-084: schedulable entry points for the research worker.

Historical Cloud Scheduler dispatch targeted Cloud Run Jobs (ADR-007). Scheduled discovery and
overnight enrichment now run on Corsair/systemd against the Postgres research ledger; this module
retains the source-drift run-health job shape for adapter evaluation only.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from .adapters.run_health import (
    evaluate_run_health,
    should_dead_letter_run,
    should_quarantine_run,
)

SOURCE_DRIFT_RUN_HEALTH_JOB_ID = "source-drift-run-health-check"


@dataclass(frozen=True, slots=True)
class JobRunRecord:
    """Mirrors packages/config/src/scheduled-jobs/run-record.ts's JobRunRecord shape."""

    job_run_id: str
    job_id: str
    started_at: str
    completed_at: str
    duration_ms: int
    status: str  # 'success' | 'quarantined'
    items_expected: int
    items_processed: int
    issues: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class SourceDriftRunHealthJobResult:
    run: JobRunRecord
    adapter_id: str
    quarantined: bool
    dead_letter: bool


def _duration_ms(started_at: str, completed_at: str) -> int:
    start = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
    end = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
    return int((end - start).total_seconds() * 1000)


def run_source_drift_run_health_job(
    *,
    job_run_id: str,
    started_at: str,
    completed_at: str,
    adapter_id: str,
    consecutive_quarantines: int,
    expected_count: int,
    actual_count: int,
    expected_schema_version: str,
    observed_schema_version: str,
    count_tolerance_fraction: float = 0.15,
    null_field_rate: float | None = None,
    max_null_field_rate: float | None = None,
    missing_required_fields: tuple[str, ...] = (),
) -> SourceDriftRunHealthJobResult:
    """Schedulable entry point for the 'source-drift-run-health-check' registry job.

    Calls the existing evaluate_run_health (BB-037) unchanged; only adapts its input/output into
    the generic job-run-record shape so it can be scheduled through the BB-084 registry.
    """
    health = evaluate_run_health(
        expected_count=expected_count,
        actual_count=actual_count,
        expected_schema_version=expected_schema_version,
        observed_schema_version=observed_schema_version,
        count_tolerance_fraction=count_tolerance_fraction,
        null_field_rate=null_field_rate,
        max_null_field_rate=max_null_field_rate,
        missing_required_fields=missing_required_fields,
    )
    quarantined = should_quarantine_run(health)
    # should_dead_letter_run expects the consecutive-quarantine count *including* this run.
    dead_letter = quarantined and should_dead_letter_run(consecutive_quarantines + 1)

    run = JobRunRecord(
        job_run_id=job_run_id,
        job_id=SOURCE_DRIFT_RUN_HEALTH_JOB_ID,
        started_at=started_at,
        completed_at=completed_at,
        duration_ms=_duration_ms(started_at, completed_at),
        status="quarantined" if quarantined else "success",
        items_expected=expected_count,
        items_processed=actual_count,
        issues=health.issues,
    )
    return SourceDriftRunHealthJobResult(
        run=run,
        adapter_id=adapter_id,
        quarantined=quarantined,
        dead_letter=dead_letter,
    )


def now_iso() -> str:
    """UTC now as an ISO-8601 string with a 'Z' suffix, matching the TS side's format."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
