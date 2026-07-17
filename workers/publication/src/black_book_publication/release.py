"""Deterministic BB-019 release hashing, manifest entries, and snapshot object layout."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import asdict, dataclass
from typing import Mapping

_SAFE_PATH_SEGMENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$")
type JsonValue = None | bool | int | float | str | list["JsonValue"] | dict[str, "JsonValue"]


@dataclass(frozen=True, slots=True)
class ContentHash:
    algorithm: str
    digest: str


@dataclass(frozen=True, slots=True)
class ManifestEntry:
    entity_id: str
    revision: str
    projection_path: str
    projection_hash: ContentHash
    snapshot_path: str
    snapshot_hash: ContentHash


def canonical_json(value: JsonValue) -> bytes:
    """Serialize JSON deterministically for cross-process sha256 hashing."""
    return json.dumps(
        value,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def sha256_json(value: JsonValue) -> ContentHash:
    return ContentHash(algorithm="sha256", digest=hashlib.sha256(canonical_json(value)).hexdigest())


def _safe_segment(value: str, field: str) -> str:
    if value in {".", ".."} or not _SAFE_PATH_SEGMENT.fullmatch(value):
        raise ValueError(f"{field} is not a safe storage path segment")
    return value


def projection_path(release_id: str, entity_id: str) -> str:
    return (
        f"publicReleases/{_safe_segment(release_id, 'release_id')}/entities/"
        f"{_safe_segment(entity_id, 'entity_id')}"
    )


def snapshot_path(release_id: str, entity_id: str) -> str:
    return (
        f"public/releases/{_safe_segment(release_id, 'release_id')}/entities/"
        f"{_safe_segment(entity_id, 'entity_id')}.json"
    )


def build_manifest_entry(
    *,
    release_id: str,
    entity_id: str,
    revision: str,
    projection: JsonValue,
    snapshot: JsonValue,
) -> ManifestEntry:
    """Hash already-redacted public payloads and bind them to immutable release paths."""
    if not revision:
        raise ValueError("revision is required")
    return ManifestEntry(
        entity_id=entity_id,
        revision=revision,
        projection_path=projection_path(release_id, entity_id),
        projection_hash=sha256_json(projection),
        snapshot_path=snapshot_path(release_id, entity_id),
        snapshot_hash=sha256_json(snapshot),
    )


def manifest_entry_json(entry: ManifestEntry) -> Mapping[str, JsonValue]:
    """Return the storage-facing camelCase representation used by TypeScript contracts."""
    value = asdict(entry)
    return {
        "entityId": value["entity_id"],
        "revision": value["revision"],
        "projectionPath": value["projection_path"],
        "projectionHash": value["projection_hash"],
        "snapshotPath": value["snapshot_path"],
        "snapshotHash": value["snapshot_hash"],
    }
