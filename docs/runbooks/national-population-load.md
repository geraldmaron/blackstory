# National population timeline load runbook

Operator walkthrough for loading the national Black population timeline (1790–2020) into Firestore. This is a deliberate multi-step operator task, never run in CI. Prerequisites: development environment set up, `.env.local` with valid Firestore credentials, and the `twps0056-national-1790-1990.csv` committed artifact at `packages/firebase/src/demographics/data/`.

## Step 1: Verify the source artifact

The historical data lane (1790–1990) comes from U.S. Census Bureau Working Paper 56, Table 1. Before loading, verify the upstream xlsx hasn't drifted.

```bash
cd /path/to/blackstory
uv run python packages/firebase/scripts/verify-twps0056-national.py
```

Expected output: the script downloads the official xlsx from the Census Bureau, computes its sha256, prints it to stdout, and asserts that every figure in the committed CSV appears in the xlsx. If the script exits with `0`, the artifact is verified.

**Action**: Copy the printed sha256 and paste it into the `checksumSha256` field of the `us-census-historical-race-1790-1990` registry entry in `packages/domain/src/external-data-sources.ts` (if not already present). This is the source-of-truth checksum for future audits.

If the script fails: the upstream xlsx has drifted (schema change, URL shift, or row count mismatch). Investigate the Census Bureau's website to understand the change before proceeding.

## Step 2: Load the historical decade collection

The loader writes the `censusNationalDecades` Firestore collection (one document per decade 1790–1990, id = decade). This is an idempotent write: if a decade doc is unchanged, the loader skips the write and reports `unchanged`.

```bash
node --conditions development --import tsx packages/firebase/src/demographics/national-load-cli.ts
```

Expected output: 21 rows (decades 1790–1990). For each decade, the loader reports one of:
- `created`: new decade doc
- `updated`: decade doc changed (old checksum didn't match)
- `unchanged`: decade doc was already current

Re-running this command over unchanged CSV should yield 21 `unchanged` messages — this is the verification that the load is idempotent.

## Step 3: Build and write the snapshot projection

The national timeline is a *merged snapshot* combining both lanes: the historical 1790–1990 from `censusNationalDecades` plus the modern 2000–2020 national totals (summed from ingested `censusCountyDecades`). The builder computes adjacent-decade changes and writes a single materialized doc: `publicMeta/nationalPopulationTimeline`.

```bash
node --conditions development --import tsx packages/firebase/src/demographics/national-timeline.ts
```

Expected output: the builder loads both lanes, merges them, computes deltas, and writes (or skips) the projection. Re-run is idempotent (skips write when contentHash matches).

## Step 4: Verify expected coverage

The merged timeline should span 1790–2020:

- **Historical lane (1790–1990)**: 21 decades from `censusNationalDecades`
- **Modern lane (2000–2020)**: up to 3 decades from `censusCountyDecades` sums
- **Total coverage**: up to 24 rows

Spot-check anchor values in `publicMeta/nationalPopulationTimeline`:

| Decade | Expected Black population | Expected split (if 1790–1860) |
| --- | --- | --- |
| 1790 | 757,208 | 59,527 free + 697,681 enslaved |
| 1860 | 4,441,830 | 488,070 free + 3,953,760 enslaved |
| 1870 | 4,880,009 | (no split; emancipation) |
| 1990 | 29,986,060 | (no split) |
| 2000 | ~36.4 million | (summed from counties, no split) |
| 2010 | ~38.9 million | (summed from counties, no split) |
| 2020 | ~41.1 million | (summed from counties, no split) |

If coverage is incomplete (e.g., only historical 1790–1990 with no modern lanes), re-run step 2 or verify that `censusCountyDecades` has been loaded for 2000, 2010, 2020. After completing the load for any missing decades, re-run step 3 to rebuild the snapshot.

## Step 5: Scheduling (semi-annual cadence)

The timeline should be rebuilt semi-annually to pick up any source revisions or corrections. The Census Bureau occasionally releases updated historical figures in twps0056, and decennial data may be revised.

- Automatic scheduler wiring: **TODO** (beads item repo-lcl9.1 tracks the cron-job setup)
- Manual run: execute steps 1–3 above in order
- Partial-load recovery: if step 2 times out or partially loads, step 3's snapshot will reflect only what was loaded; complete the load, then re-run step 3 to rebuild the full snapshot.

## What could go wrong

### Upstream .xlsx format change

**Symptom**: `verify-twps0056-national.py` fails with a schema error (unexpected columns, missing headers, or row count mismatch).

**Cause**: The Census Bureau may have reorganized or renamed the xlsx file structure.

**Recovery**: Check the Census Bureau's working-paper landing page for a new download URL or format. If the URL is the same but the structure changed, file an issue with context (print the new column headers). Update the registry entry and the CSV if the change is confirmed intentional.

### A value in the source .xlsx changed

**Symptom**: `verify-twps0056-national.py` runs but prints a mismatch error: "CSV value XXXX does not appear in xlsx for decade YYYY."

**Cause**: The Census Bureau corrected a historical figure (rare but documented).

**Recovery**: Inspect the committed CSV and the xlsx side-by-side. If the xlsx value is authoritative and differs, update the CSV, re-verify, and re-run steps 2 and 3. The loader will report `updated` for the affected decade, and the snapshot will refresh.

### Partial or interrupted load

**Symptom**: Step 2 times out or errors mid-run, writing some decades but not all 21.

**Cause**: Network interruption, Firestore quota, or query timeout.

**Recovery**: 
1. Check `censusNationalDecades` in Firestore to see which decades were written.
2. Re-run step 2. The loader is idempotent: already-written decades report `unchanged`, and the missing ones resume.
3. Once step 2 completes with all 21 decades, re-run step 3 to rebuild the projection.

### Modern lanes (2000–2020) missing or incomplete

**Symptom**: The snapshot has only 1790–1990 (21 rows), missing 2000–2020.

**Cause**: `censusCountyDecades` hasn't been loaded for 2000, 2010, or 2020. (The loader expects those county-level docs to already exist.)

**Recovery**: 
1. Verify the county loader has run: check Firestore for `censusCountyDecades` with decade keys `2000`, `2010`, `2020`.
2. If missing, run the county loader (`packages/firebase/src/demographics/load-cli.ts`) for those decades first.
3. Re-run step 3 (the timeline builder) to merge both lanes.

