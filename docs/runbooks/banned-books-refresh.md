# Banned books listing refresh

Quarterly maintenance for the curated challenged-books listing. The job re-validates catalog
rows and purchase-link reachability, then proposes an updated listing snapshot for human review.
It never auto-publishes entities.

## Cadence

| Field | Value |
|---|---|
| Job id | `external-dataset-refresh-banned-books` |
| Schedule | Quarterly — 1st of Jan, Apr, Jul, Oct at 06:00 UTC |
| Cron | `0 6 1 1,4,7,10 *` |
| Roster | [`packages/config/src/scheduled-jobs/roster.ts`](../../packages/config/src/scheduled-jobs/roster.ts) |
| Kill switch | `source-adapter-external-dataset-refresh-banned-books` |

See [`scheduled-jobs-configuration.md`](./scheduled-jobs-configuration.md) for how schedules are
configured centrally.

## What the job does

1. Loads the curated seed catalog (research worker:
   `dataset_refresh.refresh_banned_books_listing`).
2. Validates each `BannedBookRecord` with `@repo/domain` validators.
3. Checks purchase links, citation URLs, and provenance source URLs via SSRF-safe fetch (injected
   in tests; wired in the research worker in production).
4. Marks purchase-link validation status (`valid` / `invalid`) with a timestamp.
5. Emits a private snapshot proposal and run record — **no public writes**.

Policy implementation lives in
[`packages/config/src/scheduled-jobs/jobs/banned-books-refresh.ts`](../../packages/config/src/scheduled-jobs/jobs/banned-books-refresh.ts).

## Operator steps

### Before a scheduled run

1. Confirm the kill switch is **disengaged** in `bb_ops.kill_switches`.
2. Confirm the research worker target is wired (see runner gaps in
   [`scheduled-jobs-configuration.md`](./scheduled-jobs-configuration.md)).
3. Review any open validation errors from the prior quarter.

### After a run

1. Inspect the job run record: `booksValidated`, `linksInvalid`, `validationErrors`.
2. For invalid purchase links, verify whether the retailer URL changed or the title is out of
   print — update the seed catalog manually if needed.
3. Review the proposed listing snapshot in the research ledger; do not publish from the job
   output directly.

### Adding or elevating a title

The quarterly job does **not** ingest new titles from PEN bulk data or the open web.

To add or elevate a challenged title:

1. **Research intake** — submit a URL or topic via the research-intake skill / operator CLI.
2. **Case drafting** — assemble claims, evidence, and confidence on a research case.
3. **Publication** — after human review, create or link a publication entity through the normal
   editorial path.

Discovery queries for book-challenge leads live in
[`corsair-web-search-queries.json`](../../packages/config/src/scheduled-jobs/data/corsair-web-search-queries.json)
(`theme: book_challenges`). SERP hits are leads only until captured and reviewed.

## External data registry

PEN America is registered as `pen-america-school-book-bans` in
[`packages/domain/src/external-data-sources.ts`](../../packages/domain/src/external-data-sources.ts).
It remains `registryState: 'disabled'` for bulk CSV ingest until a human rights review clears
redistribution.

## Non-goals

- **No auto-publish** — `publicEffect: 'none'`. Listing changes require human approval.
- **No PEN bulk mirror** — the job validates the curated seed and links; it does not download or
  republish the full PEN America spreadsheet.
- **No entity creation** — challenged titles are not promoted to map entities by this cron.
