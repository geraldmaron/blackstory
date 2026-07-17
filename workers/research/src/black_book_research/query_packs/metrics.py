"""Query-pack effectiveness metrics (BB-038)."""

from __future__ import annotations

from dataclasses import dataclass, field

from .types import QueryPackEffectivenessMetrics, QueryPackEffectivenessRecord


@dataclass
class EffectivenessMetricStore:
    records: list[QueryPackEffectivenessRecord] = field(default_factory=list)


def create_in_memory_effectiveness_store() -> EffectivenessMetricStore:
    return EffectivenessMetricStore()


@dataclass(frozen=True, slots=True)
class RecordEffectivenessInput:
    pack_id: str
    version_id: str
    run_id: str
    recorded_at: str
    queries_executed: int
    matches_observed: int
    exclusions_observed: int
    false_positive_observed: int


def record_query_pack_metric(
    store: EffectivenessMetricStore,
    input: RecordEffectivenessInput,
) -> QueryPackEffectivenessRecord:
    if min(
        input.queries_executed,
        input.matches_observed,
        input.exclusions_observed,
        input.false_positive_observed,
    ) < 0:
        raise ValueError("Effectiveness counts must be non-negative")

    record = QueryPackEffectivenessRecord(
        pack_id=input.pack_id,
        version_id=input.version_id,
        run_id=input.run_id,
        recorded_at=input.recorded_at,
        queries_executed=input.queries_executed,
        matches_observed=input.matches_observed,
        exclusions_observed=input.exclusions_observed,
        false_positive_observed=input.false_positive_observed,
    )
    store.records.append(record)
    return record


def compute_effectiveness_metrics(
    *,
    pack_id: str,
    version_id: str,
    records: list[QueryPackEffectivenessRecord],
) -> QueryPackEffectivenessMetrics:
    scoped = [record for record in records if record.pack_id == pack_id and record.version_id == version_id]

    total_queries = sum(record.queries_executed for record in scoped)
    total_matches = sum(record.matches_observed for record in scoped)
    total_exclusions = sum(record.exclusions_observed for record in scoped)
    total_false_positives = sum(record.false_positive_observed for record in scoped)

    match_rate = 0 if total_queries == 0 else total_matches / total_queries
    exclusion_rate = 0 if total_matches == 0 else total_exclusions / total_matches
    false_positive_rate = 0 if total_matches == 0 else total_false_positives / total_matches
    effectiveness_score = (
        0 if total_matches == 0 else max(0, match_rate - false_positive_rate - exclusion_rate * 0.25)
    )

    return QueryPackEffectivenessMetrics(
        pack_id=pack_id,
        version_id=version_id,
        record_count=len(scoped),
        total_queries=total_queries,
        total_matches=total_matches,
        total_exclusions=total_exclusions,
        total_false_positives=total_false_positives,
        match_rate=match_rate,
        exclusion_rate=exclusion_rate,
        false_positive_rate=false_positive_rate,
        effectiveness_score=effectiveness_score,
    )
