# Corsair pending-entity triage plan

Generated: 2026-07-21 (bead acceptance for prioritized triage before bulk research).

Host: `gerald@100.119.72.84` — repo at `~/Developer/Projects/blackstory`.

## Priority order

| # | Lane | Pending | Status |
|---:|---|---:|---|
| 1 | divine-nine | 14 | **Processed** — enrichment run complete; triage list written |
| 2 | negro-leagues | 48 | **Processed** — enrichment run complete; triage list written |
| 3 | confidence-floor | 521 | **Deferred** — manual human verification (`repo-w4bk`) |
| 4 | lynching victims | 515 | **Deferred** — chunks 0–3 enriched; promotion QA not started |
| 5 | gap-fill-remaining | 1273 | **Partially processed** — top-100 prioritized list written |

---

## Lane 1: divine-nine (14 pending)

### Already done (do not re-run enrichment)

| Step | Artifact | Result |
|---|---|---|
| Discovery | `.cache/gap-fill-enrichment/divine-nine-candidates.json` | 16 candidates |
| Enrichment | `.cache/gap-fill-enrichment/divine-nine-run.json` | 16 items: 6 keep, 8 needs_evidence, 2 reject |
| Auto-promote | `.cache/auto-promotion/report-divine-nine-1.json` | 2 promoted, 6 held |
| Staged fixture | `packages/firebase/fixtures/national-catalog/auto-promoted-divine-nine-1.json` | Alpha Kappa Alpha, Vertner Woodson Tandy |

**Promoted (staged, not yet published to prod):**

- Alpha Kappa Alpha (`divine9_org_alpha_kappa_alpha_q3308284`)
- Vertner Woodson Tandy (`divine9_founder_vertner_woodson_tandy_q7922964`)

**Held at confidence floor (6)** — all at 0.72 vs 0.75 threshold, single Wikipedia source:

- Kappa Alpha Psi, Zeta Phi Beta
- Charles Henry Chapman, Eugene Kinckle Jones, Henry Arthur Callis, George Biddle Kelley

**Needs evidence (8 orgs)** — judge sent back for stronger Black-history linkage:

- Alpha Phi Alpha, Omega Psi Phi, Phi Beta Sigma, Sigma Gamma Rho, Iota Phi Theta, Delta Sigma Theta, Alpha Kappa Alpha Sorority (duplicate lane id check), etc.

**Already in catalog (2):** matched by normalized display name — no new stub work.

### Operator next steps

```bash
cd ~/Developer/Projects/blackstory

# 1. Review triage list
jq '.pending[] | {displayName, enrichmentDecision, confidence}' \
  .cache/triage/divine-nine-pending.json

# 2. QA staged fixture, then publish (human gate)
DRY_RUN=1 APP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx \
  packages/firebase/scripts/publish-national-catalog.ts

# 3. After repo-w4bk adds second sources to held keeps, re-promote:
node --conditions development --import tsx \
  packages/firebase/scripts/auto-promote-corsair-keeps.ts \
  --run .cache/gap-fill-enrichment/divine-nine-run.json \
  --subjects .cache/gap-fill-enrichment/divine-nine-subjects-geofixed.json
```

**Defer:** Re-enrichment of `needs_evidence` orgs until operator selects stronger primaries or NPHC Tier-1 corroboration.

---

## Lane 2: negro-leagues (48 pending)

### Already done (do not re-run enrichment)

| Step | Artifact | Result |
|---|---|---|
| Discovery | `.cache/gap-fill-enrichment/negro-leagues-candidates.json` | 52 candidates |
| Enrichment | `.cache/gap-fill-enrichment/negro-leagues-run.json` | 51 items: 43 keep, 5 needs_evidence |
| Auto-promote | `.cache/auto-promotion/report-negro-leagues-1.json` | 4 promoted, 42 held |
| Staged fixture | `packages/firebase/fixtures/national-catalog/auto-promoted-negro-leagues-1.json` | 4 entities |

**Promoted (staged):** Cool Papa Bell, Willard Brown, Andy Cooper, Cuban Giants.

**Held (42):** Predominantly confidence floor (0.72, single source). Notable exceptions:

- Leon Day — missing jurisdiction/location fields
- Bill Foster — no Wikidata coordinates

**Already in catalog (4):** matched by name.

### Operator next steps

```bash
cd ~/Developer/Projects/blackstory

jq '.pending | length' .cache/triage/negro-leagues-pending.json   # expect 48

# QA + publish staged negro-leagues fixture (same publish command as divine-nine)

# Re-promote after second sources (34 negro-leagues rows in confidence-floor master list):
node --conditions development --import tsx \
  packages/firebase/scripts/auto-promote-corsair-keeps.ts \
  --run .cache/gap-fill-enrichment/negro-leagues-run.json \
  --subjects .cache/gap-fill-enrichment/negro-leagues-subjects-geofixed.json
```

