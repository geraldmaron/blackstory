"""Deterministic acceptance gates for atomic extracted claims."""

from __future__ import annotations

from collections.abc import Iterable

from .models import (
    AtomicityAssessment,
    ExtractionDecision,
    ExtractionUncertainty,
)

LEGAL_STATUSES = frozenset(
    {
        "alleged",
        "charged",
        "indicted",
        "arraigned",
        "convicted",
        "acquitted",
        "dismissed",
        "settled_civil",
        "ruled",
        "enacted",
        "repealed",
        "unknown_procedural",
    }
)
UNSUPPORTED_PROCEDURAL_LANGUAGE = (
    "guilty as charged",
    "proven murderer",
    "convicted criminal",
    "definitely guilty",
    "undeniably guilty",
    "the criminal",
    "the murderer",
)


def decide_claim_extraction(
    *,
    atomicity: AtomicityAssessment,
    procedural_status: str,
    claim_text: str,
    qualifying_evidence_count: int,
    temporal_context_present: bool,
    geographic_context_present: bool,
    uncertainties: Iterable[ExtractionUncertainty] = (),
) -> ExtractionDecision:
    reasons: list[str] = []
    stored = list(uncertainties)
    if atomicity.assertion_count != 1 or not atomicity.independently_supportable:
        detail = "A claim must contain one independently supportable assertion"
        reasons.append(detail)
        stored.append(ExtractionUncertainty("atomicity", detail, "validator"))
    if procedural_status not in LEGAL_STATUSES:
        detail = f"Unrecognized procedural status: {procedural_status}"
        reasons.append(detail)
        stored.append(ExtractionUncertainty("procedural_status", detail, "validator"))
    lowered = claim_text.casefold()
    unsupported = next(
        (phrase for phrase in UNSUPPORTED_PROCEDURAL_LANGUAGE if phrase in lowered),
        None,
    )
    if unsupported is not None:
        detail = f"Unsupported procedural language: {unsupported}"
        reasons.append(detail)
        stored.append(ExtractionUncertainty("procedural_status", detail, "validator"))
    if qualifying_evidence_count < 1:
        detail = "Claim has no qualifying credible supporting evidence span"
        reasons.append(detail)
        stored.append(ExtractionUncertainty("evidence", detail, "validator"))
    if not temporal_context_present:
        stored.append(
            ExtractionUncertainty(
                "temporal",
                "No temporal context was established during extraction.",
                "validator",
            )
        )
    if not geographic_context_present:
        stored.append(
            ExtractionUncertainty(
                "geographic",
                "No geographic context was established during extraction.",
                "validator",
            )
        )
    return ExtractionDecision(
        decision="accepted" if not reasons else "rejected",
        rejection_reasons=tuple(reasons),
        uncertainties=tuple(stored),
    )
