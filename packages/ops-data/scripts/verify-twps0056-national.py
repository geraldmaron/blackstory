#!/usr/bin/env python3
"""Verify the committed twps0056 national CSV against the official Census .xlsx.

The normalized CSV (`../src/demographics/data/twps0056-national-1790-1990.csv`) was transcribed
from Table 1 of Census Working Paper 56 (public domain). This script proves that transcription
is faithful AND detects upstream drift, WITHOUT depending on fragile merged-cell coordinates:

  1. Download the official Table 1 workbook (table01.xlsx) and print its sha256 (paste into the
     `checksumSha256` field of the us-census-historical-race-1790-1990 registry entry).
  2. Collect every integer-valued cell in the sheet into a set.
  3. Assert every population figure in the committed CSV appears somewhere in that set.

A missing figure means either a transcription error or an upstream workbook change — either way,
fail closed and investigate before re-loading.

Usage (from repo root, Python with openpyxl available via `uv`):
    uv run python packages/firebase/scripts/verify-twps0056-national.py
"""
from __future__ import annotations

import csv
import hashlib
import io
import pathlib
import sys
import urllib.request

XLSX_URL = "https://www2.census.gov/library/working-papers/2002/demo/pop-twps0056/table01.xlsx"
CSV_PATH = pathlib.Path(__file__).resolve().parents[1] / "src/demographics/data/twps0056-national-1790-1990.csv"


def main() -> int:
    try:
        import openpyxl  # noqa: PLC0415
    except ImportError:
        print("openpyxl is required: `uv pip install openpyxl` (or add it to the uv env).", file=sys.stderr)
        return 2

    print(f"Downloading {XLSX_URL} ...", file=sys.stderr)
    raw = urllib.request.urlopen(XLSX_URL, timeout=60).read()  # noqa: S310 (trusted census.gov host)
    checksum = hashlib.sha256(raw).hexdigest()
    print(f"table01.xlsx sha256 = {checksum}")

    workbook = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    sheet_values: set[int] = set()
    for sheet in workbook.worksheets:
        for row in sheet.iter_rows(values_only=True):
            for cell in row:
                if isinstance(cell, (int, float)) and float(cell).is_integer():
                    sheet_values.add(int(cell))

    missing: list[str] = []
    checked = 0
    with CSV_PATH.open() as handle:
        reader = csv.DictReader(line for line in handle if not line.startswith("#"))
        for record in reader:
            for field in ("totalPopulation", "blackPopulation", "blackFree", "blackSlave"):
                value = record[field]
                if value == "":
                    continue
                checked += 1
                if int(value) not in sheet_values:
                    missing.append(f"{record['decade']} {field}={value}")

    if missing:
        print(f"\nFAIL: {len(missing)} committed figure(s) not found in the official workbook:", file=sys.stderr)
        for entry in missing:
            print(f"  - {entry}", file=sys.stderr)
        return 1

    print(f"\nPASS: all {checked} committed population figures appear in table01.xlsx.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
