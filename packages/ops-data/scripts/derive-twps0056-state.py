#!/usr/bin/env python3
"""Derive the committed twps0056 state CSV from the official tabs15-65.xlsx.

Fail-closed: after extraction, every decade's summed state Black population MUST equal the
committed national CSV (`twps0056-national-1790-1990.csv`) exactly. Stdlib only (zip+xml) so
the agent env does not need openpyxl.

Usage (from repo root):
    python3 packages/firebase/scripts/derive-twps0056-state.py
    # or with a local workbook:
    TWPS0056_STATE_XLSX=/path/to/tabs15-65.xlsx \\
      python3 packages/firebase/scripts/derive-twps0056-state.py
"""
from __future__ import annotations

import csv
import hashlib
import os
import pathlib
import re
import sys
import urllib.request
import zipfile
from collections import defaultdict
from xml.etree import ElementTree as ET

XLSX_URL = "https://www2.census.gov/library/working-papers/2002/demo/pop-twps0056/tabs15-65.xlsx"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
YEAR_RE = re.compile(r"^(\d{4})")
SPLIT_DECADES = {str(y) for y in range(1790, 1870, 10)}
FREE_SLAVE_TOLERANCE = 5

NAME_TO_FIPS: dict[str, str] = {
    "Alabama": "01",
    "Alaska": "02",
    "Arizona": "04",
    "Arkansas": "05",
    "California": "06",
    "Colorado": "08",
    "Connecticut": "09",
    "Delaware": "10",
    "District of Columbia": "11",
    "Florida": "12",
    "Georgia": "13",
    "Hawaii": "15",
    "Idaho": "16",
    "Illinois": "17",
    "Indiana": "18",
    "Iowa": "19",
    "Kansas": "20",
    "Kentucky": "21",
    "Louisiana": "22",
    "Maine": "23",
    "Maryland": "24",
    "Massachusetts": "25",
    "Michigan": "26",
    "Minnesota": "27",
    "Mississippi": "28",
    "Missouri": "29",
    "Montana": "30",
    "Nebraska": "31",
    "Nevada": "32",
    "New Hampshire": "33",
    "New Jersey": "34",
    "New Mexico": "35",
    "New York": "36",
    "North Carolina": "37",
    "North Dakota": "38",
    "Ohio": "39",
    "Oklahoma": "40",
    "Oregon": "41",
    "Pennsylvania": "42",
    "Rhode Island": "44",
    "South Carolina": "45",
    "South Dakota": "46",
    "Tennessee": "47",
    "Texas": "48",
    "Utah": "49",
    "Vermont": "50",
    "Virginia": "51",
    "Washington": "53",
    "West Virginia": "54",
    "Wisconsin": "55",
    "Wyoming": "56",
}

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "src" / "demographics" / "data"
OUT_CSV = DATA_DIR / "twps0056-state-1790-1990.csv"
NATIONAL_CSV = DATA_DIR / "twps0056-national-1790-1990.csv"


def col_row(ref: str) -> tuple[int, int]:
    col = "".join(c for c in ref if c.isalpha())
    row = int("".join(c for c in ref if c.isdigit()))
    n = 0
    for c in col:
        n = n * 26 + (ord(c) - 64)
    return n, row


def shared_strings(z: zipfile.ZipFile) -> list[str]:
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    return [
        "".join(t.text or "" for t in si.findall(".//m:t", NS)) for si in root.findall("m:si", NS)
    ]


def parse_int(val: object) -> int | None:
    if val is None:
        return None
    s = str(val).strip()
    if s in ("", "(NA)", "(X)", "-", "—"):
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def load_sheet_grid(
    z: zipfile.ZipFile, path: str, sst: list[str]
) -> dict[int, dict[int, object]]:
    root = ET.fromstring(z.read(path))
    rows: dict[int, dict[int, object]] = defaultdict(dict)
    for c in root.findall(".//m:c", NS):
        ref = c.get("r")
        if not ref:
            continue
        col, row = col_row(ref)
        v = c.find("m:v", NS)
        if v is None or v.text is None:
            val: object | None = None
        elif c.get("t") == "s":
            val = sst[int(v.text)]
        else:
            val = v.text
        rows[row][col] = val
    return rows


