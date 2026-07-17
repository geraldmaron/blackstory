"""Tests for deterministic publication-worker release hashes and object paths."""

from __future__ import annotations

import pytest

from black_book_publication.release import (
    build_manifest_entry,
    canonical_json,
    manifest_entry_json,
    projection_path,
    sha256_json,
    snapshot_path,
)


def test_hash_is_stable_across_object_insertion_order() -> None:
    left = {"beta": [2, 1], "alpha": {"z": True, "a": None}}
    right = {"alpha": {"a": None, "z": True}, "beta": [2, 1]}

    assert canonical_json(left) == canonical_json(right)
    assert sha256_json(left) == sha256_json(right)
    assert len(sha256_json(left).digest) == 64


def test_manifest_entry_hashes_projection_and_snapshot_separately() -> None:
    entry = build_manifest_entry(
        release_id="release-001",
        entity_id="entity-001",
        revision="revision-7",
        projection={"id": "entity-001", "displayName": "Example"},
        snapshot={"schemaVersion": 1, "entity": {"displayName": "Example"}},
    )
    stored = manifest_entry_json(entry)

    assert entry.projection_path == "publicReleases/release-001/entities/entity-001"
    assert entry.snapshot_path == "public/releases/release-001/entities/entity-001.json"
    assert entry.projection_hash != entry.snapshot_hash
    assert stored["entityId"] == "entity-001"
    assert stored["projectionHash"]["algorithm"] == "sha256"


def test_paths_reject_traversal_and_empty_revisions() -> None:
    with pytest.raises(ValueError, match="safe storage path"):
        snapshot_path("../draft", "entity-001")
    with pytest.raises(ValueError, match="safe storage path"):
        projection_path("release-001", "../canonical")
    with pytest.raises(ValueError, match="revision is required"):
        build_manifest_entry(
            release_id="release-001",
            entity_id="entity-001",
            revision="",
            projection={},
            snapshot={},
        )
