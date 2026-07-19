# Candidate discovery pipeline

Contract-layer API for ingesting adapter candidates, extracting signals, deduplicating, and running bounded discovery campaigns. Discovery produces **private research candidates only** — never public entities.

## Domain API (`@repo/domain` → `discovery/`)

Parent agent merges `packages/domain/src/discovery/index.ts` into the package barrel:

```typescript
export * from './discovery/index.js';
```

| Module | Purpose |
|--------|---------|
| `ingestion` | Bulk and API candidate ingestion interfaces |
| `hashing` | Content hashing via provenance `hashUtf8`; reproducibility fingerprint |
| `identity` | Candidate identity keys and source references |
| `geography` | Basic geographic hint extraction from candidate text |
| `signals` | Strong/medium/weak extraction via query-pack `classifySignalStrength` |
| `deduplication` | Merge duplicate records without losing provenance |
| `quarantine` | Retry, quarantine, dead-letter handling; continue-on-quarantine |
| `campaign` | Campaign boundaries and budget enforcement |
| `pipeline` | `runDiscoveryCampaign` orchestration |
| `catalog-match` | Cheap catalog blocking via existing resolver (`propose` / `review` / `no_match`); never silent merge |
| `authority-harvest` | Extract outbound authority-host URLs from low-authority candidates as follow-up leads |
| `guard` | `assertDiscoveryCannotPublish` — blocks public projection writes |
| `campaign-runner` | Shared post-pipeline helpers: survivors, optional relevance/graylist, yield summary, optional editorial hook |
| `rss-campaign` | Generic RSS/Atom discovery (excludes curated ABS by default) |
| `wikimedia-federal-campaign` | Fan-out Wikimedia + federal fixture adapters with per-adapter sub-budgets |
| `archive-dpla-campaign` | Internet Archive + community DPLA v2 only (not federal `dpla-items-v1`) |
| `web-search-campaign` | Brave fixture-first; fails closed without `storageTermsConfirmed` |
| `community-obscurity-campaign` | Curated ABS + obscurity ranking (weekly lane) |

## Reproducibility

Every campaign run:

1. Stamps query-pack version via `stampDiscoveryRun`
2. Records source parser versions from adapter provenance
3. Emits `DiscoveryReproducibilityStamp.fingerprint` for audit replay

## Shared schema

- `packages/schemas/discovery/discovery-candidate.v1.schema.json`

## Python mirror

`workers/research/src/black_book_research/discovery/` mirrors the TypeScript contract for Cloud Run jobs.

## Acceptance mapping

| Requirement | Implementation |
|-------------|----------------|
| Discovery never creates public entities | `assertDiscoveryCannotPublish`; candidates use `discovery-candidate.v1` schema only |
| Duplicate source records merge without losing provenance | `mergeDuplicateCandidates` accumulates `sourceReferences` |
| Failed candidates do not block campaign | `continueOnQuarantine` + per-candidate quarantine in `runDiscoveryCampaign` |
| Reproducible from source + query-pack version | `stampDiscoveryReproducibility` + `stampDiscoveryRun` |
| Cheap catalog blocking without silent merge | `attachCatalogMatch` / optional `catalog` on `runDiscoveryCampaign` |
| Low-authority sources yield authority follow-ups | `harvestAuthorityFollowUpsForCandidate` + RSS `outboundLinkHints` |
| Curated community feeds with extra care | `curated-feeds.ts` / `seedCuratedCommunityFeeds` (ABS seed) |
| Catalog-relative obscurity highlighting | `scoreObscurity` (`obscurity.v1`) + `OBSCURITY_METHODOLOGY_DISCLAIMER` |

## Catalog blocking and authority harvest

Optional inputs on `runDiscoveryCampaign`:

- `catalog` — pass `ResolutionProfile[]` to attach `catalogMatch` on accepted/merged survivors and emit `reviewQueueItems` for ambiguous matches. Uses `resolveEntityCandidate` / `resolutionCandidateFromDiscovery`; never merges into a public entity.
- `authorityHarvest: { enabled: true }` — for low-authority classifications (`community_oral` / `self_published` / `news_reportage`), harvest HTTPS URLs on curated authority hosts (NPS, NMAAHC, LOC, NARA, Wikidata, …) into `authorityFollowUps`. RSS items also carry capped `outboundLinkHints` extracted from feed HTML without storing full article bodies.

