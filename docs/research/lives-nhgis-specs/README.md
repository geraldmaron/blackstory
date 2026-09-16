<!--
  The raw, per-decade NHGIS table specs behind the Lives Across the Decades ingest. Every table,
  variable code and cell description here came back from a live api.ipums.org/metadata/nhgis call on
  2026-09-15. The consolidated view is ../lives-nhgis-table-map.md; these are the working papers it
  was written from, kept because they carry the exact codes and the per-table traps.
-->

# Lives NHGIS specs, per decade

Four passes over the NHGIS metadata API, one per decade group, each checking every published table
for a race crossing at nation and state level. They are the provenance behind
`packages/ops-data/src/lives/historical.ts`: when a measure in that module names a dataset, table and
variable code, the spec here is where it came from and what its universe said.

| File | Decades | Verified cells |
|---|---|---|
| [spec-1870-1900.md](./spec-1870-1900.md) | 1870, 1880, 1890, 1900 | 11 |
| [spec-1910-1930.md](./spec-1910-1930.md) | 1910, 1920, 1930 | 14 of 24 |
| [spec-1940-1950.md](./spec-1940-1950.md) | 1940, 1950 | 3 of 14 |
| [spec-1960-1970.md](./spec-1960-1970.md) | 1960, 1970 | 7 of 12 |

Read [../lives-nhgis-table-map.md](../lives-nhgis-table-map.md) first. It carries the summary table,
the gaps, and the traps that would each have published a wrong figure. Come here for a specific
table's variable codes, its exact universe string, or the reason a particular cell was ruled out.

A "NOT AVAILABLE" in these files is a statement about a completed search, not an abandoned one. The
1940/1950 pass, for example, fetched all 244 data tables across the six county-or-state datasets
individually with their full variable lists before concluding.
