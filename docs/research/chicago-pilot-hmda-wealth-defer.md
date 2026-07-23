<!--
  Chicago metro redlining pilot: explicit defer for HMDA lending aggregates and county wealth
  series on Q3 ThemeImpactPacket. Implements pilot gate 7 (HMDA / wealth gap_states).
-->

# HMDA and wealth — Chicago pilot explicit defer

**Status:** Locked defer for pilot (2026-07-22)  
**Pilot scope:** Theme impact packet `Q3`, theme `redlining`  
**Companion:** [theme-impact-packet-system.md](./theme-impact-packet-system.md) §8 gate 7, [context-data-source-matrix.md](./context-data-source-matrix.md), [theme-impact-canonical-questions.md](./theme-impact-canonical-questions.md)

## 1. Pilot geography

| Field | Value |
|-------|-------|
| Metro scope key | `metro:chicago-il` |
| Cook County FIPS | `17031` |
| Display label | Chicago metropolitan area — Cook County spine |
| Boundary version (county indicators) | `county-2020` |

County-level Phase 1 ACS observations (homeownership, income, poverty, attainment) are loaded
for `17031`. **HMDA lending aggregates** and **county wealth proxies** are **not** ingested for
this pilot.

## 2. Why defer

Three independent constraints block county-level HMDA and wealth on public Q3 packets for
Chicago:

| Constraint | Detail |
|------------|--------|
| **HMDA registry strategy** | `hmda-loan-level` in `EXTERNAL_DATA_SOURCES` is registered as **`aggregate` only** — county+ rollups derived from FFIEC snapshots, not raw loan rows |
| **Public DB posture** | Full HMDA loan-level records **never** enter the public database or anon-facing surfaces; aggregate tables only |
| **Wealth geography** | SCF and SIPP (`fed-survey-consumer-finances`, `census-sipp-wealth`) publish **national** wealth medians only — no county disaggregation exists to load for Cook `17031` |

Registration documents custodian, license, and intended strategy. It is **not** approval to
scrape snapshot files or ingest aggregates during this pilot.

### Prohibited for this pilot

- Do **not** scrape or load HMDA snapshot loan-level files into Postgres (staff or public).
- Do **not** flip `hmda-loan-level` `registryState` to `enabled` without a separate ingestion
  approval.
- Do **not** publish `hmda-denial-rate-black-county`, `hmda-denial-rate-gap-county`, or other
  HMDA-derived observations on anon surfaces until county aggregates are ingested under
  approved workflow with full provenance.
- Do **not** invent county wealth from SCF/SIPP national bulletins — national spine metrics
  remain out of scope for metro-scoped Q3 until a separate national packet is authored.

## 3. Current Q3 gap posture (correct — do not change)

Chicago redlining pilot `Q3` packets carry **`insufficient_evidence`** in `gap_states` because
HMDA lending aggregates and wealth series are absent at Cook County scope. This is **honest and
required** — not a placeholder to backfill with proxy numbers.

| Gap element | Pilot value | Rationale |
|-------------|-------------|-----------|
| `insufficient_evidence` | `true` (Q3) | No county HMDA or wealth observations published |
| `missing_series` (when expanded) | `hmda-denial-rate-black-county`, `hmda-denial-rate-gap-county`, wealth metrics | Proposed Phase 1 bindings; `registryState: disabled` |
| Public artifact | HMDA gap cite artifact only | Labels pending series; no fabricated denial rates |

ACS homeownership, income, poverty, and attainment for `17031` **do** resolve with provenance
quartet. The gap flag applies to the **HMDA / wealth dimensions** of Q3, not to the loaded ACS
indicators.

### Example gap artifact shape (public copy)

Public packets may reference a **gap cite artifact**, not stored lending or wealth values:

```json
{
  "id": "hmda-lending-gap-cook",
  "title": "HMDA lending aggregates (not yet loaded for this pilot)",
  "artifactClass": "scholarly_partner_table",
  "summary": "County-level mortgage denial and origination rates by race are pending approved HMDA aggregate ingestion.",
  "uncertaintyLabel": "Series pending; Q3 gap_states remain insufficient_evidence until county aggregates publish.",
  "provenance": {
    "source": "hmda-loan-level",
    "source_url": "https://ffiec.cfpb.gov/data-browser/",
    "retrieved_at": "2026-07-22T00:00:00Z",
    "content_hash": "sha256:<fixture-or-capture-hash-at-publish>",
    "humanCitation": "Home Mortgage Disclosure Act — aggregate county lending statistics (CFPB / FFIEC). County denial rates not yet published for Cook County in this release."
  }
}
```

**Do not** populate public `observation_refs` from HMDA metrics until observations exist under
an explicit ingestion approval. Until then, list proposed metrics in `gap_states.missing_series`.

## 4. Next ingest (when approved)

When a separate ingestion approval clears HMDA for the Chicago pilot:

1. **Ingest HMDA aggregates at county+ only** — roll up from FFIEC snapshot or data-browser
   exports to `bb_reference.statistical_observations` for `jurisdiction_id` `17031` (and pilot
   peer counties if metro scope expands).
2. **Provenance quartet required** on every observation: `source`, `source_url`, `retrieved_at`,
   `content_hash`, plus `humanCitation`.
3. **Metrics:** `hmda-denial-rate-black-county`, `hmda-denial-rate-gap-county` (derived) per
   [theme-impact-canonical-questions.md](./theme-impact-canonical-questions.md) Phase 1 bindings.
4. **Registry:** keep `hmda-loan-level` strategy **`aggregate`**; loan-level rows stay out of
   public DB permanently.
5. **Packet update:** remove HMDA from `missing_series`, add `observation_refs`, and re-evaluate
   whether `insufficient_evidence` can clear for Q3 (wealth national gap may remain).

Wealth (SCF/SIPP national) is a **separate follow-on** — national spine packet or continued
`insufficient_evidence` on wealth dimensions until product scope defines national vs metro
framing.

## 5. Gate 7 checklist (editorial)

| Check | Pilot posture |
|-------|---------------|
| HMDA loan-level in public DB | **Blocked** — aggregate-only strategy |
| HMDA county aggregates on anon surfaces | **No** — explicit defer |
| County wealth from SCF/SIPP | **No** — national-only sources |
| Q3 `insufficient_evidence` for HMDA / wealth | **Yes** — correct and locked for pilot |
| ACS indicators for Cook `17031` | Loaded with provenance quartet |
| `hmda-loan-level` registry | Remains `disabled`; strategy `aggregate` |

## 6. References

- [FFIEC / CFPB HMDA Data Browser](https://ffiec.cfpb.gov/data-browser/)
- `packages/domain/src/external-data-sources.ts` — `hmda-loan-level`, `fed-survey-consumer-finances`, `census-sipp-wealth`
- [context-data-source-matrix.md](./context-data-source-matrix.md) — strategy legend (`aggregate` vs `store`)
- [theme-impact-canonical-questions.md](./theme-impact-canonical-questions.md) — Q3 metric bindings
- `packages/firebase/fixtures/theme-impact/chicago-redlining-packets.ts` — Q3 pilot fixture with gap artifact