## Curated community feeds (extra care)

`packages/domain/src/adapters/rss/curated-feeds.ts` seeds vetted community feeds (currently **The American Blackstory**). Extra-care policy flags require authority harvest, prefer catalog propose-match, snippet-only storage, and `cannotPublishAlone`. Feeds register into the RSS feed registry via `seedCuratedCommunityFeeds` but do **not** auto-approve the RSS adapter policy.

## Obscurity scoring (highlight the obscure)

`packages/domain/src/discovery/obscurity.ts` implements methodology `obscurity.v1`:

\[
S = \mathrm{clip}_{01}\big(w_n N + w_i I + w_r R + w_g G + w_a A + w_d D - w_v V - w_b B\big)
\]

| Symbol | Meaning |
|--------|---------|
| \(N\) | Catalog novelty (`no_match`→1, `review_required`→0.55, proposed→\(1-c\)) |
| \(I\) | Trusted-identifier sparseness \(1 - \min(1, n_{\mathrm{trusted}}/2)\) |
| \(R\) | Smooth IDF name rarity vs a reference catalog-title corpus |
| \(G\) | Geographic specificity (city/region > state > none) |
| \(A\) | Small low-authority discovery boost |
| \(D\) | History-day title framing boost (`Day N — …`) |
| \(V\) | High-visibility name penalty (Rosa Parks, Buffalo Soldiers, …) |
| \(B\) | Brand/commerce title penalty (`Black Bags`, `Vol. N`, …) |

Bands: `common` &lt; 0.35 ≤ `notable` &lt; 0.55 ≤ `obscure` &lt; 0.72 ≤ `highly_obscure`.

Disclaimer: `OBSCURITY_METHODOLOGY_DISCLAIMER` — relative heuristic only; never importance/truth/completeness; never authorizes publication.

## Periodic schedule + operator dry-run

Roster job `community-obscurity-discovery` (`packages/config/src/scheduled-jobs/`) runs weekly (Sundays 10:00 UTC), kill switch `research-campaigns`, `publicEffect: none`, `rosterStatus: real`. The Cloud Scheduler mirror is in `infra/gcp/scheduler/scheduled-jobs.json` (`status: design` — **not applied to GCP until a human apply**).

On-demand (no network; pass a downloaded feed file):

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts community-obscurity-run \
  --feed-xml feed_the_american_blackstory=packages/domain/src/adapters/rss/fixtures/the-american-blackstory.trimmed.rss.xml \
  --catalog-titles "Rosa Parks|Martin Luther King Jr.|Buffalo Soldiers|Harriet Tubman"
```

## Editorial enrichment (LLM stage-only)

After discovery/obscurity yields pending leads, run the editorial judge (mock / OpenRouter /
Ollama). It weeds keep|reject|needs_evidence, drafts `publicSummary` with optional
`[[entityId|Label]]` prose links, suggests related ids (vectors when provided), validates
learning-summary + public-language gates, and stages quarantine packets — **never publishes**.

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts pending-list --from /tmp/obscurity.json
node --conditions development --import tsx packages/operator-cli/src/bin.ts editorial-run \
  --subjects /tmp/subjects.json --provider mock \
  --catalog-from=firestore \
  --operator-id "$USER" --session-id "sess-$(date +%s)" --identity-source cursor_session
```

Embed the public catalog first (Gemini Developer API key required):

```bash
GEMINI_API_KEY=... APP_FIREBASE_ALLOW_PRODUCTION=1 FIREBASE_PROJECT_ID=black-book-efaaf \
  node --conditions development --import tsx \
  packages/firebase/src/embeddings/backfill-cli.ts \
  --source=publicSearchIndex --max-items 600 --max-cost-usd 1
```

Skill: `.claude/skills/black-book/editorial-enrichment/SKILL.md`.

## Deferred (not this bead)

- Firestore persistence for discovery candidates and campaign runs
- Adapter-specific discovery implementations
- Live catalog query wiring (callers supply profiles today)
- Automatic `research-intake` commit of authority follow-ups
- Relevance scoring — see [relevance-engine.md](./relevance-engine.md)
