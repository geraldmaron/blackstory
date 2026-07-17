"""BB-084: proves the Python-side source-drift-run-health schedulable entry point calls the
real, existing evaluate_run_health/should_quarantine_run/should_dead_letter_run functions
(adapters/run_health.py, BB-037) rather than reimplementing drift evaluation."""

from black_book_research.scheduled_jobs import run_source_drift_run_health_job


def test_healthy_run_completes_as_success() -> None:
    result = run_source_drift_run_health_job(
        job_run_id="run-1",
        started_at="2026-07-17T04:00:00Z",
        completed_at="2026-07-17T04:02:00Z",
        adapter_id="nara-catalog-v1",
        consecutive_quarantines=0,
        expected_count=1000,
        actual_count=1010,
        expected_schema_version="1.0.0",
        observed_schema_version="1.0.0",
    )
    assert result.run.status == "success"
    assert result.quarantined is False
    assert result.dead_letter is False
    assert result.run.issues == ()
    assert result.run.duration_ms == 120_000


def test_record_count_drift_quarantines_the_run() -> None:
    result = run_source_drift_run_health_job(
        job_run_id="run-2",
        started_at="2026-07-17T04:00:00Z",
        completed_at="2026-07-17T04:02:00Z",
        adapter_id="nara-catalog-v1",
        consecutive_quarantines=0,
        expected_count=1000,
        actual_count=10,
        expected_schema_version="1.0.0",
        observed_schema_version="1.0.0",
    )
    assert result.run.status == "quarantined"
    assert result.quarantined is True
    assert "record_count_drift" in result.run.issues


def test_third_consecutive_quarantine_dead_letters() -> None:
    result = run_source_drift_run_health_job(
        job_run_id="run-3",
        started_at="2026-07-17T04:00:00Z",
        completed_at="2026-07-17T04:02:00Z",
        adapter_id="nara-catalog-v1",
        consecutive_quarantines=2,
        expected_count=1000,
        actual_count=10,
        expected_schema_version="1.0.0",
        observed_schema_version="1.0.0",
    )
    assert result.dead_letter is True
