# Black Press newspaper archive discovery

Discovery methodology for digitized Black newspapers — the Chicago Defender, Pittsburgh Courier, Baltimore Afro-American, New York Amsterdam News, and Atlanta Daily World — which documented neighborhood-level Black history (block clubs, church moves, appraisal fights, school-board petitions) at a granularity federal sources miss. Discovery produces **private research candidates only** — never public entities (ADR-009).

## Doctrine: leads, not facts

Research-kernel profile `packages/research-kernel/profiles/black-history.v1.json` maps sourceClass `news-index-summary-or-search-result` → claimClass `historical-assertion` → fitness **`leadOnly`** with the limitation "Capture and assess the underlying evidence before acceptance." Black-press OCR mentions are exactly that source class, so:

- Every candidate is stamped `sourceClass: 'news-index-summary-or-search-result'`, `sourceFitness: 'leadOnly'`, `leadRoute: 'relevance_review'` on its payload.
- Evidence-source classification is the constitution token `news_reportage` — a `LOW_AUTHORITY_SOURCE_TIER` (`relevance/gates.ts`), so leads can never independently reach `include` and are eligible for authority harvest.
- Theme query packs use **only** `historical`/`geographic` term classes (no `positive` class by design), so `classifySignalStrength` yields `weak` / `candidate_only` for every match. An OCR keyword hit never promotes.
- No completeness overclaims: a campaign summarizes what the supplied OCR yielded; absence of a mention is never evidence of absence.

## Invariants

| Invariant | Enforcement |
|-----------|-------------|
| Discovery cannot publish (ADR-009) | `assertCampaignCannotPublish()` at campaign entry; `assertDiscoveryCannotPublish` blocks `write_public_projection` / `create_public_entity` / `activate_release` / `publish_snapshot`; no bb_public / bb_canonical / release write paths anywhere in the module |
| Safe fetch only | `@repo/domain` performs **no network I/O**. OCR bundles are supplied by callers; any live `BlackPressAdapter` implementation MUST fetch exclusively through `@repo/security` safe-fetch |
| Adapter disabled by default | `registerBlackPressSource` ships `registryState: 'disabled'`, `adapterEnabled: false`; campaign approval is run-scoped in-memory only (mirrors `rss-campaign.ts`), never persisted |
| Rights / dignity | Rights default `unknown`; `full_text_republication` and `commercial_reuse` prohibited; OCR text is ephemeral — only evidence-pointer-capped snippets (≤320 chars / ≤60 words) and HTTPS link hints survive onto payloads. HOLC period language (`"colored grade"`) is `researchOnlyOffensive: true`: research recall only, never default public language. Living addresses never public (leads carry archive/issue URLs, not residences) |

## Modules

| Module | Purpose |
|--------|---------|
| `packages/domain/src/adapters/black-press/index.ts` | `BlackPressAdapter` port (`listIssues(outlet, dateRange)`, `extractMentions(issueOcr)`), `SourceAdapterContract` via `createBlackPressAdapterContract`, disabled-by-default `registerBlackPressSource`, snippet-capped mention normalizer, deterministic fixture adapter |
| `packages/domain/src/adapters/black-press/fixtures/black-press-outlets.v1.json` | Seed roster: 5 real outlets with real, verified archive URLs (Google News Archive nids read from the live index; ProQuest Black Newspaper Collection; NYPL Schomburg; Chronicling America as open directory). No fabricated URLs |
| `packages/domain/src/discovery/black-press-campaign.ts` | `runBlackPressCampaign` — theme query packs (`buildQueryPack` reuse), normalize → dedupe → `runDiscoveryCampaign` → weak-lead classification → obscurity ranking → authority harvest. Mirrors `rss-campaign.ts` / `web-search-campaign.ts` shape |
| `packages/domain/src/discovery/black-press-campaign.test.ts` | Inline-fixture tests (no network, no fs): yield, weak classification, obscurity attachment, authority follow-ups, cannot-publish |

## Campaign flow

