"""Query pack construction, canonical hashing, and version identity (BB-038)."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass

from .terms import assert_query_terms_valid
from .types import EntityKind, QueryPack, QueryPackTheme, QueryPackVersion, QueryTerm

QUERY_PACK_SCHEMA_VERSION = "query-pack.v1"
_SEMVER = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$")


def assert_semver_valid(semver: str) -> None:
    if not _SEMVER.match(semver.strip()):
        raise ValueError(f"Invalid semver for query pack: {semver}")


def _term_payload(term: QueryTerm) -> dict[str, object]:
    payload: dict[str, object] = {
        "text": term.text.strip(),
        "termClass": term.term_class,
    }
    if term.research_only_offensive:
        payload["researchOnlyOffensive"] = True
    if term.source_id:
        payload["sourceId"] = term.source_id.strip()
    if term.weight is not None:
        payload["weight"] = term.weight
    return payload


def _canonicalize_terms(terms: tuple[QueryTerm, ...] | list[QueryTerm]) -> list[dict[str, object]]:
    return sorted((_term_payload(term) for term in terms), key=lambda item: (item["termClass"], item["text"]))


def compute_query_pack_content_hash(
    *,
    id: str,
    display_name: str,
    entity_kind: EntityKind,
    theme: QueryPackTheme,
    semver: str,
    terms: tuple[QueryTerm, ...] | list[QueryTerm],
    notes: str | None = None,
) -> str:
    payload: dict[str, object] = {
        "id": id,
        "displayName": display_name.strip(),
        "entityKind": entity_kind,
        "theme": theme,
        "semver": semver.strip(),
        "terms": _canonicalize_terms(terms),
    }
    if notes:
        payload["notes"] = notes.strip()
    canonical = json.dumps(payload, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_query_pack_version_id(semver: str, content_hash: str) -> str:
    return f"{semver.strip()}+{content_hash[:8]}"


@dataclass(frozen=True, slots=True)
class BuildQueryPackInput:
    id: str
    display_name: str
    entity_kind: EntityKind
    theme: QueryPackTheme
    semver: str
    terms: tuple[QueryTerm, ...] | list[QueryTerm]
    created_at: str
    notes: str | None = None


def build_query_pack(input: BuildQueryPackInput) -> QueryPack:
    assert_semver_valid(input.semver)
    terms_tuple = tuple(input.terms)
    assert_query_terms_valid(terms_tuple)
    if not input.id.strip():
        raise ValueError("Query pack id is required")
    if not input.display_name.strip():
        raise ValueError("Query pack displayName is required")

    content_hash = compute_query_pack_content_hash(
        id=input.id,
        display_name=input.display_name,
        entity_kind=input.entity_kind,
        theme=input.theme,
        semver=input.semver,
        terms=terms_tuple,
        notes=input.notes,
    )
    version = QueryPackVersion(semver=input.semver.strip(), content_hash=content_hash)
    version_id = build_query_pack_version_id(version.semver, version.content_hash)

    return QueryPack(
        schema_version=QUERY_PACK_SCHEMA_VERSION,
        id=input.id.strip(),
        display_name=input.display_name.strip(),
        entity_kind=input.entity_kind,
        theme=input.theme,
        version=version,
        version_id=version_id,
        terms=terms_tuple,
        created_at=input.created_at,
        notes=input.notes.strip() if input.notes else None,
    )


def assert_query_pack_valid(pack: QueryPack) -> None:
    if pack.schema_version != QUERY_PACK_SCHEMA_VERSION:
        raise ValueError(
            f"Query pack schema version mismatch: expected {QUERY_PACK_SCHEMA_VERSION}, "
            f"got {pack.schema_version}"
        )
    assert_query_terms_valid(pack.terms)
    expected_hash = compute_query_pack_content_hash(
        id=pack.id,
        display_name=pack.display_name,
        entity_kind=pack.entity_kind,
        theme=pack.theme,
        semver=pack.version.semver,
        terms=pack.terms,
        notes=pack.notes,
    )
    if pack.version.content_hash != expected_hash:
        raise ValueError("Query pack content_hash does not match canonical content")
    expected_version_id = build_query_pack_version_id(pack.version.semver, pack.version.content_hash)
    if pack.version_id != expected_version_id:
        raise ValueError("Query pack version_id does not match semver+content_hash")


def evaluate_text_against_terms(text: str, terms: tuple[QueryTerm, ...] | list[QueryTerm]) -> tuple[QueryTerm, ...]:
    normalized = text.lower()
    return tuple(term for term in terms if term.text.lower() in normalized)
