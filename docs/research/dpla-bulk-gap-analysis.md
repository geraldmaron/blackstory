<!--
  One-shot DPLA bulk gap analysis methodology (repo-2ztn, WS8 / repo-2ztn.9).
  Documents how to compare DPLA item metadata against the BlackStory catalog offline,
  identify underrepresented states and decades, and run the same script later against a
  real bulk export on disk. Explicitly not a continuous DPLA mirror or Supabase bulk load.
-->

# DPLA bulk gap analysis (one-shot)

**Purpose:** Offline comparison of DPLA item metadata against the BlackStory catalog to surface **states and decades where DPLA holds material but the corpus is thin or absent**. Informs adapter prioritization and discovery campaigns — not a claim to compete on DPLA scale (see [black-history-data-landscape-intake.md §3.2](./black-history-data-landscape-intake.md#32-rejected-or-rewritten-wrong-on-merits)).

**Date:** 2026-07-21  
**Branch:** `research/data-landscape-capitalization`  
**Epic:** `repo-2ztn` · **Workstream:** WS8 (`repo-2ztn.9`)

---

## 1. What this is (and is not)

| In scope | Out of scope |
|---|---|
| One-shot or periodic **offline** analysis on disk | Continuous DPLA mirror or sync job |
| Fixture-first runs in CI and local dev | Full ~15M-object bulk download in every session |
| Markdown + JSON gap report for research planning | Storing DPLA bulk dumps in Supabase |
| Heuristic state/decade coverage comparison | Point-in-polygon geo joins or live API pagination |

**Sustainability rule:** Treat DPLA bulk exports like any other large research artifact — analyze on a workstation or object store, keep **reports** in git, not the raw dump.

---

## 2. Methodology

The script (`scripts/dpla-gap-analysis.mjs`) loads two JSON inputs:

1. **DPLA items** — array of item records (API search `docs[]` shape or federal export fixture shape).
2. **Corpus entities** — array of catalog entities with `jurisdictionLabel`, `keywords`, and optional `eraBuckets`.

For each side it derives:

| Facet | DPLA extraction | Corpus extraction |
|---|---|---|
| **State** | `spatial.state`, subject/title/provider text, two-letter postal codes | `jurisdictionLabel`, `locationLabel`, `keywords` |
| **Decade** | `sourceResource.date.displayDate`, plain `date`, temporal fields | `eraBuckets` when present |

It then counts items per state, per decade, and per **state×decade** cell. A cell is **underrepresented** when DPLA count > 0 and `corpusCount / dplaCount` falls below the coverage threshold (default **15%**).

This is intentionally coarse — good enough to rank acquisition lanes, not to assert completeness. Unlocated or undated DPLA items are listed in diagnostics rather than silently dropped from totals.

---

## 3. Run the fixture sample (today)

From the repo root:

```bash
node scripts/dpla-gap-analysis.mjs
```

Defaults:

| Input | Path |
|---|---|
| DPLA fixture | `packages/domain/src/adapters/dpla/fixtures/gap-analysis-dpla-sample.json` |
| Corpus fixture | `packages/domain/src/adapters/dpla/fixtures/gap-analysis-corpus-sample.json` |
| Markdown report | `docs/research/dpla-gap-sample-report.md` |
| JSON artifact | `.cache/dpla-gap/report.json` |

Custom paths:

```bash
node scripts/dpla-gap-analysis.mjs \
  --dpla /path/to/dpla-export.json \
  --corpus /path/to/catalog-entities.json \
  --out docs/research/dpla-gap-sample-report.md \
  --json .cache/dpla-gap/report.json \
  --coverage-threshold 0.10
```

The committed sample report demonstrates the output shape; regenerate it after fixture changes.

---

## 4. Run against real DPLA bulk later

### 4.1 Obtain a bulk export (human step)

1. Request or download a DPLA bulk metadata export through [DPLA Pro](https://pro.dp.la/developers) or your institution's agreed channel — **do not** paginate the live v2 API for millions of rows in CI.
2. Store the file **outside Supabase** — e.g. `~/Archive/dpla/` or `.cache/dpla-bulk/` (gitignored).
3. Normalize to a JSON array of items if the vendor ships NDJSON; the script accepts either a top-level array or `{ "docs": [...] }`.

Expected minimum fields per item: `id` (or `stableIdentifier`), title text, and ideally `sourceResource.date` plus `spatial.state` or place-bearing subjects.

### 4.2 Corpus export

Export published entities (or national-catalog fixtures) with at least:

- `jurisdictionLabel` or `locationLabel`
- `keywords`
- `eraBuckets` when decade coverage matters

Example source for a full run: `packages/firebase/fixtures/national-catalog/*.json` merged into one array (script does not merge directories automatically — concatenate or point `--corpus` at a single export file).

### 4.3 Execute and archive

```bash
node scripts/dpla-gap-analysis.mjs \
  --dpla ~/Archive/dpla/dpla-items-YYYY-MM.json \
  --corpus .cache/blackstory-catalog-export.json \
  --out docs/research/dpla-gap-report-YYYY-MM.md \
  --json .cache/dpla-gap/report-YYYY-MM.json
```

Commit **only** the markdown summary and methodology notes unless the owner explicitly wants a redacted JSON artifact in git. Keep raw DPLA bulk on disk or cold storage.

---

## 5. Disk budget (Supabase Pro 8 GB)

From [supabase-pro-cost-envelope.md §2](./supabase-pro-cost-envelope.md#2-disk-and-egress-headroom-live-corpus):

- Each Supabase Pro project includes **8 GB database disk**.
- Live corpus today is **~260 MB** — ample headroom for embeddings and captures.
- A full DPLA metadata dump can be **multiple GB** on disk and must **never** be loaded into Postgres as a mirror table.

**Operational default:** Analyze bulk exports on the workstation; store gap **reports** under `docs/research/` and optional machine-readable summaries under `.cache/dpla-gap/`. If long-term retention of a bulk slice is needed, use object storage or an external drive — not `bb_canonical` or Supabase Storage for the full dump.

---

## 6. Interpreting results

Priority lanes typically show up as:

1. **States with DPLA depth and zero or near-zero corpus entities** — e.g. Deep South states in the sample fixture where DPLA has Reconstruction and Rosenwald material but the corpus fixture only covers Mid-Atlantic schools.
2. **Decades with DPLA signal and sparse `eraBuckets`** — e.g. 1870s–1910s church and labor records.
3. **State×decade cells** — finer-grained targets for discovery campaigns or NRHP/Chronicling America cross-walks.

Follow-up work stays in existing pipelines: fixture-first adapters, discovery campaigns, and research cases — not a standing DPLA ETL job.

---

## 7. Related docs and code

| Resource | Role |
|---|---|
| `scripts/dpla-gap-analysis.mjs` | Offline analyzer |
| `packages/domain/src/adapters/dpla/fixtures/gap-analysis-*.json` | Tiny demonstration fixtures |
| `docs/research/dpla-gap-sample-report.md` | Generated sample output |
| `.cache/dpla-gap/report.json` | Machine-readable sample (regenerated) |
| [federal-adapters.md](./federal-adapters.md) | Federal DPLA fixture adapter |
| [discovery-pipeline.md](./discovery-pipeline.md) | Live DPLA v2 discovery (separate from bulk gap) |
| [supabase-pro-cost-envelope.md](./supabase-pro-cost-envelope.md) | Disk/egress guardrails |

---

## 8. Acceptance mapping

| Criterion | Location |
|---|---|
| Script compares sample DPLA + corpus, reports underrepresented states/eras | `scripts/dpla-gap-analysis.mjs` |
| Doc for one-shot real bulk run + Pro 8 GB disk note | This file §4–§5 |
| Sample output artifact | `docs/research/dpla-gap-sample-report.md` (+ `.cache/dpla-gap/report.json`) |
| No continuous sync, no Supabase bulk store | §1, §5 |