1. `assertCampaignCannotPublish()` — fail closed before any work.
2. Resolve theme pack (`redlining` default; also `school_segregation`, `civil_rights_organizing`). Redlining terms: `redlining`, `FHA`, `HOLC`, `colored grade` (research-only), `restrictive covenant`, `housing project` — all `historical` class.
3. Extract mentions per issue OCR via `BlackPressAdapter.extractMentions` (default: deterministic paragraph splitter — headline + capped snippet + cited HTTPS URLs).
4. `normalizeBlackPressMentions` — dedupe by stable identifier (`black-press:{outlet}:{issueDate}:p{page}:{headline-slug}`), stamp provenance, cap snippets, keep `outboundLinkHints`.
5. `runDiscoveryCampaign` — boundaries `{ countries: ['US'], adapterIds: ['black-press-v1'] }`, budget 100/40/10/2; content-hash dedupe merges duplicates without losing provenance.
6. Signals classify **weak** (`candidate_only`) by construction; optional relevance partition can park graylist entries.
7. `scoreObscurity` (`obscurity.v1`) on each research-eligible lead; `rankByObscurity` orders the result. Scores are catalog-relative heuristics — never importance/truth claims (`OBSCURITY_METHODOLOGY_DISCLAIMER`).
8. Authority harvest reuses the `harvestAuthorityFollowUpsForCandidate` pattern: articles citing primary archives (loc.gov, archives.gov, nps.gov, …) yield follow-up evidence leads — the newspaper index is the discovery surface; the cited archive is the evidence lead. Ephemeral OCR text is passed per candidate and never persisted.
9. Optional post-rank editorial hook (`CampaignEditorialHook`) — stage-only, never inside ingest, never publishes.

Every ranked lead carries `fitness: 'leadOnly'` and `route: 'relevance_review'`.

## Outlets (fixture `black-press-outlets.v1.json`)

| Outlet | Place | Archive (real, verified) | Access |
|--------|-------|--------------------------|--------|
| The Chicago Defender | Chicago, IL | ProQuest Historical Newspapers: Black Newspaper Collection | subscription |
| The Pittsburgh Courier | Pittsburgh, PA | ProQuest Black Newspaper Collection | subscription |
| The Baltimore Afro-American | Baltimore, MD | Google News Archive (`nid=UBnQDr5gPskC`, 3,623 issues 1902–1992; `nid=ztWeZN2wRXQC` Ledger run) | open |
| The New York Amsterdam News | New York, NY | ProQuest + NYPL Schomburg Center | subscription / onsite |
| The Atlanta Daily World | Atlanta, GA | ProQuest Black Newspaper Collection | subscription |

Chronicling America (`https://chroniclingamerica.loc.gov/`) is listed as an open **directory**; public-domain Black press page scans there are served by the existing first-class `chronicling-america-v1` adapter, not this one.

## Storage & migrations

**No migration needed.** Black-press discovery reuses the existing `evidence_sources` registry shape (`SourceRegistryEntry`) and the `discovery-candidate.v1` schema (`packages/schemas/discovery/discovery-candidate.v1.schema.json`); the adapter payload rides in the existing free-form `payload` field. The assigned migration slot `20260724000002` is intentionally **unused** — reserved but no `20260724000002_*` migration file exists or is required.

## Integration (parent agent applies — barrels NOT edited here)

Per conflict rules, top-level barrels were not touched. To expose the new modules, add:

`packages/domain/src/adapters/index.ts`:

```typescript
// Black Press newspaper archives (leads only, fitness leadOnly) — registered DISABLED.
export * from './black-press/index.js';
```

`packages/domain/src/discovery/index.ts`:

```typescript
export {
  BLACK_PRESS_CAMPAIGN_KIND,
  BLACK_PRESS_THEME_QUERY_TERMS,
  buildBlackPressQueryPack,
  runBlackPressCampaign,
  type BlackPressCampaignTheme,
  type BlackPressRankedLead,
  type BlackPressCampaignResult,
  type RunBlackPressCampaignInput,
} from './black-press-campaign.js';
```

`packages/domain/package.json` test script: append `src/discovery/black-press-campaign.test.ts` to the `--test` file list.

## Deferred (not this bead)

- Live archive clients (must land behind `@repo/security` safe-fetch with per-archive allowlists and honor `registryState`)
- OCR acquisition/quality pipeline (adapter consumes OCR; it does not produce it)
- Firestore persistence of black-press campaign runs
- Automatic `research-intake` commit of authority follow-ups
