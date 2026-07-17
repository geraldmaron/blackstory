"""Normalize Wikimedia API/bulk fetches into BB-037 adapter candidates (BB-045)."""

from __future__ import annotations

from typing import Any

from black_book_research.adapters.candidates import stamp_candidate_provenance
from black_book_research.adapters.types import AdapterCandidateRecord, SourceRegistryEntry

from .category_gate import evaluate_category_gate
from .extractors import (
    build_stable_identifier,
    build_wikipedia_canonical_url,
    extract_aliases,
    extract_external_references,
    extract_locations,
    extract_relationships,
)
from .types import (
    WIKIMEDIA_ADAPTER_ID,
    WIKIMEDIA_PAYLOAD_SCHEMA_VERSION,
    WikimediaAttribution,
    WikimediaCandidatePayload,
    WikimediaIngestMode,
)

WIKIMEDIA_ATTRIBUTION = WikimediaAttribution(
    source_project="Wikimedia Foundation",
    license="CC BY-SA 4.0",
    attribution_url="https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use",
    required_notice=(
        "Content derived from Wikimedia projects is available under CC BY-SA 4.0; "
        "reuse requires attribution."
    ),
)


def _payload_to_dict(payload: WikimediaCandidatePayload) -> dict[str, object]:
    return {
        "schemaVersion": payload.schema_version,
        "ingestMode": payload.ingest_mode,
        "pageId": payload.page_id,
        "pageTitle": payload.page_title,
        "revisionId": payload.revision_id,
        "revisionTimestamp": payload.revision_timestamp,
        "namespace": payload.namespace,
        "wikidataId": payload.wikidata_id,
        "aliases": list(payload.aliases),
        "locations": [
            {
                "label": location.label,
                **({"wikidataId": location.wikidata_id} if location.wikidata_id else {}),
                **(
                    {
                        "coordinate": {
                            "latitude": location.latitude,
                            "longitude": location.longitude,
                        }
                    }
                    if location.latitude is not None and location.longitude is not None
                    else {}
                ),
            }
            for location in payload.locations
        ],
        "externalReferences": [
            {
                "system": ref.system,
                "identifier": ref.identifier,
                **({"wikidataProperty": ref.wikidata_property} if ref.wikidata_property else {}),
                **({"url": ref.url} if ref.url else {}),
            }
            for ref in payload.external_references
        ],
        "relationships": [
            {
                "property": rel.property,
                "targetWikidataId": rel.target_wikidata_id,
                **({"targetLabel": rel.target_label} if rel.target_label else {}),
            }
            for rel in payload.relationships
        ],
        "categories": list(payload.categories),
        "categoryGate": {
            "passed": payload.category_gate.passed,
            "matchedSeedCategories": list(payload.category_gate.matched_seed_categories),
            "traversedCategories": list(payload.category_gate.traversed_categories),
            "reason": payload.category_gate.reason,
        },
        "includeProse": payload.include_prose,
        "attribution": {
            "sourceProject": payload.attribution.source_project,
            "license": payload.attribution.license,
            "attributionUrl": payload.attribution.attribution_url,
            "requiredNotice": payload.attribution.required_notice,
        },
    }


def normalize_wikimedia_page(
    *,
    project: str,
    page: dict[str, Any],
    wikidata: dict[str, Any] | None,
    ingest_mode: WikimediaIngestMode,
    registry_entry: SourceRegistryEntry,
    run_id: str,
    captured_at: str,
) -> AdapterCandidateRecord:
    categories = tuple(category.get("title", "") for category in page.get("categories", []))
    category_gate = evaluate_category_gate(categories)
    revisions = page.get("revisions") or []
    if not revisions:
        raise ValueError(f'MediaWiki page "{page.get("title")}" is missing revision metadata')
    latest = revisions[0]

    payload = WikimediaCandidatePayload(
        schema_version=WIKIMEDIA_PAYLOAD_SCHEMA_VERSION,
        ingest_mode=ingest_mode,
        page_id=int(page["pageid"]),
        page_title=str(page["title"]),
        revision_id=int(latest["revid"]),
        revision_timestamp=str(latest["timestamp"]),
        namespace=int(page.get("ns", 0)),
        wikidata_id=(wikidata or {}).get("id"),
        aliases=extract_aliases(wikidata),
        locations=extract_locations(wikidata),
        external_references=extract_external_references(wikidata),
        relationships=extract_relationships(wikidata),
        categories=categories,
        category_gate=category_gate,
        include_prose=False,
        attribution=WIKIMEDIA_ATTRIBUTION,
    )

    title = ((wikidata or {}).get("labels") or {}).get("en", {}).get("value") or payload.page_title
    candidate = stamp_candidate_provenance(
        registry_entry,
        run_id=run_id,
        captured_at=captured_at,
        stable_identifier=build_stable_identifier(project, payload.page_id),
        title=title,
        canonical_url=build_wikipedia_canonical_url(project, payload.page_title),
        classification=registry_entry.contract.classification,
        payload=_payload_to_dict(payload),
    )
    assert candidate.provenance.adapter_id == WIKIMEDIA_ADAPTER_ID
    assert candidate.payload is not None
    assert candidate.payload.get("includeProse") is False
    return candidate


def normalize_wikimedia_api_fetch(
    fetch: dict[str, Any],
    *,
    registry_entry: SourceRegistryEntry,
    run_id: str,
    captured_at: str,
) -> AdapterCandidateRecord:
    return normalize_wikimedia_page(
        project=str(fetch["project"]),
        page=fetch["page"],
        wikidata=fetch.get("wikidata"),
        ingest_mode="api",
        registry_entry=registry_entry,
        run_id=run_id,
        captured_at=captured_at,
    )


def normalize_wikimedia_bulk_batch(
    batch: dict[str, Any],
    *,
    registry_entry: SourceRegistryEntry,
    run_id: str,
    captured_at: str,
) -> tuple[AdapterCandidateRecord, ...]:
    project = str(batch["project"])
    return tuple(
        normalize_wikimedia_page(
            project=project,
            page=record["page"],
            wikidata=record.get("wikidata"),
            ingest_mode="bulk",
            registry_entry=registry_entry,
            run_id=run_id,
            captured_at=captured_at,
        )
        for record in batch.get("records", [])
    )


def candidates_equivalent(left: AdapterCandidateRecord, right: AdapterCandidateRecord) -> bool:
    def comparable(candidate: AdapterCandidateRecord) -> dict[str, object | None]:
        payload = dict(candidate.payload or {})
        payload.pop("ingestMode", None)
        return {
            "stable_identifier": candidate.stable_identifier,
            "title": candidate.title,
            "canonical_url": candidate.canonical_url,
            "classification": candidate.classification,
            "payload": payload,
        }

    return comparable(left) == comparable(right)
