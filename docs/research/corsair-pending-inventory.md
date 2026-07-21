# Corsair pending entities (not yet in production catalog)

Generated: 2026-07-21 from Corsair host inventory vs
`packages/firebase/fixtures/national-catalog` (name + id match).

Triage artifacts (2026-07-21): see `docs/research/corsair-triage-plan.md` and
Corsair `.cache/triage/*.json`.

## Production baselines

| Surface | Count |
|---|---|
| Hosted `bb_canonical.entities` | 666 |
| Hosted `bb_public.release_entities` | 1103 |
| Corsair national-catalog fixture ids/names | 1157 |

## Priority order (operator)

Process lanes in this order — do **not** blind-process the full gap-fill queue.

| Priority | Lane | Pending | Rationale |
|---:|---|---:|---|
| 1 | **divine-nine** | **14** | Smallest, highest-signal NPHC org/founder set; enrichment + first promotion pass already done |
| 2 | **negro-leagues** | **48** | Bounded HOF roster; enrichment + first promotion pass already done |
| 3 | **confidence-floor** | **521** | Manual second-source verification (`repo-w4bk`); blocks honest auto-promote for held keeps |
| 4 | **lynching victims** | **515** | Sensitive; run in chunks with geo/context QA — chunks 0–3 enriched, promotion deferred |
| 5 | **gap-fill-remaining** | **1273** | Largest queue; use `.cache/triage/gap-fill-top-100.json` — not the full 1407 stub set |

**Complete (no pending):** starter subjects (40/40 matched).

## Pending by lane (Corsair)

| Lane | Rows | Pending (not in catalog) | Already matched |
|---|---:|---:|---:|
| gap-fill-remaining | 1407 | **1273** | 134 |
| gap-fill-fixture (staged stubs) | 1589 | **1437** | 152 |
| confidence-floor | 525 | **521** | 4 |
| lynching victims | 547 | **515** | 32 |
| negro-leagues | 52 | **48** | 4 |
| divine-nine | 16 | **14** | 2 |
| starter subjects | 40 | **0** | 40 |

Notes:

- `gap-fill-remaining` and `gap-fill-fixture` heavily overlap; treat remaining as the actionable queue.
- Confidence-floor lane is the manual second-source verification set (`repo-w4bk`), not blind auto-promote.
- Auto-promotion reports on Corsair: 93+ reports, cumulative ~772 promoted / ~3095 held.
- Overnight timer was inactive pending ledger migration (now applied).

## Triage artifacts (Corsair)

| Artifact | Count / scope |
|---|---|
| `.cache/triage/divine-nine-pending.json` | 14 pending (enrichment run + promotion report embedded) |
| `.cache/triage/negro-leagues-pending.json` | 48 pending (enrichment run + promotion report embedded) |
| `.cache/triage/gap-fill-top-100.json` | Top 100 of 1273 pending (Tier-1 href + person/org prioritized; 94 low-value excluded) |

Gap-fill top-100 composition: 54 person, 39 organization, 7 place.

## Authoritative source paths on Corsair

- `.cache/gap-fill-enrichment/candidates-remaining.json`
- `.cache/gap-fill-enrichment/confidence-floor-master-list.json`
- `.cache/gap-fill-enrichment/lynching-victims-candidates.json`
- `.cache/gap-fill-enrichment/lynching-chunks/` (chunk-0…3 subjects + run JSON)
- `.cache/gap-fill-enrichment/negro-leagues-candidates.json`
- `.cache/gap-fill-enrichment/divine-nine-candidates.json`
- `.cache/gap-fill-enrichment/divine-nine-run.json` / `negro-leagues-run.json`
- `packages/firebase/fixtures/discovery-candidates/gap-fill-2026-07-20T01-17-31-097Z.json`
- `.cache/auto-promotion/report-*.json`
- `packages/firebase/fixtures/national-catalog/auto-promoted-divine-nine-1.json` (2 entities, staged)
- `packages/firebase/fixtures/national-catalog/auto-promoted-negro-leagues-1.json` (4 entities, staged)

## Recommended next actions

See `docs/research/corsair-triage-plan.md` for exact operator commands.

1. Review + publish staged divine-nine (2) and negro-leagues (4) auto-promoted fixtures after QA.
2. Route divine-nine (6) + negro-leagues (34) confidence-floor holds through `repo-w4bk` second-source batches.
3. Re-enrich divine-nine `needs_evidence` orgs (8) only after corroboration or stronger primary sources.
4. Continue lynching chunk promotion review (547 enriched across 4 chunks; 515 still not in catalog).
5. Enrich gap-fill top-100 batch — not the remaining 1173 lower-priority stubs.
