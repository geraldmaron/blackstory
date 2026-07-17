"""Wikidata extraction and external reference routing (BB-045)."""

from __future__ import annotations

from typing import Any

from .types import (
    WikimediaExternalReference,
    WikimediaLocationHint,
    WikimediaRelationship,
)

EXTERNAL_ID_PROPERTIES = {
    "P214": "VIAF",
    "P244": "LCCN",
    "P227": "GND",
    "P213": "ISNI",
}

LOCATION_PROPERTIES = {"P131", "P276", "P937", "P19", "P20", "P159"}


def route_external_reference_url(system: str, identifier: str) -> str | None:
    if system == "VIAF":
        return f"https://viaf.org/viaf/{identifier}/"
    if system == "LCCN":
        return f"https://id.loc.gov/authorities/{identifier}"
    if system == "GND":
        return f"https://d-nb.info/gnd/{identifier}"
    if system == "ISNI":
        return f"https://isni.org/isni/{identifier}"
    return None


def extract_aliases(entity: dict[str, Any] | None, language: str = "en") -> tuple[str, ...]:
    if not entity:
        return ()
    aliases = entity.get("aliases", {}).get(language, [])
    return tuple(entry.get("value", "") for entry in aliases if entry.get("value"))


def extract_locations(entity: dict[str, Any] | None) -> tuple[WikimediaLocationHint, ...]:
    if not entity:
        return ()
    claims = entity.get("claims", {})
    locations: list[WikimediaLocationHint] = []

    for prop in LOCATION_PROPERTIES:
        for claim in claims.get(prop, []):
            value = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {})
            if value.get("id", "").startswith("Q"):
                locations.append(WikimediaLocationHint(label=value["id"], wikidata_id=value["id"]))
            elif value.get("text"):
                locations.append(WikimediaLocationHint(label=value["text"]))

    for claim in claims.get("P625", []):
        value = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {})
        lat = value.get("latitude")
        lon = value.get("longitude")
        if lat is not None and lon is not None:
            locations.append(WikimediaLocationHint(label="Coordinate location", latitude=lat, longitude=lon))

    return tuple(locations)


def extract_external_references(entity: dict[str, Any] | None) -> tuple[WikimediaExternalReference, ...]:
    if not entity:
        return ()
    claims = entity.get("claims", {})
    references: list[WikimediaExternalReference] = []

    for prop, system in EXTERNAL_ID_PROPERTIES.items():
        for claim in claims.get(prop, []):
            value = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {})
            identifier = value.get("text") or value.get("id")
            if not identifier:
                continue
            references.append(
                WikimediaExternalReference(
                    system=system,
                    identifier=identifier,
                    wikidata_property=prop,
                    url=route_external_reference_url(system, identifier),
                )
            )

    return tuple(references)


def extract_relationships(entity: dict[str, Any] | None) -> tuple[WikimediaRelationship, ...]:
    if not entity:
        return ()
    claims = entity.get("claims", {})
    relationships: list[WikimediaRelationship] = []

    for prop, claim_list in claims.items():
        if prop in EXTERNAL_ID_PROPERTIES or prop in LOCATION_PROPERTIES or prop == "P625":
            continue
        for claim in claim_list:
            target = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("id")
            if isinstance(target, str) and target.startswith("Q"):
                relationships.append(WikimediaRelationship(property=prop, target_wikidata_id=target))

    return tuple(relationships)


def build_stable_identifier(project: str, page_id: int) -> str:
    normalized = project.replace(".wikipedia.org", "")
    return f"wikimedia:{normalized}:page:{page_id}"


def build_wikipedia_canonical_url(project: str, title: str) -> str:
    host = project if "." in project else f"{project}.wikipedia.org"
    encoded = title.replace(" ", "_")
    return f"https://{host}/wiki/{encoded}"
