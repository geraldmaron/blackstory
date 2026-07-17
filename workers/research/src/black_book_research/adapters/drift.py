"""Parser drift metrics mirroring domain drift helpers (BB-037)."""

from __future__ import annotations

from dataclasses import dataclass, field

from .types import DriftAccumulator, EvaluateRunHealthResult, ParserDriftMetric


@dataclass(slots=True)
class InMemoryDriftMetricStore:
    metrics: list[ParserDriftMetric] = field(default_factory=list)

    def list(self, adapter_id: str | None = None) -> list[ParserDriftMetric]:
        if adapter_id is None:
            return list(self.metrics)
        return [metric for metric in self.metrics if metric.adapter_id == adapter_id]

    def record(self, metric: ParserDriftMetric) -> None:
        self.metrics.append(metric)


def create_drift_accumulator(
    *,
    adapter_id: str,
    parser_version: str,
    registry_entry_id: str,
    run_id: str,
    started_at: str,
) -> DriftAccumulator:
    return DriftAccumulator(
        adapter_id=adapter_id,
        parser_version=parser_version,
        registry_entry_id=registry_entry_id,
        run_id=run_id,
        started_at=started_at,
    )


def record_field_observation(
    accumulator: DriftAccumulator, field_name: str, is_null: bool
) -> None:
    counts = accumulator.field_null_counts.setdefault(field_name, {"nulls": 0, "total": 0})
    counts["nulls"] += 1 if is_null else 0
    counts["total"] += 1


def compute_field_null_rates(accumulator: DriftAccumulator) -> dict[str, float]:
    rates: dict[str, float] = {}
    for field_name, counts in accumulator.field_null_counts.items():
        total = counts["total"]
        rates[field_name] = 0.0 if total == 0 else counts["nulls"] / total
    return rates


def build_parser_drift_metric(
    accumulator: DriftAccumulator,
    *,
    expected_count: int,
    actual_count: int,
    expected_schema_version: str,
    observed_schema_version: str,
    health: EvaluateRunHealthResult,
    recorded_at: str,
) -> ParserDriftMetric:
    return ParserDriftMetric(
        adapter_id=accumulator.adapter_id,
        parser_version=accumulator.parser_version,
        registry_entry_id=accumulator.registry_entry_id,
        run_id=accumulator.run_id,
        recorded_at=recorded_at,
        expected_record_count=expected_count,
        actual_record_count=actual_count,
        expected_schema_version=expected_schema_version,
        observed_schema_version=observed_schema_version,
        field_null_rates=compute_field_null_rates(accumulator),
        issues=health.details,
    )
