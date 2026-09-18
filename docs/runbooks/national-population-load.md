# National population data

The historical source is Census Working Paper 56, Table 1. Validate the committed artifact with:

```bash
uv run python packages/ops-data/scripts/verify-twps0056-national.py
```

Inspect source revisions before updating the registered checksum or derived CSV. Preserve the
original race-category wording, source URL, retrieval time and content hash. Historical and
modern categories are not automatically comparable.

`packages/ops-data/src/demographics/national-loader.ts` exports the pure
`runNationalDemographicsLoad` function. It requires an explicit writer; executing that file
with Node does not load a database. `national-timeline.ts` builds the merged projection from
supplied historical and modern inputs. It is not a live acquisition or scheduling command.

Use reviewed Postgres ingestion under `packages/ops-data/scripts/` for a configured dataset.
Verify destination schema, provenance and idempotency on an isolated database before applying
real data. Do not recreate a document-store loader. No automatic refresh is scheduled.

See [ingestion methodology](data-ingestion-methodology.md) and
[comparability](census-population-comparability.md).
