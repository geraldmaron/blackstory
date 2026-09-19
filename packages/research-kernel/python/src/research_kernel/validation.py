"""Validate Python input against the same wire contract used by TypeScript."""

from __future__ import annotations

import json
from functools import lru_cache
from importlib.resources import files
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker
from pydantic import BaseModel, ConfigDict, model_validator

_SCHEMA = json.loads(files(__package__).joinpath("research-kernel.v1.schema.json").read_text())
_FORMATS = FormatChecker()
# Missing optional format dependencies must fail startup, not silently weaken validation.
for _format in ("date", "date-time", "uri"):
    if _format not in _FORMATS.checkers:
        raise RuntimeError(f"Missing research contract format validator: {_format}")


@lru_cache
def _validator(name: str) -> Draft202012Validator:
    if name not in _SCHEMA["$defs"]:
        raise ValueError(f"Unknown research contract: {name}")
    return Draft202012Validator(
        {"$ref": f"#/$defs/{name}", "$defs": _SCHEMA["$defs"]}, format_checker=_FORMATS
    )


def validate_contract(name: str, value: Any) -> Any:
    """Reject invalid data without coercion; return the supplied value unchanged."""
    json.dumps(value, allow_nan=False)
    errors = list(_validator(name).iter_errors(value))
    if errors:
        detail = "; ".join(f"{error.json_path}: {error.message}" for error in errors)
        raise ValueError(f"Invalid {name}: {detail}")
    return value


class ContractModel(BaseModel):
    """Generated models enforce the canonical schema before constructing typed values."""

    model_config = ConfigDict(extra="forbid", frozen=True, revalidate_instances="always")

    @model_validator(mode="before")
    @classmethod
    def validate_wire_contract(cls, value: Any) -> Any:
        if isinstance(value, BaseModel):
            value = value.model_dump(exclude_unset=True)
        return validate_contract(cls.__name__, value)
