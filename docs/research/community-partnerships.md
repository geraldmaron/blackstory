# Community Knowledge Holder Partnerships

Proactive human-discovery methodology: reach identified local knowledge holders (county historical societies, local NAACP chapters, Black churches with archives, HBCU faculty) in priority geographic areas with structured submission tooling. Produces **private research leads only** — same evidence gates as adapter discovery, always human-gated, never a publish path (ADR-009).

**This is not crowdsourcing.** Wikipedia-style open contribution accepts prose from anyone and negotiates truth after the fact. This lane inverts that: *we* choose the counties, *we* identify institution-typed knowledge holders, *we* hand them a six-field structured brief, and every submission runs through the same deterministic relevance engine and obscurity methodology as every automated adapter.

## Domain API (`@repo/domain` → `submissions/`)

| Export | Purpose |
|--------|---------|
| `buildCommunityCampaignBrief(county, localHolders)` | Deterministic structured submission guide for one priority county: six intake fields, extra-care policy, contributor privacy notice |
| `scoreCommunitySubmission(submission, options?)` | Mints a private discovery candidate, runs `evaluateCandidateRelevance` + the low-authority include guard + `scoreObscurity`, and routes to `relevance_review` |
| `communitySubmissionToDiscoveryCandidate(submission)` | Candidate minting only (`discovery-candidate.v1`, `ingestMode: 'api'`, `outcome: 'candidate_only'`) |
| `toCommunitySubmissionPayload(submission)` | Composes the api-submissions `SubmissionInput`-shaped payload (`kind: 'contribution'`) for quarantine intake |
| `loadCommunityHolderRegistry()` | Seeded priority-county registry of role-based holder types (`fixtures/community-holder-registry.v1.json`) |
| `COMMUNITY_PARTNERSHIP_CARE_POLICY` | Extra-care flags modeled on the curated-feeds ABS policy |

## The human discovery layer

Adapter discovery (RSS, DPLA, Internet Archive, web search) finds what is already digitized. The community partnership layer targets what is **not**: church minute books, funeral programs, chapter scrapbooks, county vertical files, and living oral memory — attested locally, invisible nationally.

Workflow per priority county:

1. **Select county** — priority geography from research strategy (e.g. movement counties, HBCU-anchored counties) recorded with a `priorityRationale` in the holder registry.
2. **Identify holders by role, not name** — the registry (`community-holder-registry.v1.json`) stores institution *types* only ("County Historical Society", "Local NAACP Chapter", "Black Church Archive", "HBCU Faculty"). Real outreach contacts live in private operator tooling, never in the repo.
3. **Issue the campaign brief** — `buildCommunityCampaignBrief` produces the structured guide: **person name, role, place, year, source citation, oral history ref**. Person/role/place are required; at least one of citation/oral-history ref is enforced at scoring time (evidence before assertion).
4. **Intake through api-submissions** — `toCommunitySubmissionPayload` mirrors the `SubmissionInput` shape used by corrections intake, so submissions flow through the existing quarantine-write-only surface (rate limits, spam scoring, campaign detection) unchanged.
5. **Score with the same gates** — `scoreCommunitySubmission` runs the deterministic relevance engine and obscurity methodology. Low-authority tiers (`community_oral` / `self_published`) get the small obscurity discovery boost — these leads are *exactly* the catalog-novel, thinly-identified material the obscurity lane exists to surface.
6. **Human review, always** — every assessment routes to research-case state `relevance_review` (queue `relevance`). Researchers corroborate against archival/government records before any claim advances.

## How this differs from passive submissions

| | Passive submissions (corrections/contributions) | Community partnerships (this lane) |
|---|---|---|
| Initiation | Inbound, anyone, any topic | Outbound, targeted county campaigns |
| Contributor | Anonymous public | Identified institution-typed knowledge holder |
| Shape | Free-text statement + URL | Six structured fields from the campaign brief |
| Evidence bar | Source URL required | Source citation **or** oral-history reference required; scoring refuses otherwise |
| Scoring | Spam/quarantine heuristics only | Full relevance engine + obscurity methodology, same as adapters |
| Destination | Moderation inbox | `relevance_review` research-case lane with a minted `discovery-candidate.v1` |

## Invariants enforced in code

- **Cannot publish (ADR-009)** — no public projection/release writes anywhere in the module. `cannotPublishAlone: true` is stamped on every brief and assessment.
- **Cannot self-include** — minted candidates carry `signals.outcome: 'candidate_only'`, so `deriveProvisionalDecision` can never return `include`; `enforceLowAuthorityTierCannotIncludeIndependently` is additionally applied, mirroring adapter campaigns.
- **Low-authority tier trust** — holders may only carry `community_oral` / `self_published`; `buildCommunityCampaignBrief` and the registry parser both reject anything else. Oral testimony is honored as a *lead*, never over-weighted as archival proof.
- **Evidence before assertion** — `scoreCommunitySubmission` throws without a citation or oral-history reference.
- **Dignity / living persons** — unknown living status is treated as living (`livingPersonPosture: 'treat_as_living'`); the brief's privacy notice and field guidance forbid submitting living persons' addresses or private contact details.
- **No real people in fixtures** — the registry is role-based placeholders; test submissions use synthetic names.

## Extra-care policy (curated-feeds pattern)

`COMMUNITY_PARTNERSHIP_CARE_POLICY` mirrors `CommunityFeedCarePolicy` (The American Blackstory seed, `packages/domain/src/adapters/rss/curated-feeds.ts`): `quarantineFirst`, `preferCatalogMatch`, `requireCitationOrOralHistoryRef`, `cannotPublishAlone`, `livingPersonProtections`, plus a mandatory `operatorCaution`. `assertCommunityPartnershipCarePolicy` fails closed if any flag is missing.

## Integration (parent-agent merge — not applied by this change)

New self-contained files only; no barrels or shared configs were edited. To wire in:

- `packages/domain/src/index.ts` (top-level barrel), add:

  ```typescript
  export * from './submissions/index.js';
  ```

- `packages/domain/package.json` `"test"` script file list, add:

  ```
  src/submissions/community-campaign.test.ts
  ```

- **Migration** — none shipped: this is contract-layer pure (in-memory, like discovery). When Supabase persistence for community submissions lands, use the reserved timestamp prefix `20260724000008` (e.g. `supabase/migrations/20260724000008_community_partnerships.sql`).

## Files

| File | Purpose |
|------|---------|
| `packages/domain/src/submissions/community-campaign.ts` | Brief builder, candidate minting, scoring, registry parser |
| `packages/domain/src/submissions/index.ts` | Local barrel for the submissions module |
| `packages/domain/src/submissions/fixtures/community-holder-registry.v1.json` | Priority counties × ≥3 role-based holder types |
| `packages/domain/src/submissions/community-campaign.test.ts` | Brief generation, `relevance_review` routing, low-authority obscurity boost, registry shape |

## Deferred (not this change)

- Firestore/Supabase persistence for campaign briefs and submission assessments
- Operator CLI command to print a county brief for outreach packets
- Holder onboarding runbook (private contact handling, consent language for oral histories)
- Linking accepted community leads to `authority-harvest` follow-ups when holders cite digitized sources
