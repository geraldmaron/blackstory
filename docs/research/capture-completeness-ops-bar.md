# Capture completeness ops bar

BlackStory's publish gates require archived capture pointers on web citations before a fact or
claim may reach a public release. Production posture (queried 2026-07-21) still lags that
architecture: **4** rows in `bb_evidence.source_captures` against **1,103** rows in
`bb_public.release_entities`. This memo defines how operators measure capture completeness, when
the corpus is ready to market a queryable developer surface, and how to backfill under bounded
Save Page Now (SPN) budgets.

## Domain evaluator

`packages/domain/src/capture-completeness/` exposes:

| Export | Role |
|---|---|
| `CAPTURE_COMPLETENESS_BAR_RATIO` | Ops threshold — **0.95** (95% of web citations must carry archived capture) |
| `CAPTURE_COMPLETENESS_OPS_BAR_VERSION` | Wire token for dashboards / preflight logs |
| `evaluateCaptureCompleteness(citations)` | Returns `{ ratio, meetsBar, missing[] }` |

**Denominator:** URL-backed citations only (`location.kind === 'url'`). Offline archive
designations are excluded — they follow a different evidence path.

**Numerator:** a web citation counts as captured when its `capture` pointer includes either:

- a valid `waybackCaptureUrl` on an `archive.org` / `web.archive.org` host, or
- a content-addressed hash (`contentHash`) indicating a row in `bb_evidence.source_captures`.

Pure in-memory measurement — the evaluator never triggers SPN or mutates records.

## Production measurement (SQL sketch)

Run against the active release. Adjust JSON paths if the release manifest citation shape shifts.

```sql
-- Active release id
WITH active AS (
  SELECT release_id
  FROM bb_public.active_release
  WHERE id = 'active'
),
-- Flatten web citations from release entity claims (manifest-dependent JSON shape)
web_citations AS (
  SELECT
    re.entity_id,
    cite ->> 'id' AS citation_id,
    cite -> 'location' ->> 'kind' AS location_kind,
    cite -> 'capture' ->> 'captureId' AS capture_id,
    cite -> 'capture' ->> 'waybackCaptureUrl' AS wayback_url,
    cite -> 'capture' -> 'contentHash' ->> 'digest' AS content_hash_digest
  FROM bb_public.release_entities re
  CROSS JOIN LATERAL jsonb_array_elements(re.claims) AS claim
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(claim -> 'citations', '[]'::jsonb)
  ) AS cite
  WHERE re.release_id = (SELECT release_id FROM active)
),
web_only AS (
  SELECT *
  FROM web_citations
  WHERE location_kind = 'url'
),
captured AS (
  SELECT wc.*
  FROM web_only wc
  WHERE (
    wayback_url ~* '^https://(web\\.)?archive\\.org/'
  )
  OR (
    content_hash_digest IS NOT NULL
    AND content_hash_digest <> ''
  )
  OR EXISTS (
    SELECT 1
    FROM bb_evidence.source_captures sc
    WHERE sc.id = wc.capture_id
  )
)
SELECT
  (SELECT count(*) FROM web_only) AS web_citation_total,
  (SELECT count(*) FROM captured) AS web_citation_captured,
  CASE
    WHEN (SELECT count(*) FROM web_only) = 0 THEN 1.0
    ELSE round(
      (SELECT count(*)::numeric FROM captured)
      / (SELECT count(*)::numeric FROM web_only),
      4
    )
  END AS capture_ratio,
  (SELECT count(*) FROM bb_evidence.source_captures) AS source_captures_rows;
```

**Interpretation:** compare `capture_ratio` to `CAPTURE_COMPLETENESS_BAR_RATIO` (0.95). Until
`meetsBar` is true, hold PostgREST / developer-surface marketing (see landscape intake §3–§4).

For in-process preflight (TypeScript release builders), map release citations to
`CitationForCaptureCompleteness` and call `evaluateCaptureCompleteness` directly — same bar,
same `missing` list for operator queues.

## Budgeted SPN backfill guidance

Wayback SPN gates already exist in `packages/domain/src/adapters/internet-archive/wayback/`
(`capture-gate.ts`). **Do not run unbounded SPN fan-out** against production URLs.

### Daily budget (`source_fetch`)

From `@repo/security` `DEFAULT_DAILY_BUDGETS`:

| Threshold | Requests / day |
|---|---|
| Soft shutdown (80%) | 1,600 |
| Hard stop (100%) | 2,000 |

Each SPN job typically consumes **multiple** `source_fetch` units (submit + status polls). Plan
backfill in **batches of hundreds, not thousands**, and stop at soft shutdown unless an operator
explicitly overrides.

### Recommended operator loop

1. **Measure** — run the SQL sketch (or `evaluateCaptureCompleteness` on the release citation
   batch). Record `ratio`, `missing`, and `CAPTURE_COMPLETENESS_OPS_BAR_VERSION`.
2. **Prioritize** — rank `missing` citations on published / corrected entities first; defer draft
   and research-only URLs.
3. **Budget** — allocate ≤ **1,500** `source_fetch` requests per day for SPN backfill (leaves
   headroom below soft shutdown for link-health sweeps and discovery adapters).
4. **Capture** — route through the existing Wayback capture gate (`captureUrlToEvidencePointer`);
   persist rows to `bb_evidence.source_captures` and attach `waybackCaptureUrl` on the citation
   capture pointer. Never fabricate pointers when SPN fails closed.
5. **Re-measure** — repeat until `meetsBar` or the remaining gaps are documented blockers (robots,
   paywall, 404 at capture time).
6. **Stop** — when `evaluateDailyBudget` reports `disable_source_fetch`, halt SPN entirely until
   the next UTC budget window.

### Non-goals

- Live apply / unbounded SPN against the full 1,103-entity corpus in one run
- Bypassing `packages/security` budget evaluators
- Treating structural citation completeness (captureId present) as ops-bar completeness without
  Wayback or stored hash evidence

## Related docs

- `docs/methodology/capture-and-aggregators.md` — Umbra contrast and public narrative
- `docs/research/black-history-data-landscape-intake.md` — live corpus snapshot and sequencing
- `docs/security/cost-resource-controls.md` — `source_fetch` automated responses
- `packages/domain/src/facts/publish-gate.ts` — per-fact fail-closed publish gate
- `packages/domain/src/citations/completeness-gate.ts` — per-claim projection gate
