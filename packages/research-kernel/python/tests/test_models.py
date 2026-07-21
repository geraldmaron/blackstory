from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from research_kernel.models import ResearchCase


def test_generated_model_rejects_unknown_fields() -> None:
    payload = {
        "schemaVersion": "1.0.0",
        "id": "case-1",
        "profileId": "black-history",
        "title": "A bounded question",
        "riskClass": "standard",
        "status": "open",
        "createdBy": "operator-1",
        "createdAt": datetime.now(UTC).isoformat(),
        "unexpected": True,
    }

    with pytest.raises(ValidationError):
        ResearchCase.model_validate(payload)
