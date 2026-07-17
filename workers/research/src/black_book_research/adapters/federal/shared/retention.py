"""Candidate retention rules for federal archive adapters (BB-046)."""

from __future__ import annotations

from .types import FederalRejectedRecord, FederalRetentionRules


def _read_string(raw: dict[str, object], field: str) -> str | None:
    value = raw.get(field)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def qualifies_for_candidate_retention(
    raw: dict[str, object],
    rules: FederalRetentionRules,
) -> tuple[bool, str | None]:
    for field in rules.required_fields:
        if not _read_string(raw, field):
            return False, f"missing_required_field:{field}"

    title = _read_string(raw, "title")
    if not title or len(title) < rules.min_title_length:
        return False, "title_too_short"

    classification = _read_string(raw, "classification")
    if classification and classification not in rules.allowed_classifications:
        return False, "classification_not_allowed"

    if rules.require_canonical_url and not _read_string(raw, "canonicalUrl"):
        return False, "missing_canonical_url"

    return True, None


def partition_by_retention(
    records: list[dict[str, object]],
    rules: FederalRetentionRules,
) -> tuple[tuple[dict[str, object], ...], tuple[FederalRejectedRecord, ...]]:
    qualified: list[dict[str, object]] = []
    rejected: list[FederalRejectedRecord] = []

    for record in records:
        stable_identifier = (
            _read_string(record, "stableIdentifier")
            or _read_string(record, "id")
            or "unknown"
        )
        ok, reason = qualifies_for_candidate_retention(record, rules)
        if ok:
            qualified.append(record)
        else:
            rejected.append(
                FederalRejectedRecord(
                    stable_identifier=stable_identifier,
                    reason=reason or "rejected",
                )
            )

    return tuple(qualified), tuple(rejected)