def extract_rows(xlsx_path: pathlib.Path) -> list[tuple[str, str, str, int, int, str, str]]:
    rows: list[tuple[str, str, str, int, int, str, str]] = []
    with zipfile.ZipFile(xlsx_path) as z:
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        rid = {rel.get("Id"): rel.get("Target") for rel in rels}
        sst = shared_strings(z)
        for sh in wb.findall("m:sheets/m:sheet", NS):
            name = sh.get("name")
            if name not in NAME_TO_FIPS:
                raise SystemExit(f"unexpected sheet name: {name!r}")
            fips = NAME_TO_FIPS[name]
            ridv = sh.get(
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
            )
            target = rid[ridv]
            path = target if target.startswith("xl/") else f"xl/{target.lstrip('/')}"
            grid = load_sheet_grid(z, path, sst)
            seen: set[str] = set()
            in_number = False
            for r in sorted(grid):
                a = grid[r].get(1)
                if a is None:
                    continue
                s = str(a).strip()
                if s == "NUMBER":
                    in_number = True
                    continue
                if s == "PERCENT":
                    in_number = False
                    continue
                if not in_number or s.startswith("."):
                    continue
                m = YEAR_RE.match(s)
                if not m:
                    continue
                decade = m.group(1)
                if decade in seen:
                    continue
                total = parse_int(grid[r].get(2))
                black = parse_int(grid[r].get(4))
                if total is None or black is None:
                    continue
                seen.add(decade)
                free = parse_int(grid[r].get(8))
                slave = parse_int(grid[r].get(9))
                if (
                    decade in SPLIT_DECADES
                    and free is not None
                    and slave is not None
                    and abs(free + slave - black) <= FREE_SLAVE_TOLERANCE
                ):
                    rows.append((fips, name, decade, total, black, str(free), str(slave)))
                else:
                    rows.append((fips, name, decade, total, black, "", ""))
    rows.sort(key=lambda row: (row[0], row[2]))
    return rows


def load_national_black() -> dict[str, int]:
    out: dict[str, int] = {}
    with NATIONAL_CSV.open() as handle:
        reader = csv.DictReader(line for line in handle if not line.startswith("#"))
        for record in reader:
            out[record["decade"]] = int(record["blackPopulation"])
    return out


def validate_against_national(rows: list[tuple[str, str, str, int, int, str, str]]) -> None:
    by_decade: dict[str, int] = defaultdict(int)
    for row in rows:
        by_decade[row[2]] += row[4]
    national = load_national_black()
    mismatches: list[str] = []
    for decade, expected in national.items():
        got = by_decade.get(decade, 0)
        if got != expected:
            mismatches.append(f"{decade}: stateSum={got} national={expected}")
    if mismatches:
        raise SystemExit("FAIL national sum validation:\n  " + "\n  ".join(mismatches))


def write_csv(rows: list[tuple[str, str, str, int, int, str, str]]) -> None:
    header = """# Normalized state race totals, 1790-1990 — parse target for censusStateDecades.
#
# SOURCE (public domain, 17 U.S.C. §105):
#   U.S. Census Bureau, Population Division Working Paper No. 56 (twps0056),
#   Gibson & Jung (2002), Tables 15–65 (one sheet per state / D.C.).
#   Landing page: https://www.census.gov/library/working-papers/2002/demo/POP-twps0056.html
#   Machine artifact: https://www2.census.gov/library/working-papers/2002/demo/pop-twps0056/tabs15-65.xlsx
#
# DERIVATION: NUMBER block, first main decade row only (skip Sample / 15% / 5% subrows).
#   Not every state appears every decade (admission / coverage). Free/Slave columns only when
#   they reconstitute Black within ±5. State Black sums per decade equal the committed national
#   CSV exactly (validated by packages/firebase/scripts/derive-twps0056-state.py).
#
# Columns: stateFips,stateName,decade,totalPopulation,blackPopulation,blackFree,blackSlave
"""
    with OUT_CSV.open("w", newline="") as handle:
        handle.write(header)
        writer = csv.writer(handle)
        writer.writerow(
            [
                "stateFips",
                "stateName",
                "decade",
                "totalPopulation",
                "blackPopulation",
                "blackFree",
                "blackSlave",
            ]
        )
        writer.writerows(rows)


def main() -> int:
    xlsx_env = os.environ.get("TWPS0056_STATE_XLSX")
    if xlsx_env:
        xlsx_path = pathlib.Path(xlsx_env)
        raw = xlsx_path.read_bytes()
    else:
        print(f"Downloading {XLSX_URL} ...", file=sys.stderr)
        raw = urllib.request.urlopen(XLSX_URL, timeout=120).read()  # noqa: S310
        xlsx_path = pathlib.Path("/tmp/twps0056-tabs15-65.xlsx")
        xlsx_path.write_bytes(raw)
    checksum = hashlib.sha256(raw).hexdigest()
    print(f"tabs15-65.xlsx sha256 = {checksum}")

    rows = extract_rows(xlsx_path)
    validate_against_national(rows)
    write_csv(rows)
    print(f"PASS: wrote {len(rows)} rows to {OUT_CSV}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