**Defer:** Bulk re-enrichment — run JSON already covers the HOF table roster.

---

## Lane 3: confidence-floor (521 pending)

### Process definition (human)

This lane is **not** an overnight enrichment queue. Each record needs a **genuine second independent source** before claims can clear the 0.75 publish confidence bar.

Master list: `.cache/gap-fill-enrichment/confidence-floor-master-list.json` (525 rows).

| Campaign | Rows |
|---|---:|
| officeholders | 348 |
| lynching | 68 |
| western | 57 |
| negro-leagues | 34 |
| plantations | 12 |
| divine-nine | 6 |

**Workflow (`repo-w4bk`):**

1. Operator claims a batch (~28 records) from the master list.
2. Research agent finds a second independent Tier-1 or strong secondary source per record.
3. Apply verified sources back into the campaign `run.json` (or patch subjects).
4. Re-run `auto-promote-corsair-keeps.ts` for that campaign.
5. Human QA → `publish-national-catalog.ts`.

**Do not:** Auto-promote or publish confidence-floor records without second-source verification.

---

## Lane 4: lynching victims (515 pending) — deferred

**Reason for deferral:** Sensitive records require geo/context QA per chunk before promotion. Enrichment has already run across all four chunks; promotion review is the bottleneck, not discovery.

| Chunk | Items | keep | needs_evidence | reject |
|---|---:|---:|---:|---:|
| 0 | 150 | 27 | 120 | 3 |
| 1 | 150 | 58 | 82 | 10 |
| 2 | 150 | 52 | 93 | 5 |
| 3 | 97 | 58 | 35 | 4 |

Paths: `.cache/gap-fill-enrichment/lynching-chunks/run-chunk-{0..3}.json`

### Operator next steps (when ready)

```bash
cd ~/Developer/Projects/blackstory

# Review one chunk at a time — no bulk promote
node --conditions development --import tsx \
  packages/firebase/scripts/auto-promote-corsair-keeps.ts \
  --run .cache/gap-fill-enrichment/lynching-chunks/run-chunk-0.json \
  --subjects .cache/gap-fill-enrichment/lynching-chunks/subjects-chunk-0-geofixed.json
```

Repeat for chunks 1–3 after geo/precision review of keeps.

---

## Lane 5: gap-fill-remaining (1273 pending) — top-100 prioritized

**Do not** enqueue all 1273 stubs. Use the curated list:

`.cache/triage/gap-fill-top-100.json`

| Metric | Value |
|---|---:|
| Pending not in catalog | 1273 |
| Scored eligible | 1179 |
| Excluded (hurricanes/generic/non-entity) | 94 |
| Top batch size | 100 |

**Scoring:** +3 person/org, +5 Tier-1 `candidateSourceHrefs` (.gov/.mil/nps/loc/archives/census/si), +mentions, −2 generic events, hard-exclude hurricane/generic patterns.

**Sample top entries:** 54th Massachusetts Regiment, 38th Infantry, 101 Ranch Wild West Show (all score 10 — Tier-1 citing orgs).

### Operator next steps

```bash
cd ~/Developer/Projects/blackstory

# Wrap top-100 for build-gap-fill-enrichment-subjects.ts
jq '{candidates: .top100}' .cache/triage/gap-fill-top-100.json \
  > .cache/triage/gap-fill-top-100-candidates.json

node --conditions development --import tsx \
  packages/firebase/scripts/build-gap-fill-enrichment-subjects.ts \
  --candidates .cache/triage/gap-fill-top-100-candidates.json \
  --out .cache/gap-fill-enrichment/subjects-top-100.json \
  --max 100 --concurrency 4

# Then run enrichment on Corsair (operator-cli / enrichment session — not overnight auto)
# Example pattern (adjust roster env per Corsair enrichment.env):
# node --conditions development --import tsx packages/operator-cli/src/cli.ts enrichment-run \
#   --subjects .cache/gap-fill-enrichment/subjects-top-100.json \
#   --output .cache/gap-fill-enrichment/run-top-100.json
```

**Defer:** Remaining ~1173 lower-scored gap-fill stubs until top-100 batch yield is reviewed.

---

## Artifact index

| Path (Corsair) | Description |
|---|---|
| `.cache/triage/divine-nine-pending.json` | 14 actionable pending + run/promotion summary |
| `.cache/triage/negro-leagues-pending.json` | 48 actionable pending + run/promotion summary |
| `.cache/triage/gap-fill-top-100.json` | Prioritized next enrichment batch |

## Bead closure

Acceptance met:

- Priority order documented in inventory + this plan.
- High-signal lanes 1–2 processed via existing enrichment JSON (summarized, not re-run).
- Lanes 3–4 explicitly deferred with reasons.
- Lane 5 partially processed (top-100 curated list).
- No auto-promote or publish executed in this triage pass.
