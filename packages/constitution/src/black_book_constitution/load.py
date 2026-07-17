"""
Load and validate the shared product constitution JSON artifacts.

Values and structure live under packages/schemas/constitution/. This module is
read-only: it caches a validated policy document and never writes policy state.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

# packages/constitution/src/black_book_constitution -> packages/
_PACKAGES_ROOT = Path(__file__).resolve().parents[3]
CONSTITUTION_DIR = _PACKAGES_ROOT / "schemas" / "constitution"
POLICY_V1_PATH = CONSTITUTION_DIR / "policy.v1.json"
CONSTITUTION_SCHEMA_PATH = CONSTITUTION_DIR / "product-constitution.schema.json"
FIXTURES_DIR = CONSTITUTION_DIR / "fixtures"

_FIXTURE_FILES = {
    "included": "included.json",
    "excluded": "excluded.json",
    "disputed": "disputed.json",
    "sparse": "sparse.json",
    "sensitive": "sensitive.json",
    "living_person": "living-person.json",
}

_cached_policy: dict[str, Any] | None = None


def _read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def load_product_constitution() -> dict[str, Any]:
    """Load and validate policy.v1.json against the shared JSON Schema."""
    global _cached_policy
    if _cached_policy is not None:
        return _cached_policy

    schema = _read_json(CONSTITUTION_SCHEMA_PATH)
    policy = _read_json(POLICY_V1_PATH)
    Draft202012Validator(schema).validate(policy)
    _cached_policy = policy
    return _cached_policy


def get_policy_version(policy: dict[str, Any] | None = None) -> str:
    """Return the active constitution policyVersion."""
    document = policy if policy is not None else load_product_constitution()
    return str(document["policyVersion"])


def load_constitution_fixture(kind: str) -> dict[str, Any]:
    """Load a named constitution fixture used by evaluation tests."""
    try:
        file_name = _FIXTURE_FILES[kind]
    except KeyError as exc:
        raise KeyError(f"Unknown fixture kind: {kind}") from exc
    return _read_json(FIXTURES_DIR / file_name)


def load_all_constitution_fixtures() -> dict[str, dict[str, Any]]:
    """Load all required constitution fixtures."""
    return {kind: load_constitution_fixture(kind) for kind in _FIXTURE_FILES}


def reset_product_constitution_cache() -> None:
    """Clear the in-memory policy cache (tests only)."""
    global _cached_policy
    _cached_policy = None
