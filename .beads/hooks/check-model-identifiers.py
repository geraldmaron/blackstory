#!/usr/bin/env python3
"""Block drafter-model provenance from reaching this PUBLIC repo (repo-wzz3).

Policy: no record of WHICH MODEL produced WHICH catalog content belongs on a published
surface. That provenance lives in bb_research.entity_enrichment, which is not published.

What this blocks: a *versioned* model identifier (claude-..-4-5, deepseek-r1-0528,
gpt-4o, qwen3-32b) appearing in the staged .beads export or in a commit message. A
versioned id is the unambiguous signal that a concrete model was recorded rather than a
tier being discussed.

What this deliberately does NOT block: tier shorthand ("cheap tier", "sonnet-class",
"MODEL TIER: Sonnet") and provider/infra names (openrouter, ollama). Those are work-routing
metadata, not content provenance, and the repo is full of them by design.

ALLOWLIST: identifiers that are already committed in tracked source or config. Scrubbing a
name from beads while it sits in .env.example buys nothing, so it is allowed there too.

Usage:
  check-model-identifiers.py --staged            # staged .beads/issues.jsonl
  check-model-identifiers.py --message <file>    # commit message file
"""

from __future__ import annotations

import re
import subprocess
import sys

# Versioned model id: family, a separator, then something containing a digit.
PATTERN = re.compile(
    r"\b(?:claude|gpt|deepseek|qwen|llama|mistral|gemini|grok|nemotron|gemma|phi)"
    r"[-.][a-z0-9.\-]*[0-9][a-z0-9.\-]*",
    re.IGNORECASE,
)

# Already public in tracked source/config — see module docstring.
ALLOWLIST = {
    "gemini-embedding-001",
    "gpt-oss-20b",
    "nemotron-3-super-120b-a12b",
    "nemotron-3-nano-30b-a3b",
    "gemma-4-31b-it",
    "qwen3",
}


def is_allowed(token: str) -> bool:
    """Allow an allowlisted id, and either truncation of it ("nemotron-3 family") or a
    longer form of it ("qwen3-32b" against "qwen3"). Prefix either way, so a roster name
    written loosely in prose does not have to be enumerated in full."""
    lowered = token.lower()
    return any(
        lowered.startswith(allowed) or allowed.startswith(lowered) for allowed in ALLOWLIST
    )


def offenders(text: str) -> list[str]:
    found = []
    for match in PATTERN.finditer(text):
        token = match.group(0).rstrip(".,;:)\"'")
        if is_allowed(token):
            continue
        found.append(token)
    return sorted(set(found))


def staged_beads_export() -> str:
    result = subprocess.run(
        ["git", "show", ":.beads/issues.jsonl"],
        capture_output=True,
        text=True,
        check=False,
    )
    # Not staged (or not present) — nothing to check.
    return result.stdout if result.returncode == 0 else ""


def report(found: list[str], where: str) -> int:
    if not found:
        return 0
    print(f"\nBLOCKED: drafter-model identifier in {where} (repo-wzz3)", file=sys.stderr)
    for token in found:
        print(f"  {token}", file=sys.stderr)
    print(
        "\nThis repository is PUBLIC. Model-to-content provenance belongs in\n"
        "bb_research.entity_enrichment, not on a published surface.\n\n"
        "Fix by naming the TIER instead of the model ('cheap tier', 'a reasoning model').\n"
        "If the identifier is already committed in tracked source or config, add it to\n"
        "ALLOWLIST in .beads/hooks/check-model-identifiers.py and say why.\n",
        file=sys.stderr,
    )
    return 1


def main() -> int:
    if "--staged" in sys.argv:
        return report(offenders(staged_beads_export()), "the staged .beads export")
    if "--message" in sys.argv:
        path = sys.argv[sys.argv.index("--message") + 1]
        with open(path, encoding="utf-8") as handle:
            # Ignore the commented scissors/status block git appends.
            body = "\n".join(
                line for line in handle.read().splitlines() if not line.startswith("#")
            )
        return report(offenders(body), "the commit message")
    print("usage: check-model-identifiers.py --staged | --message <file>", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
