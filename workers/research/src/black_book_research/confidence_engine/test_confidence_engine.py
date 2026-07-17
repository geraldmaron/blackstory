"""Acceptance tests for the Python confidence-engine mirror."""

from __future__ import annotations

from copy import deepcopy

from black_book_constitution import load_product_constitution

from black_book_research.confidence_engine import (
    ConfidenceCalibrationCase,
    ConfidenceEvidence,
    evaluate_public_language,
    export_confidence_calibration_dataset,
    recalculate_confidence,
)

FIXED_NOW = "2026-07-17T04:00:00.000Z"


def _evidence(
    evidence_id: str,
    lineage_root_id: str,
    **overrides: object,
) -> ConfidenceEvidence:
    values: dict[str, object] = {
        "id": f"link_{evidence_id}",
        "claim_id": "claim_043",
        "claim_version_id": "claim_043_v1",
        "evidence_id": evidence_id,
        "role": "supporting",
        "lineage_root_id": lineage_root_id,
        "credible": True,
        "source_classification": "government_record",
        "directness": 0.9,
        "temporal_proximity": 0.8,
        "geographic_precision": 0.85,
        "entity_match_quality": 0.95,
        "extraction_quality": 0.9,
    }
    values.update(overrides)
    return ConfidenceEvidence(**values)  # type: ignore[arg-type]


def _score(evidence: tuple[ConfidenceEvidence, ...]):
    return recalculate_confidence(
        claim_class="standard",
        evidence=evidence,
        calculated_at=FIXED_NOW,
    )


def test_five_syndicated_copies_are_one_independent_source() -> None:
    result = _score(
        tuple(_evidence(f"copy_{index}", "wire_root") for index in range(5))
    )

    assert result.supporting_evidence_count == 5
    assert result.independent_lineage_count == 1
    assert len(result.contributing_evidence_ids) == 1
    assert result.components.lineage_independence == 0.4


def test_score_is_deterministic_and_auditable() -> None:
    links = (_evidence("a", "root_a"), _evidence("b", "root_b"))
    first = _score(links)
    second = _score(tuple(reversed(links)))

    assert first.score == second.score == 0.8725
    assert first.components == second.components
    assert first.audit.input_fingerprints == second.audit.input_fingerprints
    assert first.audit.engine_version == "confidence-engine.v1"
    assert (
        first.audit.component_versions["sourceAuthority"]
        == "confidence-components.v1"
    )


def test_recalculates_for_source_evidence_contradiction_and_policy() -> None:
    links = (_evidence("a", "root_a"),)
    initial = _score(links)

    source_changed = recalculate_confidence(
        claim_class="standard",
        evidence=(
            _evidence(
                "a", "root_a", source_classification="primary_archival"
            ),
        ),
        calculated_at=FIXED_NOW,
        previous=initial,
    )
    assert "source" in source_changed.audit.recalculation_reasons
    assert source_changed.score != initial.score

    evidence_changed = recalculate_confidence(
        claim_class="standard",
        evidence=(_evidence("a", "root_a", extraction_quality=0.2),),
        calculated_at=FIXED_NOW,
        previous=initial,
    )
    assert "evidence" in evidence_changed.audit.recalculation_reasons
    assert evidence_changed.score != initial.score

    contradiction_changed = recalculate_confidence(
        claim_class="standard",
        evidence=links
        + (
            _evidence(
                "contra",
                "root_contra",
                role="contradicting",
                asserted_value="different",
            ),
        ),
        calculated_at=FIXED_NOW,
        previous=initial,
    )
    assert "contradiction" in contradiction_changed.audit.recalculation_reasons
    assert contradiction_changed.score < initial.score

    policy = deepcopy(load_product_constitution())
    policy["policyVersion"] = "1.0.1"
    policy["claimConfidenceThresholds"]["standardPublish"] = 0.8
    policy_changed = recalculate_confidence(
        claim_class="standard",
        evidence=links,
        calculated_at=FIXED_NOW,
        policy=policy,
        previous=initial,
    )
    assert policy_changed.audit.recalculation_reasons == ("policy",)
    assert policy_changed.threshold == 0.8


def test_public_language_is_capped_by_evidence_status() -> None:
    denied = evaluate_public_language(
        text="The person was convicted.",
        requested_procedural_status="convicted",
        evidence_procedural_status="charged",
    )
    assert denied.allowed is False
    assert denied.effective_procedural_status == "charged"
    assert "procedural_status_exceeds_evidence" in denied.violations

    allowed = evaluate_public_language(
        text="The person was charged.",
        requested_procedural_status="charged",
        evidence_procedural_status="charged",
    )
    assert allowed.allowed is True

    weaker = evaluate_public_language(
        text="The person was alleged to have acted.",
        requested_procedural_status="alleged",
        evidence_procedural_status="charged",
    )
    assert weaker.allowed is True


def test_calibration_export_is_stable_and_versioned() -> None:
    confidence = _score((_evidence("a", "root_a"),))
    dataset = export_confidence_calibration_dataset(
        (
            ConfidenceCalibrationCase(
                claim_id="claim_b",
                claim_version_id="v1",
                claim_class="standard",
                confidence=confidence,
            ),
            ConfidenceCalibrationCase(
                claim_id="claim_a",
                claim_version_id="v2",
                claim_class="standard",
                confidence=confidence,
                observed_outcome=True,
                outcome_source="reviewed_gold_fixture",
            ),
        ),
        exported_at=FIXED_NOW,
    )

    assert dataset["schemaVersion"] == "confidence-calibration-dataset.v1"
    rows = dataset["rows"]
    assert isinstance(rows, list)
    assert [row["claimId"] for row in rows] == ["claim_a", "claim_b"]
    assert rows[0]["engineVersion"] == "confidence-engine.v1"
    assert rows[0]["inputFingerprints"]["evidence"].startswith("sha256:")
