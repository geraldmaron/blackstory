#!/usr/bin/env python3
"""Sort memory records in the staged .beads export so they stop reordering on every commit.

Every `bd` invocation re-exports .beads/issues.jsonl, and the lines whose JSON has
"_type":"memory" come out in whatever order bd's internal map iteration happens to produce
that run. Issue records are not affected. The result is a diff of roughly 58 insertions / 58
deletions on sessions that touch no memory content at all: the two line sets are byte-
identical, only their order differs. That churn either gets committed as noise or has to be
proven a no-op and discarded by hand, and either way it can bury a real edit sitting in the
same file.

This hook does not touch bd's exporter. It runs after beads has already written and staged
its export, and gives the memory lines a deterministic order: sorted by their "key" field.
Everything that is not a memory record — every issue, every other _type — is left exactly
where bd put it; only the positions bd already gave to memory lines get reassigned among
themselves. No line's bytes are ever altered, so a diff against a previous stable export shows
nothing when the only change was reordering.

Guard: if the staged file is not valid JSONL, or the reordering would change the multiset of
lines (a bug here should never silently corrupt the export), this does nothing but print one
line to stderr and lets the commit proceed with bd's own line order.

Usage:
  stabilize-beads-export.py              # staged .beads/issues.jsonl, rewrite + re-stage
  stabilize-beads-export.py --self-test  # run the in-memory self-test and exit
"""

from __future__ import annotations

import json
import subprocess
import sys
from collections import Counter

EXPORT_PATH = ".beads/issues.jsonl"


def stabilize_lines(lines: list[str]) -> tuple[list[str] | None, str | None]:
    """Reorder memory-record lines by key, in place among their own positions.

    `lines` holds one JSONL line per element, no trailing newline. Returns
    (new_lines, None) on success, or (None, reason) if the guard fires and nothing should
    be written.
    """
    parsed: list[object] = []
    for line in lines:
        if not line.strip():
            return None, "blank line in JSONL"
        try:
            parsed.append(json.loads(line))
        except json.JSONDecodeError as exc:
            return None, f"not valid JSONL ({exc})"

    memory_positions = [
        i
        for i, obj in enumerate(parsed)
        if isinstance(obj, dict) and obj.get("_type") == "memory"
    ]
    if not memory_positions:
        return None, "no memory records to stabilize"

    # Sort only the memory lines, by their "key" field; missing keys sort first and stay
    # mutually stable via Python's stable sort.
    memory_lines = [(parsed[i].get("key", ""), lines[i]) for i in memory_positions]
    memory_lines.sort(key=lambda pair: pair[0])

    new_lines = list(lines)
    for position, (_key, line) in zip(memory_positions, memory_lines):
        new_lines[position] = line

    # Every non-memory position must be untouched, and the two line multisets must match
    # exactly — this is a bug guard, not an expected outcome.
    for i, original in enumerate(lines):
        if i not in memory_positions and new_lines[i] != original:
            return None, "non-memory line moved (internal bug)"
    if Counter(new_lines) != Counter(lines):
        return None, "reorder changed the line multiset (internal bug)"

    return new_lines, None


def staged_export_blob() -> str | None:
    """The staged content of the export path, or None if it is not staged/present."""
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0 or EXPORT_PATH not in result.stdout.splitlines():
        return None
    show = subprocess.run(
        ["git", "show", f":{EXPORT_PATH}"],
        capture_output=True,
        text=True,
        check=False,
    )
    return show.stdout if show.returncode == 0 else None


def restage(path: str, content: str) -> bool:
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(content)
    result = subprocess.run(["git", "add", path], check=False)
    return result.returncode == 0


def run() -> int:
    blob = staged_export_blob()
    if blob is None:
        return 0  # nothing staged for this path — not this hook's concern

    had_trailing_newline = blob.endswith("\n")
    lines = blob.splitlines()
    new_lines, reason = stabilize_lines(lines)
    if new_lines is None:
        print(f"stabilize-beads-export: skipping ({reason})", file=sys.stderr)
        return 0  # guard fires: leave bd's own order in place, do not block the commit

    if new_lines == lines:
        return 0  # already stable — nothing to rewrite or re-stage

    new_content = "\n".join(new_lines) + ("\n" if had_trailing_newline else "")
    if not restage(EXPORT_PATH, new_content):
        print("stabilize-beads-export: failed to re-stage the sorted export", file=sys.stderr)
        return 1
    return 0


def self_test() -> int:
    sample = [
        '{"_type":"issue","id":"repo-1"}',
        '{"_type":"memory","key":"zeta","value":"z"}',
        '{"_type":"memory","key":"alpha","value":"a"}',
        '{"_type":"issue","id":"repo-2"}',
        '{"_type":"memory","key":"mike","value":"m"}',
    ]
    new_lines, reason = stabilize_lines(sample)
    assert reason is None, f"unexpected guard on well-formed sample: {reason}"
    assert new_lines is not None
    # Memory records occupy positions 1, 2, 4 in `sample` — those three positions get the
    # sorted memory lines back (alpha, mike, zeta); positions 0 and 3 (both issues) are
    # untouched.
    expected = [
        '{"_type":"issue","id":"repo-1"}',
        '{"_type":"memory","key":"alpha","value":"a"}',
        '{"_type":"memory","key":"mike","value":"m"}',
        '{"_type":"issue","id":"repo-2"}',
        '{"_type":"memory","key":"zeta","value":"z"}',
    ]
    assert new_lines == expected, f"got {new_lines!r}"
    assert Counter(new_lines) == Counter(sample), "multiset changed"

    # Non-memory lines are untouched at their original positions.
    assert new_lines[0] == sample[0]
    assert new_lines[3] == sample[3]

    # Already-sorted input is a no-op.
    already_sorted, reason = stabilize_lines(expected)
    assert reason is None
    assert already_sorted == expected

    # Guard: invalid JSON leaves everything alone.
    broken = sample + ["not json"]
    result, reason = stabilize_lines(broken)
    assert result is None and reason is not None, "invalid JSONL should trip the guard"

    # Guard: no memory records at all is a no-op, reported via reason rather than an error.
    no_memory = ['{"_type":"issue","id":"repo-1"}']
    result, reason = stabilize_lines(no_memory)
    assert result is None and reason == "no memory records to stabilize"

    print("stabilize-beads-export: self-test OK")
    return 0


def main() -> int:
    if "--self-test" in sys.argv:
        return self_test()
    return run()


if __name__ == "__main__":
    sys.exit(main())
