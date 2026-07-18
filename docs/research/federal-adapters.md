# Federal archive and public-history adapters (BB-046).

## Scope

Fixture-only adapters for five federal and public-history source families:

| Family | Adapter ID | Kill switch |
| --- | --- | --- |
| Library of Congress | `loc-collections-v1` | `adapter:loc-collections-v1` |
| National Archives | `nara-catalog-v1` | `adapter:nara-catalog-v1` |
| DPLA | `dpla-items-v1` | `adapter:dpla-items-v1` |
| NPS / National Register | `nps-national-register-v1` | `adapter:nps-national-register-v1` |
| School history (approved) | `school-history-v1` | `adapter:school-history-v1` |

## Boundaries

- **Large exports** — `filterLargeExportPayload` strips bulk keys (`fullText`, `boundaryGeojson`, etc.) and shrinks payloads above per-adapter byte limits before candidate stamping. Raw blobs never enter the canonical application database.
- **Retention** — `qualifiesForCandidateRetention` / `partitionByRetention` drop records missing required metadata, canonical URLs, or allowed classifications.
- **Failure isolation** — `buildIsolatedFederalRunResult` routes drift and runtime errors to quarantine/dead-letter with `publicationImpact: 'none'`. Public serving is unaffected.

## Validation

```bash
pnpm --filter @repo/domain test
cd workers/research && uv run pytest src/black_book_research/adapters/federal -q
```

## Schemas

Raw export fixture shapes live under `packages/schemas/adapters/federal/*.schema.json`.
