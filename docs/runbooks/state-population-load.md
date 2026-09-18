# Historical state population data

Census Working Paper 56, Tables 15–65, supplies state-level historical counts. Derive and validate
the committed CSV with a local copy of the official workbook:

```bash
TWPS0056_STATE_XLSX=/tmp/twps0056/tabs15-65.xlsx \
  uv run python packages/ops-data/scripts/derive-twps0056-state.py
```

The derivation checks summed state counts against the committed national CSV. Investigate any
mismatch; do not force totals to agree by fabricating missing populations.

`packages/ops-data/src/demographics/state-loader.ts` exports `runStateDemographicsLoad` and
requires an explicit writer. It is a library, not a database-loading CLI. The map artifact builder
is `packages/ops-data/scripts/build-state-population-index.ts`; inspect its inputs before use.

State admission, changing boundaries, race categories and free/enslaved categories constrain
comparison. Preserve vintage and source metadata. Do not interpret absent state/decade rows as
zero. Database writes belong in reviewed Postgres ingestion, with isolated checks first.
No periodic load is installed.
