"""Retry, quarantine, and dead-letter handling (BB-039)."""

from __future__ import annotations

from .types import DiscoveryFailureOutcome


def should_retry_candidate(retry_count: int, max_retries: int) -> bool:
    return retry_count < max_retries


def resolve_failure_outcome(retry_count: int, max_retries: int) -> DiscoveryFailureOutcome:
    if should_retry_candidate(retry_count, max_retries):
        return "retry"
    if retry_count >= max_retries + 1:
        return "dead_letter"
    return "quarantine"


def should_continue_campaign(
    *,
    continue_on_quarantine: bool,
    quarantined_count: int,
    max_quarantined: int,
) -> bool:
    if not continue_on_quarantine:
        return quarantined_count <= max_quarantined
    return quarantined_count < max_quarantined
