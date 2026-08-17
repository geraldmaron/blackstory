---
name: blackstory-coverage-target
description: Chooses where research attention should go next from catalog-relative geographic and temporal gaps, obscurity ranking, and the graylist. Use when asking where research should go, which counties or decades are thin, what is under-covered, or how to seed the next discovery campaign.
---

# Coverage target

Judgment playbook for *where to look*, not *what is true*. A thin catalog cell is a research
question. It is never a claim that a community lacks history.

Do not load generic recency-research skills here.

## Which signal

| Question | Method | Code / doc |
|---|---|---|
| Which counties are thin vs documented Black population? | Geographic gap scanner | [`docs/research/geographic-gap-scanner.md`](../../../../docs/research/geographic-gap-scanner.md), `packages/domain/src/discovery/geographic-gap-scanner.ts` |
| Which decades are thin vs this catalog's own average? | Temporal gap | [`docs/research/temporal-gap-discovery.md`](../../../../docs/research/temporal-gap-discovery.md) |
| Of candidates we already found, which are obscure relative to the catalog? | Obscurity ranking | discovery pipeline / community-obscurity |
| What is already parked and weak? | Graylist | [`blackstory-triage-graylist`](../triage-graylist/SKILL.md) |
| Where do federal aggregators miss local micro-records? | County archive ladder | [`docs/research/county-archive-ladder.md`](../../../../docs/research/county-archive-ladder.md) |

Obscurity ranks survivors. The gap scanner decides the next county. They compose: gap-zone
hints raise geographic specificity for candidates found there.

## Honesty stamps

Every gap result carries a methodology disclaimer (`methodology_geographic_gap_heuristic_v1`
or `methodology_temporal_gap_heuristic_v1`):

- Low ratio = *our catalog is thin there*
- Not hidden-history validated
- Not authorization to publish
- Tiny Black-population denominators are excluded (default floor 100)

Temporal `T` is `1 − count(decade) / average`. An all-zero catalog is not "every decade is
maximally thin"; the functions report no relative gap signal.

## After a zone is chosen

1. Seed queries in period-appropriate terms (`buildEraQueryPack`). Public-facing language
   stays modern (`Black`, `African American`). Historical record language
   (`researchOnlyOffensive`) is for internal archival queries only.
2. Operators pick seed URLs. The scanner proposes *places*; it does not scrape the web.
3. Run the research-directive loop: plan → gather → extract → decide
   (`docs/research/research-directive-framework.md`). Decide is
   `stage_for_review` / `hold` / `reject` only.
4. Hand staged briefs to [`blackstory-research-intake`](../research-intake/SKILL.md) or
   [`blackstory-discovery-run`](../discovery-run/SKILL.md). Confirming a pin is
   [`blackstory-entity-verify`](../entity-verify/SKILL.md).

Staff-only coverage view: `bb_ops.coverage_gap_by_county_decade`. Brief helper:
`runGeographicGapCountyBrief` in `packages/operator-cli/src/lib/geographic-gap-brief.ts`.

## Do / Never

**Do:** name the county and decade, quote the disclaimer, keep living-person and residential
precision rules downstream, fetch through DNS-pinned safe-fetch.

**Never:** tell a reader a place "has no Black history"; launch unbounded discovery to chase
a ratio; write `bb_public` from this skill; treat a thin decade as historical
underrepresentation.

## Related

- Empty-quadrant vision: `docs/methodology/empty-quadrant-and-aggregators.md`
- Query packs / era terms: `docs/research/query-packs.md`
