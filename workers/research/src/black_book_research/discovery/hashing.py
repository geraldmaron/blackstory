"""Content hashing and reproducibility fingerprints (BB-039)."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from black_book_research.adapters.types import AdapterCandidateRecord
from black_book_research.query_packs.types import StampedDiscoveryRun

from .types import ContentHash, DiscoveryReproducibilityStamp


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def hash_utf8(text: str) -> ContentHash:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return ContentHash(algorithm="sha256", digest=digest)


def hash_candidate_content(record: AdapterCandidateRecord) -> ContentHash:
    body = {
        "stableIdentifier": record.stable_identifier,
        "title": record.title,
        "canonicalUrl": record.canonical_url,
        "classification": record.classification,
        "payload": record.payload,
    }
    return hash_utf8(_canonical_json(body))


def stamp_discovery_reproducibility(
    run: StampedDiscoveryRun,
    source_parser_versions: tuple[str, ...],
) -> DiscoveryReproducibilityStamp:
    sorted_versions = tuple(sorted({version.strip() for version in source_parser_versions if version.strip()}))
    material = _canonical_json(
        {
            "sourceParserVersions": list(sorted_versions),
            "queryPackVersionId": run.query_pack_version_id,
            "queryPackContentHash": run.query_pack_content_hash,
            "adapterId": run.adapter_id,
            "runId": run.run_id,
        }
    )
    return DiscoveryReproducibilityStamp(
        source_parser_versions=sorted_versions,
        query_pack_version_id=run.query_pack_version_id,
        query_pack_content_hash=run.query_pack_content_hash,
        fingerprint=hash_utf8(material).digest,
    )
