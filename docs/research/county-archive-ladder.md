# County Archive Ladder

A place-connected research-discovery methodology that harvests Black-history micro-records from **county and state historical-society finding aids** (EAD/XML + OAI-PMH). Local archives hold micro-histories — local NAACP founders, neighborhood business owners, church leaders, county-level school-desegregation plaintiffs — that are absent from federal aggregator databases. Discovery produces **private research candidates only** — never public entities (ADR-009).

## Purpose

Federal aggregators (DPLA, Internet Archive, Chronicling America) skew toward nationally digitized material. State/county archives describe their holdings in EAD finding aids and expose them over OAI-PMH, but rarely surface in national search. The County Archive Ladder "climbs" each archive: list collections for a jurisdiction → extract component-level candidates from each finding aid → run them through the standard discovery pipeline → rank survivors by catalog-relative obscurity.

Records here are a `scholarly` source class in the research kernel (`packages/research-kernel/profiles/black-history.v1.json` → `sourceFitness` `scholarly` = fitness `strong`). We store **metadata, canonical finding-aid URLs, and capped scope-and-content snippets only** — never bulk OCR or full container-list text.

## Source registry (`adapters/finding-aid/`)

`registerFindingAidSource()` wraps `registerSource` and registers each archive **disabled**. It maps the research-kernel `sourceClass: 'scholarly'` marker onto the constitution provenance classification `primary_archival` (finding aids describe primary archival holdings).

| Element | Value |
|---------|-------|
| Adapter id | `finding-aid-v1` |
| Parser version | `finding-aid-parser-1.0.0` |
| Stable id scheme | `finding-aid-ead-id` |
| Payload schema | `finding-aid-payload.v1` |
| Research-kernel source class | `scholarly` |
| Provenance classification | `primary_archival` |
| Kill switch | `adapter:finding_aid` |
| Rights | `defaultStatus: unknown`; `cite` / `short_excerpt`; prohibits `full_text_republication`, `commercial_reuse`, `biometric_extraction` |
| Initial registry state | `disabled` (approval is a separate step) |

`FindingAidAdapter` is the pluggable harvester contract:

- `listCollections(state)` — collections a jurisdiction exposes.
- `extractCandidates(collection)` — component/series/item descriptions from a finding aid.

Tests inject a deterministic inline adapter. A **live** adapter MUST use `@repo/security` safe-fetch for every EAD/OAI request — never raw `fetch`. Forbidden payload keys (`fullText`, `ocrText`, `containerListText`, …) are stripped in the normalizer.

### Seed

`adapters/finding-aid/fixtures/state-archive-seed.v1.json` seeds ≥3 real state historical societies (Alabama Dept. of Archives and History, Georgia Archives, Mississippi Dept. of Archives and History, plus South Carolina and North Carolina). URLs are public institution portals; machine OAI-PMH endpoints must be confirmed per-institution (HUMAN STEP) before a live run.

## Campaign flow (`discovery/county-archive-campaign.ts`)

`runCountyArchiveCampaign(opts)` mirrors `community-obscurity-campaign.ts` / `archive-dpla-campaign.ts`:

1. `assertCampaignCannotPublish()` before any work.
2. For each seeded source: register (disabled) + `approveSourcePolicy` at run time, then `listCollections(state)` → `extractCandidates(collection)` → `normalizeFindingAidCandidate(...)` (provenance-stamped, snippet-capped).
3. Feed records to `runDiscoveryCampaign` (ingestion → signals → deduplication → boundary gate), bounded to `US` and `adapterIds: ['finding-aid-v1']`.
4. `listCampaignSurvivors` + `summarizeCampaignYield` (standard campaign-runner yield summary; enforces snippet doctrine).
5. Score survivors with `scoreObscurity` and `rankByObscurity`.
6. Optional post-rank `editorialHook` (never fetches / persists / publishes).

`loadStateArchiveSeed()` loads the shipped seed; callers may inject their own `sources`.

## Obscurity integration

Reuses `discovery/obscurity.ts` (`obscurity.v1`) unchanged. Each survivor gets an `ObscurityAssessment` (score, band, weighted factor breakdown) attached to its ranked lead, with `OBSCURITY_METHODOLOGY_DISCLAIMER`. Obscurity is a relative, catalog-conditioned heuristic — never importance/truth/completeness, and never authorizes publication.

## Invariants

- **No publish path.** Research workers cannot publish (ADR-009). No writes to public projections, release tables, or `bb_public` / `bb_canonical`. `assertCampaignCannotPublish()` / `assertDiscoveryCannotPublish` guard the boundary.
- **Anonymous clients never write canonical history.**
- **Safe-fetch only.** Live harvesting uses `@repo/security` safe-fetch; this module is fixture-first and performs no network I/O itself.
- **Evidence before assertion; no completeness overclaims.** Metadata + pointers + capped snippets only; no bulk OCR / full text.
- **Dignity.** No crime-heat / alarm-color rendering.
- **Living addresses never public; unknown living = living.** Finding-aid harvest carries no residential precision.
- Sources register **disabled**; approval is explicit.

## Storage

Sources use the existing `bb_evidence.evidence_sources` registry — **no new migration is required** (assigned prefix `20260724000001` is intentionally unused). Candidates are private `discovery-candidate.v1` records.

## Integration (barrel export lines for the parent agent)

These are **new, self-contained files**. The parent agent adds the following export lines (this bead does not edit any barrel):

`packages/domain/src/adapters/index.ts`:

```typescript
export * from './finding-aid/index.js';
```

`packages/domain/src/discovery/index.ts`:

```typescript
export {
  COUNTY_ARCHIVE_CAMPAIGN_KIND,
  loadStateArchiveSeed,
  runCountyArchiveCampaign,
  type CountyArchiveRankedLead,
  type CountyArchiveCampaignResult,
  type RunCountyArchiveCampaignInput,
} from './county-archive-campaign.js';
```

## Deferred (not this bead)

- Live safe-fetch-backed `FindingAidAdapter` implementation (EAD/XML + OAI-PMH parsing).
- Per-institution OAI-PMH endpoint confirmation.
- Scheduled roster job + operator CLI wiring.
- Firestore persistence for finding-aid candidates.
