# Runbook: NHGIS historical county race load (1790–1960)

Loads `censusCountyHistoricalDecades` — Black population by county per decade on each decade's
**historical** NHGIS boundaries. All acquisition is free (grant-funded IPUMS NHGIS). Acquisition and database writes are explicit operator steps, never an automatic CI task.

## Prerequisites (one-time)

1. Create a free IPUMS account and register for the **NHGIS collection**:
   <https://uma.pop.umn.edu/nhgis/user/new> then the NHGIS registration.
2. Get an API key: <https://account.ipums.org/api_keys>. Export it as `NHGIS_API_KEY`
   (never commit it; it is read from the environment at runtime only).

Source is registered as `nhgis-county-race` (verdict `attribution-required`) — every doc carries
the NHGIS attribution string; the public surface must credit NHGIS/IPUMS.

## Step 1 — Acquire extracts (per decade)

The per-decade dataset + table + variable mapping is the verified registry
`NHGIS_DECADE_RACE_TABLES` (`@repo/domain`, `packages/domain/src/adapters/nhgis`). For each
decade submit an extract for its `dataset`/`dataTable` at `geogLevels: ['county']`, using
`buildNhgisExtractDefinition(decade)` + `submitNhgisExtract` / `getNhgisExtractStatus`, or the
IPUMS web UI. Poll until `completed`, then **download and unzip** each into one directory, e.g.
`./nhgis-data/`. Each file is named `..._<decade>_county.csv`.

> NHGIS CSVs carry two header rows (codes, then descriptions); the parser handles that. Nothing
> in this repo depends on a zip library — the operator unzips.

## Parsing and persistence

`packages/ops-data/src/demographics/nhgis-loader.ts` exports `runNhgisCountyLoad`, which takes
CSV inputs and an explicit writer. It is not a standalone loading command. The existing Postgres
NHGIS ingestion entry is `packages/ops-data/scripts/ingest-phase1-nhgis.ts`; inspect its dataset
and metric scope rather than assuming it imports every historical county race table.

The pure `buildNhgisCountyDecadeArtifact` builder emits bounded public map data. Readers use
published artifacts, not direct scans of private source rows. Verify attribution, boundary vintage,
counts and content hashes before publishing a rebuilt artifact. No refresh is scheduled.

## Step 4 — Verify

County sums per decade should land within ~1% **below** the twps0056 national Black totals (the
"population not in any county" territorial residual). Verified anchors (Black): 1790 757,208;
1860 4,441,830 (free 488,070 / slave 3,953,760); 1940 12,865,518; 1960 18,871,839. Several
decades reconcile to the exact person (1840/1850/1870/1950).

## What could go wrong

- **Multi-county reporting areas** (`COUNTYA >= 9900`, e.g. 1790 Virginia) superset their
  counties and are excluded by the parser — do not re-add them (they overcount).
- **1890** lists Negro for 1890/1880/1870 in one table; the registry maps only the 1890 column.
- **`gisJoin` is NOT modern FIPS.** Cross-decade or modern-boundary joins require an NHGIS
  crosswalk (deferred). County-over-county change across boundary vintages is already blocked by
  the statistics combination rules (`boundaryVersion` must match).
- **Upstream format drift** → the parser fails closed (missing required column / YEAR mismatch);
  investigate before reloading.
