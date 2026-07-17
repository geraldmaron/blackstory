"""Immutable contracts for deterministic claim parsing and evidence spans."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True, slots=True)
class AtomicityAssessment:
    assertion_count: int
    independently_supportable: bool
    rationale: str


@dataclass(frozen=True, slots=True)
class ExtractionUncertainty:
    code: Literal[
        "atomicity",
        "entity",
        "predicate",
        "object",
        "quotation",
        "temporal",
        "geographic",
        "procedural_status",
        "evidence",
    ]
    detail: str
    recorded_by: Literal["parser", "researcher", "validator"]


@dataclass(frozen=True, slots=True)
class ParsedClaimLine:
    line_number: int
    entity_id: str
    predicate: str
    object: str
    uncertainties: tuple[ExtractionUncertainty, ...] = ()


@dataclass(frozen=True, slots=True)
class EvidenceSpan:
    id: str
    evidence_id: str
    source_item_id: str
    offset_start: int
    offset_end: int
    text: str
    exact_quotation: bool
    locator: tuple[tuple[str, str], ...]


@dataclass(frozen=True, slots=True)
class ExtractionDecision:
    decision: Literal["accepted", "rejected"]
    rejection_reasons: tuple[str, ...]
    uncertainties: tuple[ExtractionUncertainty, ...]
