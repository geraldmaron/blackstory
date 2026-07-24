# Oral History Pipeline

A place-connected research-discovery methodology that extracts person/place/event mentions from **oral-history interview transcripts and summaries** — LOC American Folklife Center / Civil Rights History Project, StoryCorps, the UNC Southern Oral History Program, Duke's Behind the Veil, and HBCU collections as they are confirmed. Oral testimony is the richest source of nooks-and-crannies personal/local stories: church mothers, midwives, union stewards, freedom-school teachers who appear in no national database. Discovery produces **private research candidates only** — never public entities (ADR-009).

## Purpose

The research kernel already classifies `first-person-or-oral-history` as fitness **strong** for `lived-experience-or-local-memory` claims (`packages/research-kernel/profiles/black-history.v1.json` → `sourceFitness`), with the explicit limitation that *identity, chronology, coordination, and copying require review* — but no adapter existed for the source class. This pipeline closes that gap: seed collections → list interviews → extract mentions from ephemeral transcript text → run the standard discovery pipeline → rank survivors by catalog-relative obscurity → harvest cited primary-source links as authority follow-ups.

Oral-history subjects score obscure *by construction*: they almost never carry trusted identifiers (wikidata/loc/viaf/…), so `identifierSparseness` boosts them (raw = 1 → full weighted contribution in `obscurity.v1`), and the `community_oral` classification adds the low-authority discovery boost.

## Source registry (`adapters/oral-history/`)

`registerOralHistorySource()` wraps `registerSource` and registers each source **disabled**. It maps the research-kernel `sourceClass: 'first-person-or-oral-history'` marker onto the constitution provenance classification `community_oral` — deliberately a **low-authority tier**: testimony can inform research, boost obscurity, and seed authority harvest, but can never publish alone.

| Element | Value |
|---------|-------|
| Adapter id | `oral-history-v1` |
| Parser version | `oral-history-parser-1.0.0` |
| Stable id scheme | `oral-history-interview-mention` |
| Payload schema | `oral-history-payload.v1` |
| Research-kernel source class | `first-person-or-oral-history` |
| Provenance classification | `community_oral` (low-authority by design) |
| Kill switch | `adapter:oral_history` |
| Rights | `defaultStatus: unknown`; `cite` / `short_excerpt`; prohibits `full_text_republication`, `commercial_reuse`, `biometric_extraction`, `living_person_doxxing` |
| Initial registry state | `disabled` (approval is a separate step) |

`OralHistoryAdapter` is the pluggable harvester contract:

- `listInterviews(collection)` — interview metadata (+ optional **ephemeral** `transcriptText`, never persisted).
- `extractMentions(transcript)` — person/place/event mentions with short context snippets.

Tests inject a deterministic inline adapter. A **live** adapter MUST use `@repo/security` safe-fetch for every request — never raw `fetch`. Forbidden payload keys (`fullTranscript`, `transcriptText`, `audioBytes`, `narratorAddress`, …) are stripped in the normalizer.

### Seed

`adapters/oral-history/fixtures/oral-history-collections.v1.json` seeds four real collections: the **LOC Civil Rights History Project** (loc.gov/collections/civil-rights-history-project/), the **StoryCorps Archive** incl. the Griot Initiative (archive.storycorps.org), the **UNC Southern Oral History Program** collection #4007 (finding-aids.lib.unc.edu/04007/), and Duke's **Behind the Veil** (repository.duke.edu/dc/behindtheveil). URLs are public portals; machine endpoints, transcript access, and per-collection rights must be confirmed per institution (HUMAN STEP) before a live run. HBCU-held collections (Fisk, Texas Southern, Tuskegee) are priority expansion targets.

## Campaign flow (`discovery/oral-history-campaign.ts`)

`runOralHistoryCampaign(opts)` mirrors `county-archive-campaign.ts` / `community-obscurity-campaign.ts`:

1. `assertCampaignCannotPublish()` before any work.
2. For each seeded source: register (disabled) + `approveSourcePolicy` at run time, then `listInterviews(collection)` → `extractMentions(transcript)` → `normalizeOralHistoryMention(...)` (provenance-stamped, snippet-capped, address-precision withheld).
3. Feed records to `runDiscoveryCampaign` (ingestion → signals → deduplication → boundary gate), bounded to `US` and `adapterIds: ['oral-history-v1']`.
4. **Authority harvest on** (`authority-harvest.ts` reuse): primary-source URLs cited in transcripts (loc.gov, nps.gov, archives.gov, …) become `authorityFollowUps` — the interview index is a discovery index, not a fact source. Cited URLs flow via `payload.outboundLinkHints` + `extractCitedUrlHints` over ephemeral transcript text.
5. `listCampaignSurvivors` + `summarizeCampaignYield` (enforces snippet doctrine), then `scoreObscurity` / `rankByObscurity` on survivors.
6. Optional post-rank `editorialHook` (never fetches / persists / publishes).

`loadOralHistoryCollectionSeed()` loads the shipped seed; callers may inject their own `sources`.

## Dignity & living-person handling

- **No trauma hooks or spectacle**: `contextSnippet` is a short research-triage pointer capped by the evidence-pointer limits (320 chars / 60 words), never a transcript dump.
- **Living addresses never public**: `withholdResidentialPrecision` replaces street-address patterns with `[address withheld]` in titles, snippets, and place hints — even on private candidates (fail closed). Place hints stay at city/county/state precision.
- **Unknown living = living**: person mentions default `livingStatus: 'unknown'` and `treatAsLiving: true` unless the archive itself states deceased.
- Narrator names are stored only as published by the archive itself.

## Invariants

- **No publish path.** Research workers cannot publish (ADR-009). No writes to public projections, release tables, or `bb_public` / `bb_canonical`. `assertCampaignCannotPublish()` / `assertDiscoveryCannotPublish` guard the boundary (covered by tests).
- **Safe-fetch only.** Live harvesting uses `@repo/security` safe-fetch; this module is fixture-first and performs no network I/O itself.
- **Evidence before assertion.** Mentions are leads; kernel fitness is strong only for lived-experience claims, and identity/chronology/coordination require review before any claim is asserted. Obscurity is a relative heuristic — never importance/truth, never a publication authorization.
- **No migrations needed.** This methodology is domain-layer only (reserved prefix `20260724000006` unused).

## Integration (wiring for the parent — new files are self-contained; no barrels were edited)

Add these export lines when wiring the methodology in:

```ts
// packages/domain/src/adapters/index.ts
export * from './oral-history/index.js';

// packages/domain/src/discovery/index.ts
export * from './oral-history-campaign.js';
```

And add the test to `packages/domain/package.json` → `scripts.test` file list:

```
src/discovery/oral-history-campaign.test.ts
```

New files:

- `packages/domain/src/adapters/oral-history/index.ts`
- `packages/domain/src/adapters/oral-history/fixtures/oral-history-collections.v1.json`
- `packages/domain/src/discovery/oral-history-campaign.ts`
- `packages/domain/src/discovery/oral-history-campaign.test.ts`
- `docs/research/oral-history-pipeline.md`
