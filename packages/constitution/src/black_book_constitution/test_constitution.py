"""
Tests for Python product constitution loaders and evaluators.
"""

from __future__ import annotations

import black_book_constitution as constitution_api
from black_book_constitution import (
    evaluate_living_status,
    evaluate_procedural_language,
    evaluate_public_precision,
    get_policy_version,
    load_all_constitution_fixtures,
    load_product_constitution,
    reset_product_constitution_cache,
)


def test_loads_versioned_product_constitution() -> None:
    reset_product_constitution_cache()
    policy = load_product_constitution()
    assert policy["policyVersion"] == "1.0.0"
    assert get_policy_version() == "1.0.0"


def test_every_evaluation_records_policy_version() -> None:
    living = evaluate_living_status("unknown")
    precision = evaluate_public_precision("city")
    procedural = evaluate_procedural_language("Court ruled on the ordinance.", "ruled")
    assert living["policyVersion"] == "1.0.0"
    assert precision["policyVersion"] == "1.0.0"
    assert procedural["policyVersion"] == "1.0.0"


def test_living_and_unknown_treated_as_living() -> None:
    assert evaluate_living_status("living")["treatAsLiving"] is True
    assert evaluate_living_status("unknown")["treatAsLiving"] is True
    assert evaluate_living_status("deceased")["treatAsLiving"] is False


def test_prohibited_location_precision_rejected() -> None:
    result = evaluate_public_precision("street_address")
    assert result["allowed"] is False
    assert result["reason"] == "prohibited_location_precision"


def test_unsupported_procedural_language_rejected() -> None:
    result = evaluate_procedural_language(
        "Neighbors called him the murderer without a verdict.",
        "alleged",
    )
    assert result["supported"] is False
    assert "the murderer" in result["violations"]


def test_unrecognized_procedural_status_rejected() -> None:
    result = evaluate_procedural_language("The account describes events.", "totally_guilty")
    assert result["supported"] is False
    assert result["proceduralStatusRecognized"] is False


def test_fixtures_cover_required_kinds() -> None:
    fixtures = load_all_constitution_fixtures()
    assert set(fixtures) == {
        "included",
        "excluded",
        "disputed",
        "sparse",
        "sensitive",
        "living_person",
    }
    living = fixtures["living_person"]
    assert evaluate_living_status(living["livingStatus"])["treatAsLiving"] is True
    assert (
        evaluate_public_precision(
            living["publicPrecision"],
            living_status=living["livingStatus"],
        )["allowed"]
        is False
    )


def test_ugc_living_person_rules_extends_constitution_without_version_bump() -> None:
    """additive extension, mirrors how  added sensitivityRules at 1.0.0."""
    reset_product_constitution_cache()
    policy = load_product_constitution()
    assert policy["policyVersion"] == "1.0.0"
    rules = policy["ugcLivingPersonRules"]
    assert rules["crossSourceProfileAggregationProhibited"] is True
    assert rules["deanonymizationProhibited"] is True
    assert rules["elevatedClaimClass"] == "high_impact"
    assert policy["claimConfidenceThresholds"]["highImpactPublish"] == 0.9


def test_no_mutation_api_on_package_surface() -> None:
    banned = {
        "update_product_constitution",
        "set_policy",
        "write_policy",
        "mutate_policy",
        "save_product_constitution",
        "patch_constitution",
    }
    exported = set(dir(constitution_api))
    assert banned.isdisjoint(exported)
