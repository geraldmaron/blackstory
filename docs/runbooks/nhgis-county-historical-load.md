# Runbook: NHGIS historical county race load (1790–1960)

Loads `censusCountyHistoricalDecades` — Black population by county per decade on each decade's
**historical** NHGIS boundaries. All acquisition is free (grant-funded IPUMS NHGIS). Writes to
real Firestore are a deliberate operator step, never CI.

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

## Step 2 — Load into Firestore (idempotent)

```bash
NHGIS_DATA_DIR=./nhgis-data \
  node --conditions development --import tsx \
  packages/firebase/src/demographics/nhgis-load-cli.ts
```

Writes one doc per NHGIS county (`gisJoin`) per decade, id `${gisJoin}_${decade}`. `contentHash`
excludes timestamps → a re-run over unchanged CSVs reports all `unchanged`. A changed count
reports `updated` and preserves `createdAt`.

## Step 3 — Build the static map artifact

The collection is **client-read CLOSED** (~45k docs). The public map reads a bounded static
artifact instead. Read the collection (Admin SDK) and pass the docs to
`buildNhgisCountyDecadeArtifact(docs)` (`nhgis-load-cli.ts`), then write the result to a static
path (e.g. `apps/web/public/geo/county-historical-race-decades.json`) or Storage. The artifact
is decade-keyed (`byDecade[decade] → [{gisJoin, black, blackFree?, blackEnslaved?}]`) and carries
attribution + the boundary-vintage note.

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
