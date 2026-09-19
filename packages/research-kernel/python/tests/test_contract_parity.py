import json
from pathlib import Path

import pytest

from research_kernel import models
from research_kernel.validation import validate_contract

_FIXTURES = json.loads(
    (Path(__file__).resolve().parents[2] / "fixtures/contract-validation.json").read_text()
)


@pytest.mark.parametrize("fixture", _FIXTURES, ids=lambda fixture: fixture["name"])
def test_shared_wire_contract(fixture: dict) -> None:
    model = getattr(models, fixture["contract"])
    if fixture["valid"]:
        assert validate_contract(fixture["contract"], fixture["payload"]) is fixture["payload"]
        assert model.model_validate(fixture["payload"])
        assert model.model_validate_json(json.dumps(fixture["payload"]))
    else:
        with pytest.raises(ValueError):
            validate_contract(fixture["contract"], fixture["payload"])
        with pytest.raises(ValueError):
            model.model_validate(fixture["payload"])
        with pytest.raises(ValueError):
            model.model_validate_json(json.dumps(fixture["payload"]))


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf")])
def test_nonfinite_numbers_are_not_json(value: float) -> None:
    with pytest.raises(ValueError):
        validate_contract("ConfidenceAssessment", {"score": value})
