#!/usr/bin/env python3
"""Strip bead/tracker references from apps/ and packages/ source (Wave C rebrand)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET_DIRS = [ROOT / "apps", ROOT / "packages"]

SKIP_PARTS = {"node_modules", ".next", "dist", "generated"}

KEEP_BLACK_BOOK = {
    "black-book-efaaf",
    "black-book-prod",
    "black-book-server",
    "black-book-web",
    "black-book-admin",
    "black-book-constitution",
    "black-book-api-public-armor",
    "black-book-api-public-backend",
    "black-book-web-production",
    "black-book-web-staging",
    "demo-black-book-evidence",
}

BEAD_SLUG_MAP = {
    "black-book-1fg9": "release builder",
    "black-book-5mf": "sundown research",
    "black-book-67d": "dignity palette",
    "black-book-7j0": "county resolution",
    "black-book-7ly": "sundown wave-1 research",
    "black-book-8bck": "entity resolution",
    "black-book-8n8": "theme taxonomy source",
    "black-book-8qp": "FBI UCR ingest",
    "black-book-9mox": "entity classification",
    "black-book-cqto": "statistics combination rules",
    "black-book-dnli": "seed enrichment",
    "black-book-hx8j": "relationship publish invariants",
    "black-book-isqd": "verification refresh",
    "black-book-mpfb": "living status derivation",
    "black-book-pj6w": "fact derivation consistency",
    "black-book-pwfi": "publication gate wiring",
    "black-book-s4hp": "controlled topic taxonomy",
    "black-book-ud5q": "data pack import",
    "black-book-uda": "county hairlines",
    "black-book-vxmy": "verification timestamps",
    "black-book-vxz": "census demographics",
    "black-book-w72": "mobile sheet consolidation",
}

BB_MAP = {
    "BB-001": "scheduled-jobs registry",
    "BB-002": "scheduled-jobs health",
    "BB-003": "product constitution",
    "BB-004": "threat corpus",
    "BB-005": "security baseline",
    "BB-011": "admin surface",
    "BB-012": "SQL Connect",
    "BB-013": "data classification",
    "BB-014": "domain paths",
    "BB-015": "living-person protections",
    "BB-016": "provenance",
    "BB-017": "constitution policy",
    "BB-018": "audit events",
    "BB-019": "live projections",
    "BB-020": "backup verification",
    "BB-021": "surface contract",
    "BB-022": "runtime hardening",
    "BB-023": "App Check",
    "BB-024": "App Check enforcement",
    "BB-025": "resource controls",
    "BB-026": "query guardrails",
    "BB-027": "IAP/server RBAC",
    "BB-028": "payload limits",
    "BB-029": "quarantine intake",
    "BB-030": "safe-fetch policy",
    "BB-032": "promotion controls",
    "BB-033": "daily budget",
    "BB-034": "alerting policy SEC-SRC-01",
    "BB-035": "kill switches",
    "BB-036": "security regression suite",
    "BB-037": "source adapter registry",
    "BB-038": "query packs",
    "BB-039": "discovery ingestion",
    "BB-040": "relevance assessment",
    "BB-042": "extraction records",
    "BB-043": "citation rot authority signal",
    "BB-044": "research-case quarantine",
    "BB-045": "Wikimedia adapters",
    "BB-046": "federal adapters",
    "BB-047": "gold corpus",
    "BB-049": "search projections",
    "BB-050": "locate jurisdiction",
    "BB-051": "map precision",
    "BB-052": "entity detail",
    "BB-055": "corrections intake",
    "BB-058": "seed campaigns",
    "BB-059": "load and abuse",
    "BB-060": "adversarial integrity",
    "BB-061": "restore drill",
    "BB-062": "App Hosting rollouts",
    "BB-063": "beta launch gate",
    "BB-070": "map data platform",
    "BB-071": "gold-corpus retrieval eval",
    "BB-072": "hybrid retrieval queries",
    "BB-073": "Internet Archive adapter",
    "BB-074": "Reddit adapter",
    "BB-075": "Common Crawl adapter",
    "BB-077": "evidence-pointer doctrine",
    "BB-081": "recalibration report",
    "BB-082": "exclusion-infrastructure layer",
    "BB-083": "citation link health",
    "BB-084": "scheduled-jobs alerting",
    "BB-086": "fact publish gate",
    "BB-087": "legal change monitoring",
    "BB-088": "launch readiness",
    "BB-089": "AI crawler policy",
    "BB-090": "notability vocabulary",
    "BB-091": "jurisdiction precision",
    "BB-092": "history graph",
    "BB-094": "launch corpora",
    "BB-095": "advisory/disclaimer classes",
    "BB-098": "persistent map canvas",
    "BB-099": "map visual language",
    "BB-101": "map perf traces",
    "BB-999": "test stub",
}

# Compound BB ids — longest keys first when substituting.
BB_COMPOUND_MAP = {
    "BB-039/BB-073/BB-075": "discovery-campaigns",
    "BB-039/BB-073": "discovery-campaigns/internet-archive",
    "BB-039/BB-075": "discovery-campaigns/common-crawl",
    "BB-073/BB-075": "internet-archive/common-crawl",
    "BB-074/BB-077": "reddit-sync/deletion-sync",
    "BB-020/BB-061": "backup/restore-drill",
    "BB-029/BB-044": "quarantine/research-case intake",
    "BB-019/BB-049": "live projections/search",
    "BB-074/BB-077": "reddit/deletion-sync",
}

TEXT_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".css",
    ".md",
    ".json",
    ".yaml",
    ".yml",
    ".py",
    ".toml",
    ".example",
}


def should_skip(path: Path) -> bool:
    return any(part in SKIP_PARTS for part in path.parts)


def iter_files() -> list[Path]:
    files: list[Path] = []
    for base in TARGET_DIRS:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or should_skip(path):
                continue
            if path.suffix in TEXT_EXTENSIONS or path.name.endswith(".example"):
                files.append(path)
    return files


def replace_bb(text: str) -> str:
    for compound, replacement in sorted(BB_COMPOUND_MAP.items(), key=lambda x: -len(x[0])):
        text = text.replace(compound, replacement)
    def sub_bb(match: re.Match[str]) -> str:
        code = match.group(0)
        return BB_MAP.get(code, "capability")
    return re.sub(r"\bBB-\d{3}\b", sub_bb, text)


def replace_bead_slugs(text: str) -> str:
    def sub_slug(match: re.Match[str]) -> str:
        slug = match.group(0)
        if slug in KEEP_BLACK_BOOK:
            return slug
        return BEAD_SLUG_MAP.get(slug, "capability")
    return re.sub(r"black-book-[a-z0-9]+", sub_slug, text)


def replace_tracker_language(text: str) -> str:
    replacements = [
        ("implementationOwnerBead", "implementationOwner"),
        ("ownerBead", "ownerCapability"),
        ("implementationBeads", "implementationCapabilities"),
        ("readonly bead:", "readonly gateId:"),
        ("record.bead !==", "record.gateId !=="),
        ("artifact.bead must be", "artifact.gateId must be"),
        ("if (record.bead !== 'beta-launch-gate')", "if (record.gateId !== 'beta-launch-gate')"),
        ("bead: 'beta-launch-gate'", "gateId: 'beta-launch-gate'"),
        ("bead: 'BB-063'", "gateId: 'beta-launch-gate'"),
        ("readonly bead: 'BB-063'", "readonly gateId: 'beta-launch-gate'"),
        ("corpus.bead !== 'BB-004'", "corpus.version !== '1'"),
        ("expected bead BB-004", "expected corpus version 1"),
        ("must map to one or more implementation beads", "must map to one or more implementation capabilities"),
        ("has invalid bead id", "has invalid capability id"),
        ("code: 'bead-format'", "code: 'capability-format'"),
        ("code: 'beads'", "code: 'capabilities'"),
        ("code: 'bead'", "code: 'corpus-version'"),
        ("declare its implementation-owner bead", "declare its implementation owner"),
        ("which bead owns the real implementation", "which capability owns the real implementation"),
        ("cross-bead registry compatibility", "cross-capability registry compatibility"),
        ("Bead:", "Research note:"),
        ("bead black-book-", "capability "),
        ("(census bead ", "(census capability "),
        ("release-builder bead", "release-builder capability"),
        ("ingestion bead", "ingestion capability"),
        ("this bead", "this capability"),
        ("the bead", "the capability"),
        ("a bead", "a capability"),
        ("per bead", "per capability"),
        ("Bead spec", "Capability spec"),
        ("bead spec", "capability spec"),
        ("bead's", "capability's"),
        ("bead ", "capability "),
        (" bead", " capability"),
        ("TODO(black-book-", "TODO("),
        ("TODO(release builder follow-on)", "TODO(release-builder follow-on)"),
    ]
    for old, new in replacements:
        text = text.replace(old, new)
    # Remove BB-format validation regex blocks in threat-corpus
    text = re.sub(
        r"for \(const bead of threat\.implementationCapabilities\) \{\s*"
        r"if \(!/\^BB-\\d\{3\}\$/.test\(bead\)\) \{\s*"
        r"issues\.push\(\{\s*"
        r"code: 'capability-format',\s*"
        r"message: `\$\{threat\.id\} has invalid capability id \$\{bead\}`,\s*"
        r"\}\);\s*"
        r"\}\s*"
        r"\}",
        "",
        text,
        flags=re.MULTILINE,
    )
    return text


def transform(text: str) -> str:
    text = replace_bb(text)
    text = replace_bead_slugs(text)
    text = replace_tracker_language(text)
    # Clean up awkward doubles from replacements
    text = text.replace("capability capability", "capability")
    text = text.replace("the capability's own capability's", "the capability's")
    return text


def main() -> int:
    changed = 0
    for path in iter_files():
        original = path.read_text(encoding="utf-8")
        updated = transform(original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            changed += 1
    print(f"Updated {changed} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
