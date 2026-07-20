"""HTML acquisition/extraction module, per ADR-019 (acquisition crawler runtime).

Scrapy is the standard engine for recurring, multi-page institutional crawl
campaigns; Trafilatura is the standard main-text/metadata extractor for any
HTML capture, including single-URL fetches that stay outside Scrapy (ADR-019
decision items 4, 5, 7). This module currently implements the Trafilatura
extraction bridge only — no Scrapy spider lives here yet; that is a separate,
larger piece of work for the first named institutional-collection crawl bead.
"""
