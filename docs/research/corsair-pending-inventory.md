# Corsair pending entities (not yet in production catalog)

Generated: 2026-07-21 from Corsair host inventory vs
`packages/firebase/fixtures/national-catalog` (name + id match).

## Production baselines

| Surface | Count |
|---|---|
| Hosted `bb_canonical.entities` | 666 |
| Hosted `bb_public.release_entities` | 1103 |
| Corsair national-catalog fixture ids/names | 1148 |

## Pending by lane (Corsair)

| Lane | Rows | Pending (not in catalog) | Already matched |
|---|---:|---:|---:|
| gap-fill-remaining | 1407 | **1274** | 133 |
| gap-fill-fixture (staged stubs) | 1589 | **1437** | 152 |
| confidence-floor | 525 | **521** | 4 |
| lynching victims | 547 | **515** | 32 |
| negro-leagues | 52 | **48** | 4 |
| divine-nine | 16 | **14** | 2 |
| starter subjects | 40 | **0** | 40 |

Notes:

- `gap-fill-remaining` and `gap-fill-fixture` heavily overlap; treat remaining as the actionable queue.
- Confidence-floor lane is the manual second-source verification set (`repo-w4bk`), not blind auto-promote.
- Auto-promotion reports on Corsair: 93 reports, cumulative ~772 promoted / ~3095 held.
- Overnight timer was inactive pending ledger migration (now applied).

## Authoritative paths on Corsair

- `.cache/gap-fill-enrichment/candidates-remaining.json`
- `.cache/gap-fill-enrichment/confidence-floor-master-list.json`
- `.cache/gap-fill-enrichment/lynching-victims-candidates.json`
- `.cache/gap-fill-enrichment/negro-leagues-candidates.json`
- `.cache/gap-fill-enrichment/divine-nine-candidates.json`
- `packages/firebase/fixtures/discovery-candidates/gap-fill-2026-07-20T01-17-31-097Z.json`
- `.cache/auto-promotion/report-*.json`

## Recommended next actions

1. Prioritize triage of gap-fill remaining (1274) — do not blind-process all 1589 stubs.
2. Run confidence-floor manual verification pass before promote.
3. Finish divine-nine / negro-leagues small batches (high-signal, low volume).
4. Continue lynching victims in chunks with geo/context QA.
