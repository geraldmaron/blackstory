# Capture remediation runbook

Operator workflow for measuring capture completeness on a citation batch and planning bounded
Wayback Save Page Now (SPN) backfill. This script **never auto-publishes** and **does not call
live SPN by default**.

## Prerequisites

- Node.js ≥ 22 with repo dependencies installed (`pnpm install`)
- A citation JSON fixture or export mapped to `CitationForCaptureCompleteness` (see
  [`capture-completeness-ops-bar.md`](./capture-completeness-ops-bar.md))

## Script

```bash
node --conditions development --import tsx scripts/capture-remediation.mjs
node --conditions development --import tsx scripts/capture-remediation.mjs --input path/to/citations.json
node --conditions development --import tsx scripts/capture-remediation.mjs --input path/to/citations.json --submit-spn --limit 20
```

| Flag | Default | Purpose |
|---|---|---|
| `--input <path>` | `scripts/fixtures/capture-remediation-sample-citations.json` | Citation batch (array or `{ citations: [] }`) |
| `--dry-run` | on | Measure only; print `ratio`, `meetsBar`, `missing` |
| `--submit-spn` | off | Plan SPN backfill for missing web citations (still no live calls unless env opt-in) |
| `--limit <n>` | `20` | Max citations in an SPN plan batch |

The evaluator is imported from `packages/domain/src/capture-completeness/` via `tsx`: same rules
as production (`evaluateCaptureCompleteness`, bar ratio **0.95**, offline citations excluded).

### Output fields

- **`ratio`**: share of URL-backed citations with a completed Wayback URL and timestamp
- **`meetsBar`**: whether `ratio` ≥ `CAPTURE_COMPLETENESS_BAR_RATIO`
- **`missing`**: sorted citation ids still lacking completed archive evidence; a content hash alone
  remains missing because it does not make source content recoverable

The evaluator ratio is citation-level. URL inventory and capture-backfill reports are
deduplicated by normalized URL, so repeated citations of one URL count once in those inventory
totals.

### SPN planning cap

When `--submit-spn` is set, the script prints a **would submit** list capped at:

```text
min(--limit, CAPTURE_COMPLETENESS_SOURCE_FETCH_DAILY_CAP)
```

Default `--limit 20` keeps plans bounded. It does not prove request-budget headroom.

Live Wayback calls are **not** implemented in this operator script. Setting
`CAPTURE_REMEDIATION_SPN=1` only reaches a documented stub. Live SPN belongs on
`capture-backfill --commit --wayback` (operator-cli), which uses the domain SPN2 client and
skips when `INTERNET_ARCHIVE_ACCESS_KEY` / `INTERNET_ARCHIVE_SECRET_KEY` are absent.

## Budget integration status

Before scaling SPN backfill, read
[`capture-completeness-ops-bar.md`](./capture-completeness-ops-bar.md) § *Cost and policy controls*
and [`../security/cost-resource-controls.md`](../security/cost-resource-controls.md).

The security package defines `source_fetch` budget policy and `evaluateDailyBudget`, but the live
capture-backfill fetch, availability, submission, and polling calls do not currently charge a
durable counter to it. Do not present those thresholds as enforced for this command.

Operator rules:

1. **Measure first**: run the script (or SQL sketch in the ops bar memo) and record `ratio`,
   `missing`, and ops bar version.
2. **Plan in small batches**: default `--limit 20`. Use `capture-backfill --url` for a reviewed
   citation or its executable 25-URL default; URL count is not a request-count estimate.
   Capture-backfill reports list `failedUrls`; retry those exact normalized URLs with `--url`.
   `--max-entities` is a first-N, non-resumable selection and cannot be combined with
   `--after-url`.
3. **Honor an observed stop**: when an integrated counter reports `disable_source_fetch`, halt SPN
   until its budget window resets. The current command does not produce that signal itself.
4. **Re-measure**: after completed archive pointers are attached, re-run measurement before
   marketing a queryable API surface. A `source_captures` row alone does not enter the numerator.
5. **Keep tiers separate**: after captures are persisted to `evidence.source_captures`, report
   metadata, extracted text, archive availability, and current-revision anchors separately.
6. **Update citation pointers**: only completed archive evidence should update a public citation's
   archive pointer.

Each SPN job typically consumes **multiple** `source_fetch` units (submit + status polls). The
citation count cap is not a 1:1 budget mapping; treat `--limit` as an upper bound on parallel
operator intent, not a guarantee of remaining daily budget.

## Sample fixture

`scripts/fixtures/capture-remediation-sample-citations.json` contains five rows: one completed
Wayback capture, one hash-only metadata record, two other missing web citations, and one offline
citation excluded from the denominator. Expected sample output: `ratio: 0.25`, `meetsBar: false`,
missing `cite-captured-hash`, `cite-missing-bare-id`, and `cite-missing-fake-wayback`.

## Non-goals

- Unreviewed live SPN against production release exports
- Auto-attaching capture pointers without operator review
- Bypassing `@repo/security` daily budget evaluators
- Publishing or activating releases from this script

## Related docs

- [`capture-completeness-ops-bar.md`](./capture-completeness-ops-bar.md): domain evaluator, SQL
  measurement, recommended operator loop
- [`black-history-data-landscape-intake.md`](./black-history-data-landscape-intake.md): corpus
  snapshot and sequencing
- [`../methodology/capture-and-aggregators.md`](../methodology/capture-and-aggregators.md):
  capture narrative and Umbra contrast
