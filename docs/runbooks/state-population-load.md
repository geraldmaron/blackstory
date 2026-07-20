# State population timeline load runbook (twps0056 Tables 15–65)

Operator walkthrough for loading historical Black population by state (1790–1990) into
`censusStateDecades`. Public domain (17 U.S.C. §105). Never run in CI.

## Step 1 — Derive / verify the committed CSV

```bash
# Prefer a local copy of the official workbook if already downloaded:
TWPS0056_STATE_XLSX=/tmp/twps0056/tabs15-65.xlsx \
  python3 packages/firebase/scripts/derive-twps0056-state.py
```

The script fail-closes unless every decade’s summed state Black population equals the committed
national CSV exactly. Output:
`packages/firebase/src/demographics/data/twps0056-state-1790-1990.csv`.

## Step 2 — Load Firestore

```bash
APP_FIREBASE_ALLOW_PRODUCTION=1 FIREBASE_PROJECT_ID=black-book-efaaf \
  GOOGLE_CLOUD_QUOTA_PROJECT=black-book-efaaf \
  node --conditions development --import tsx \
  packages/firebase/src/demographics/state-load-cli.ts
```

Expect ~885 `created` on first load; re-runs report `unchanged`.

## Step 3 — Verify

- `/data` shows “Historical state coverage” strip (row count + state count).
- `getHistoricalStatePopulationCoverage()` returns ~885 rows / 51 states / 1790–1990.
- Modern 2010→2020 state movers still come from `censusCountyDecades` sums (unchanged).

## Notes

- Not every state appears every decade (admission / coverage). Alaska/Hawaii enter mid-century.
- Free/enslaved fields appear only when they reconstitute Black within ±5.
- Map choropleth integration for historical state layers is a follow-on (not this load).
