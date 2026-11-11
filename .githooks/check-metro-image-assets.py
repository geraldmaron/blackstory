#!/usr/bin/env python3
"""Block image formats that reach a known-unpatched parser in the mobile bundler.

Metro parses every bundled image asset to read its dimensions, and it does that through
image-size, which carries two unfixed denial-of-service advisories:

  GHSA-w3rx-r6r6-pgpr  ICNS parser, infinite loop
  GHSA-5p2g-fcmc-qvqq  JXL and HEIF parsers, infinite loops

There is no version to upgrade to. Every published image-size release including the latest is
inside the vulnerable range, and metro@latest still depends on ^1.0.2, so the advisory cannot be
cleared by bumping anything. The reason it does not matter today is that apps/mobile ships only
PNG, JPG and SVG, so those three parsers are never reached — and that is a property of the asset
tree, which is exactly the kind of thing that changes quietly.

Scope is deliberately apps/mobile: metro only bundles for the mobile app. An .icns in a web app
or in docs is not this problem.

Usage: check-metro-image-assets.py           # checks staged additions
"""

from __future__ import annotations

import subprocess
import sys

BLOCKED_SUFFIXES = (".icns", ".jxl", ".heif", ".heic")
SCOPE = "apps/mobile/"


def staged_paths() -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return []
    return [line for line in result.stdout.splitlines() if line]


def main() -> int:
    offenders = [
        path
        for path in staged_paths()
        if path.startswith(SCOPE) and path.lower().endswith(BLOCKED_SUFFIXES)
    ]
    if not offenders:
        return 0

    print("\nBLOCKED: image format with an unpatched parser in the mobile bundler", file=sys.stderr)
    for path in offenders:
        print(f"  {path}", file=sys.stderr)
    print(
        "\nMetro reads asset dimensions through image-size, whose ICNS/JXL/HEIF parsers have\n"
        "open denial-of-service advisories (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq) and no\n"
        "fixed release to upgrade to. A malformed file of these types hangs the bundler.\n\n"
        "Convert the asset to PNG or JPG. If this format is genuinely required, check whether\n"
        "image-size has shipped a fix first, then narrow BLOCKED_SUFFIXES here and say why.\n",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
