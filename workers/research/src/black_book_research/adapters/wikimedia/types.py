"""Wikimedia discovery adapter types mirroring @black-book/domain adapters/wikimedia (BB-045)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

WIKIMEDIA_ADAPTER_ID = "wikimedia-discovery-v1"
WIKIMEDIA_PARSER_VERSION = "wikimedia-parser-1.0.0"
WIKIMEDIA_STABLE_ID_SCHEME = "wikimedia-page"
WIKIMEDIA_PAYLOAD_SCHEMA_VERSION = "wikimedia-payload.v1"

WikimediaIngestMode = Literal["api", "bulk"]


@dataclass(frozen=True, slots=True)
class WikimediaAttribution:
    source_project: str
    license: str
    attribution_url: str
    required_notice: str


@dataclass(frozen=True, slots=True)
class WikimediaLocationHint:
    label: str
    wikidata_id: str | None = None
    latitude: float | None = None
    longitude: float | None = None


@dataclass(frozen=True, slots=True)
class WikimediaExternalReference:
    system: str
    identifier: str
    wikidata_property: str | None = None
    url: str | None = None


@dataclass(frozen=True, slots=True)
class WikimediaRelationship:
    property: str
    target_wikidata_id: str
    target_label: str | None = None


@dataclass(frozen=True, slots=True)
class WikimediaCategoryGateResult:
    passed: bool
    matched_seed_categories: tuple[str, ...]
    traversed_categories: tuple[str, ...]
    reason: str


@dataclass(frozen=True, slots=True)
class WikimediaCandidatePayload:
    schema_version: str
    ingest_mode: WikimediaIngestMode
    page_id: int
    page_title: str
    revision_id: int
    revision_timestamp: str
    namespace: int
    aliases: tuple[str, ...]
    locations: tuple[WikimediaLocationHint, ...]
    external_references: tuple[WikimediaExternalReference, ...]
    relationships: tuple[WikimediaRelationship, ...]
    categories: tuple[str, ...]
    category_gate: WikimediaCategoryGateResult
    include_prose: Literal[False]
    attribution: WikimediaAttribution
    wikidata_id: str | None = None
