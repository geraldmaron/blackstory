"""HTML acquisition/extraction module (see docs/decisions-carryover.md,
"Acquisition crawler runtime").

Scrapy is the standard engine for recurring, multi-page institutional crawl
campaigns; Trafilatura is the standard main-text/metadata extractor for any
HTML capture, including single-URL fetches that stay outside Scrapy
(docs/decisions-carryover.md, "Acquisition crawler runtime": decision items
5 and 7 are live; item 4, the Scrapy engine, was never built). This module
currently implements the Trafilatura
extraction bridge only — no Scrapy spider lives here yet; that is a separate,
larger piece of work for the first named institutional-collection crawl bead.
"""
