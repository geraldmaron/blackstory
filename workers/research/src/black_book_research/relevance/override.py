"""Manual relevance override validation (BB-040)."""

from __future__ import annotations

from .types import RelevanceDecision, RelevanceOverride

MIN_OVERRIDE_REASON_LENGTH = 12


def assert_override_reason_present(reason: str) -> None:
    if len(reason.strip()) < MIN_OVERRIDE_REASON_LENGTH:
        raise ValueError(
            f"Relevance override reason is required and must be at least "
            f"{MIN_OVERRIDE_REASON_LENGTH} characters."
        )


def validate_relevance_override(
    *,
    decision: RelevanceDecision,
    reason: str,
    overridden_by: str,
    overridden_at: str,
) -> RelevanceOverride:
    if not overridden_by.strip():
        raise ValueError("Relevance override requires overridden_by.")
    if not overridden_at.strip():
        raise ValueError("Relevance override requires overridden_at.")
    assert_override_reason_present(reason)
    return RelevanceOverride(
        decision=decision,
        reason=reason.strip(),
        overridden_by=overridden_by.strip(),
        overridden_at=overridden_at.strip(),
    )
