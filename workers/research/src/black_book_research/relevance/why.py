"""Human-readable relevance explanations (BB-040)."""

from __future__ import annotations

import re

from .types import RelevanceCandidateInput, RelevanceDecision, RelevanceEvidence, RelevanceOverride

FORBIDDEN_PATTERNS = (
    re.compile(r"\bscore\s*[:\s]\s*0?\.\d+", re.I),
    re.compile(r"\brelevance\s*[:\s]\s*0?\.\d+", re.I),
    re.compile(r"\b0\.\d{2,}\b"),
)


def build_why_this_appears(
    *,
    candidate: RelevanceCandidateInput,
    decision: RelevanceDecision,
    evidence: tuple[RelevanceEvidence, ...],
    exclusion_reason: str | None = None,
    override: RelevanceOverride | None = None,
) -> str:
    if override is not None:
        return f"Manual review override ({decision.replace('_', ' ')}): {override.reason.strip()}"

    if decision == "exclude":
        reason = exclusion_reason
        if reason is None:
            for entry in evidence:
                if entry.kind == "gate" and entry.detail:
                    reason = entry.detail
                    break
        return f"Excluded from inclusion: {reason or 'Candidate was excluded during relevance review.'}"

    summaries = [entry.summary for entry in evidence if entry.kind != "gate"]
    base = " ".join(summaries) if summaries else "No substantive relevance evidence was found."
    place_hint = candidate.geographic_hints[0].text if candidate.geographic_hints else None
    matched_terms = ", ".join(candidate.signals.matched_terms[:3])

    if decision == "include":
        place_phrase = f" with place connection to {place_hint}" if place_hint else ""
        term_phrase = f" Matching terms include {matched_terms}." if matched_terms else ""
        return (
            f"Included because archival and discovery signals connect this record to Black "
            f"historical scope{place_phrase}.{term_phrase} {base}"
        ).strip()

    term_phrase = f" Terms matched: {matched_terms}." if matched_terms else ""
    return (
        "Retained as supporting context only — geographic or thematic signals are present but "
        f"do not independently meet inclusion thresholds.{term_phrase} {base}"
    ).strip()


def assert_explanation_has_no_numeric_score(explanation: str) -> None:
    for pattern in FORBIDDEN_PATTERNS:
        if pattern.search(explanation):
            raise ValueError("Public relevance explanation must not expose numeric scores.")
