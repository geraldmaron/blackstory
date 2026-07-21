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
| `--dry-run` | on | Measure only — print `ratio`, `meetsBar`, `missing` |
| `--submit-spn` | off | Plan SPN backfill for missing web citations (still no live calls unless env opt-in) |
| `--limit <n>` | `20` | Max citations in an SPN plan batch |

The evaluator is imported from `packages/domain/src/capture-completeness/` via `tsx` — same rules
as production (`evaluateCaptureCompleteness`, bar ratio **0.95**, offline citations excluded).

### Output fields

- **`ratio`** — share of URL-backed citations with archived capture evidence
- **`meetsBar`** — whether `ratio` ≥ `CAPTURE_COMPLETENESS_BAR_RATIO`
- **`missing`** — sorted citation ids still lacking Wayback URL or content hash evidence

### SPN planning cap

When `--submit-spn` is set, the script prints a **would submit** list capped at:

```text
min(--limit, CAPTURE_COMPLETENESS_SOURCE_FETCH_DAILY_CAP)
```

Default `--limit 20` keeps batches conservative. Raise only after reviewing budget headroom.

Live Wayback calls are **not** implemented in this operator script. Setting
`CAPTURE_REMEDIATION_SPN=1` only reaches a documented stub — route real captures through
`captureUrlToEvidencePointer` and operator review (see ops bar memo).

## Budget and soft shutdown

Before scaling SPN backfill, read
[`capture-completeness-ops-bar.md`](./capture-completeness-ops-bar.md) § *Budgeted SPN backfill
guidance* and [`../security/cost-resource-controls.md`](../security/cost-resource-controls.md).

| Threshold | `source_fetch` requests / day |
|---|---|
| Soft shutdown (80%) | **1,600** |
| Hard stop (100%) | **2,000** (`CAPTURE_COMPLETENESS_SOURCE_FETCH_DAILY_CAP`) |

**Operator rules:**

1. **Measure first** — run the script (or SQL sketch in the ops bar memo) and record `ratio`,
   `missing`, and ops bar version.
2. **Plan in small batches** — default `--limit 20`; avoid planning more than ~**1,500**
   `source_fetch` units per day so link-health sweeps and discovery adapters retain headroom
   below soft shutdown.
3. **Stop at soft shutdown** — when `evaluateDailyBudget` reports pressure at 80%, halt new SPN
   work unless an operator explicitly overrides.
4. **Hard stop** — when `disable_source_fetch` is active, halt all SPN until the next UTC budget
   window.
5. **Re-measure** — after captures are persisted to `bb_evidence.source_captures` and citation
   pointers updated, re-run measurement before marketing a queryable API surface.

Each SPN job typically consumes **multiple** `source_fetch` units (submit + status polls). The
citation count cap is not a 1:1 budget mapping — treat `--limit` as an upper bound on parallel
operator intent, not a guarantee of remaining daily budget.

## Sample fixture

`scripts/fixtures/capture-remediation-sample-citations.json` — five rows covering captured Wayback,
content-hash capture, two missing web citations, and one offline citation excluded from the
denominator. Expected sample output: `ratio: 0.5`, `meetsBar: false`, missing
`cite-missing-bare-id` and `cite-missing-fake-wayback`.

## Non-goals

- Unbounded live SPN against production release exports
- Auto-attaching capture pointers without operator review
- Bypassing `@repo/security` daily budget evaluators
- Publishing or activating releases from this script

## Related docs

- [`capture-completeness-ops-bar.md`](./capture-completeness-ops-bar.md) — domain evaluator, SQL
  measurement, recommended operator loop
- [`black-history-data-landscape-intake.md`](./black-history-data-landscape-intake.md) — corpus
  snapshot and sequencing
- [`../methodology/capture-and-aggregators.md`](../methodology/capture-and-aggregators.md) —
  capture narrative and Umbra contrast
