"""Trafilatura HTML extraction bridge (ADR-019 decision item 5).

Reads a JSON payload `{"html": "...", "url": "..."?}` from stdin, writes
`{"text": "...", "title": "...", "date": "..."}` to stdout. One purpose: let
the TypeScript research pipeline (which owns SSRF-safe fetching via
`executeSafeFetch`, per ADR-019 item 7) get main-text extraction quality from
Trafilatura instead of a regex tag-strip, without needing the full Scrapy
crawl-campaign machinery for a single already-fetched page.

Usage:
    uv run python3 -m black_book_research.crawl.trafilatura_extract <<< '{"html": "..."}'
"""

from __future__ import annotations

import json
import sys

import trafilatura


def extract_page(html: str, url: str | None = None) -> dict[str, str | None]:
    text = trafilatura.extract(
        html,
        url=url,
        output_format="txt",
        include_comments=False,
        include_tables=True,
        include_links=False,
        favor_precision=True,
    )
    metadata = trafilatura.extract_metadata(html, default_url=url)
    return {
        "text": text or "",
        "title": metadata.title if metadata else None,
        "date": metadata.date if metadata else None,
    }


def main() -> None:
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as error:
        json.dump({"error": f"invalid JSON input: {error}"}, sys.stdout)
        sys.exit(1)

    html = payload.get("html")
    if not isinstance(html, str) or not html.strip():
        json.dump({"error": "payload.html must be a non-empty string"}, sys.stdout)
        sys.exit(1)

    result = extract_page(html, payload.get("url"))
    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
