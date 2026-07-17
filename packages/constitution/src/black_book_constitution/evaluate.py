"""
Policy evaluation helpers mirroring the TypeScript constitution evaluators.

Every returned dict includes policyVersion. This module never mutates policy.
"""

from __future__ import annotations

from typing import Any

from black_book_constitution.load import load_product_constitution


def _with_version(policy: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    return {**result, "policyVersion": policy["policyVersion"]}


def evaluate_living_status(
    status: str,
    policy: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Unknown living status is treated as living when the constitution says so."""
    document = policy if policy is not None else load_product_constitution()
    rules = document["livingPersonRules"]
    recognized = status in rules["statuses"]
    treat_as_living = status == "living" or (
        rules["treatUnknownAsLiving"] and status == "unknown"
    )
    return _with_version(
        document,
        {
            "treatAsLiving": treat_as_living,
            "status": status,
            "recognized": recognized,
        },
    )


def evaluate_public_precision(
    precision: str,
    *,
    living_status: str = "deceased",
    policy: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Reject prohibited public location precision."""
    document = policy if policy is not None else load_product_constitution()
    rules = document["publicPrecisionRules"]
    living = evaluate_living_status(living_status, document)

    if precision in rules["prohibitedLevels"]:
        return _with_version(
            document,
            {
                "allowed": False,
                "precision": precision,
                "reason": "prohibited_location_precision",
            },
        )

    if (
        living["treatAsLiving"]
        and document["livingPersonRules"]["neverReturnResidentialPublicly"]
        and rules["livingResidentialProhibited"]
        and precision in {"residence", "street_address", "unit"}
    ):
        return _with_version(
            document,
            {
                "allowed": False,
                "precision": precision,
                "reason": "living_residential_precision_prohibited",
            },
        )

    if precision not in rules["allowedLevels"]:
        return _with_version(
            document,
            {
                "allowed": False,
                "precision": precision,
                "reason": "unknown_precision_level",
            },
        )

    return _with_version(document, {"allowed": True, "precision": precision})


def evaluate_procedural_language(
    text: str,
    procedural_status: str,
    policy: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Reject unsupported procedural language and unrecognized status tokens."""
    document = policy if policy is not None else load_product_constitution()
    normalized = text.lower()
    violations = [
        phrase
        for phrase in document["unsupportedProceduralLanguage"]
        if phrase.lower() in normalized
    ]
    recognized = procedural_status in document["legalStatusVocabulary"]
    return _with_version(
        document,
        {
            "supported": len(violations) == 0 and recognized,
            "proceduralStatusRecognized": recognized,
            "violations": violations,
        },
    )


def evaluate_relevance(
    score: float,
    decision: str,
    policy: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Evaluate a relevance score against constitution thresholds."""
    document = policy if policy is not None else load_product_constitution()
    thresholds = document["relevanceThresholds"]
    if decision == "include":
        passes = score >= thresholds["includeMinimum"]
    elif decision == "supporting_context":
        passes = score >= thresholds["supportingContextMinimum"]
    else:
        passes = score < thresholds["excludeBelow"]
    return _with_version(
        document,
        {"passes": passes, "decision": decision, "score": score},
    )


def evaluate_claim_confidence(
    score: float,
    claim_class: str,
    policy: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Evaluate claim confidence against standard or high-impact thresholds."""
    document = policy if policy is not None else load_product_constitution()
    thresholds = document["claimConfidenceThresholds"]
    high_impact = (
        claim_class == "high_impact"
        and document["publicationRestrictions"]["highImpactRequiresHigherThreshold"]
    )
    threshold = (
        thresholds["highImpactPublish"] if high_impact else thresholds["standardPublish"]
    )
    return _with_version(
        document,
        {
            "passesPublishThreshold": score >= threshold,
            "claimClass": claim_class,
            "threshold": threshold,
            "score": score,
        },
    )


def is_recognized_vocabulary(
    kind: str,
    value: str,
    policy: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Confirm a maturity / source / legal-status token is in the constitution."""
    document = policy if policy is not None else load_product_constitution()
    if kind == "maturity":
        values = document["recordMaturityStates"]
    elif kind == "source":
        values = document["sourceClassifications"]
    else:
        values = document["legalStatusVocabulary"]
    return _with_version(
        document,
        {"recognized": value in values, "kind": kind, "value": value},
    )
