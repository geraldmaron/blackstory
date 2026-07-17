"""MediaWiki search and page parsing for fixture-driven discovery (BB-045)."""

from __future__ import annotations

from typing import Any


def parse_mediawiki_search_response(raw: dict[str, Any]) -> tuple[dict[str, Any], ...]:
    hits = raw.get("query", {}).get("search", [])
    return tuple(
        {
            "pageid": hit["pageid"],
            "title": hit["title"],
            **({"snippet": hit["snippet"]} if "snippet" in hit else {}),
        }
        for hit in hits
    )


def parse_mediawiki_page_response(raw: dict[str, Any]) -> dict[str, Any]:
    pages = raw.get("query", {}).get("pages")
    if not pages:
        raise ValueError("MediaWiki page response missing query.pages")
    page = next(iter(pages.values()))
    if not page:
        raise ValueError("MediaWiki page response contains no pages")
    return page


def build_api_fetch_from_fixtures(
    *,
    project: str,
    page_raw: dict[str, Any],
    wikidata_raw: dict[str, Any] | None = None,
    wikidata_id: str | None = None,
) -> dict[str, Any]:
    page = parse_mediawiki_page_response(page_raw)
    wikidata = None
    if wikidata_raw and wikidata_id:
        wikidata = wikidata_raw.get("entities", {}).get(wikidata_id)
    return {
        "ingestMode": "api",
        "project": project,
        "page": page,
        **({"wikidata": wikidata} if wikidata else {}),
    }


def assert_search_snippets_not_copied(payload: dict[str, object]) -> None:
    if any(key in payload for key in ("extract", "prose", "snippet")):
        raise ValueError("Wikipedia prose or search snippets must not be copied into candidate payload")
