# Source registry and adapter contract

Contract-layer API for registering source adapters, approving policies, and gating research runs. The pure registry interface is independent of storage. Postgres adapters own persisted research state.

**Context indicators (statistics lane):** Pre-ingestion metadata for demographics/context datasets lives in [`external-data-sources.ts`](../../packages/domain/src/external-data-sources.ts) and the ranked theme matrix in [`context-data-source-matrix.md`](context-data-source-matrix.md) — not in `registerSource`.

## Domain API (`@repo/domain` → `adapters/`)

Parent agent merges `packages/domain/src/adapters/index.ts` into the package barrel.

| Function | Purpose |
|----------|---------|
| `registerSource` | Register adapter contract + evidence source (starts `disabled`) |
| `approveSourcePolicy` | Approve or canary-enable a registered source |
| `listSourceEntries` / `getSourceEntry` | Query registry |
| `assertAdapterMayRun` | Fail-closed gate before any adapter run |
| `evaluateRunHealth` | Quarantine on record-count or schema drift |
| `stampCandidateProvenance` | Attach source + parser provenance to candidates |
| `validateAdapterCandidates` | Validate adapter output against shared schema version |

## Registry states

| State | May run? | Notes |
|-------|----------|-------|
| `disabled` | No | Default after registration |
| `approved` | Yes | Requires `approvedAt` / `approvedBy` |
| `canary` | Yes (sampled) | Use `selectCanaryRecordIndices` |
| `quarantined` | No | Set after drift detection |
| `dead_letter` | No | Repeated quarantine threshold |

## Shared schema

JSON Schema fixture: `packages/schemas/adapters/candidate-record.v1.schema.json`

Domain validation enforces the same shape via `ADAPTER_CANDIDATE_SCHEMA_VERSION` (`candidate-record.v1`).

## Python mirror

`workers/research/src/black_book_research/adapters/` mirrors the TypeScript contract for Cloud Run jobs.

## Deferred (not this bead)

- **Admin registry UI** —  Administration and research console
- **HTTP admin API** — register/approve endpoints on admin service
- **Telemetry alerts** — parser drift metrics recorded here; alerting in

## Acceptance mapping

1. No adapter runs without approved policy → `assertAdapterMayRun`
2. Unexpected record-count / schema changes quarantine → `evaluateRunHealth`
3. Adapter output validates against shared schemas → `validateAdapterCandidates` + JSON schema fixture
4. Every candidate retains source and parser provenance → `stampCandidateProvenance` / `AdapterCandidateProvenance`

## Source library

One living registry of the publishers BlackStory cites. Each publisher carries a profile a person
or agent wrote from pages they opened, and every count is computed at read time from what the
active release publishes. Nothing about usage is stored.

Migrations: `supabase/migrations/20260914120000_source_library.sql` (columns, functions, views)
and `20260914130000_source_library_set_based_host_resolution.sql` (faster host resolution).

### Publisher record

`evidence.source_organizations` is the publisher. Profile columns:

| Column | Meaning |
|---|---|
| `parent_organization_id` | Umbrella publisher (Chronicling America under the Library of Congress). Display only; counts do not roll up through it. |
| `merged_into_organization_id` | Non-destructive merge. The merged row keeps its domains and evidence sources, and the library reports them under the survivor. Keep chains acyclic. |
| `publisher_kind` | `government_archive`, `government_agency`, `court_legal`, `academic_library_archive`, `museum`, `encyclopedia_reference`, `news_media`, `nonprofit_heritage`, `wiki_crowd`, `commercial_database`, `other` |
| `tier` | `tier1`, `tier2`, `tier3` (rule below) |
| `summary` | Who publishes it and what it holds |
| `relevance` | What BlackStory records cite it for |
| `limitations` | Known gaps a researcher should weigh |
| `profile_sources` | The URLs actually opened to write the profile |
| `profile_reviewed_at`, `profile_reviewed_by` | Set only when every statement in the profile traces to `profile_sources`. A profile written partly from secondhand material stays unreviewed. |

### Tier rule

Tiers follow the repo's classifier, not intuition:

- `tier1`: what `packages/ops-data/scripts/lib/tier1-sources.ts` classes as Tier 1 (government,
  courts, official archives).
- `tier2`: reputable institutional secondary, including the curated reputable-secondary hosts in
  that file.
- `tier3`: crowd-edited, aggregator, commercial, blog, or a host the classifier does not know.
  Wikipedia is tier3 here because it may carry a claim but never corroborate one
  (`.claude/skills/blackstory/claim-corroborate/SKILL.md`). An unknown host in tier3 is a gap in
  the classifier, not a quality finding; fix it in `tier1-sources.ts`, not in the profile.

### Host resolution

A citation host is the lowercase hostname of `citationHref` with port, userinfo, a trailing dot
and a leading `www.` removed (`evidence.citation_host`). It resolves to a publisher by the
longest `evidence.source_domains.hostname` that equals the host or is a parent domain of it
(both www-stripped). On a tie the bare hostname wins, then the lower organization id. The result
follows `merged_into_organization_id` to the survivor. `evidence.resolve_citation_host_organization(host)`
does this for one host; `published_citations` does the same thing as one join and must agree
with it.

Add a domain row for a subdomain only when it is a different publisher or collection from its
parent. `npgallery.nps.gov` is the National Register, not a park page, so it has its own row.

A row for a broad parent domain catches every subdomain that lacks its own row. State portals are
the sharp case: `nc.gov`, `ri.gov`, `wa.gov` and `nv.gov` have rows because records cite those
hosts directly, so a new citation from a state agency on one of those domains resolves to the
state portal instead of appearing in `source_library_unmapped_hosts`. When you add a record citing
a state agency, check that its host has its own row. The same applies to multi-tenant platforms
(`wordpress.com`, `archive.org` mirrors): give each distinct publisher its own row.

### Relevance by evidence use

`evidence.source_policies.organization_id` ties a policy to a publisher. Its
`source_policy_claim_fitness` rows use `claim_class` as an evidence use:
`identity_and_life_dates`, `location_and_address`, `designation_and_listing`,
`legal_and_court_record`, `event_narrative`, `superlative_or_first`, `direct_quotation`,
`statistics`. Fitness is `authoritative`, `strong`, `conditional`, `lead_only`, or `unfit`.

### Views

All four are `security_invoker`, revoked from `anon`, and return nothing to an `authenticated`
caller who is not staff. Service role and the direct Postgres connection the admin app and
operator scripts use see everything.

- `evidence.published_citations`: one row per claim in the active release, with host and
  resolved `organization_id` (NULL when unmapped).
- `evidence.source_library`: one row per surviving publisher with its profile, `hosts`,
  `published_entities`, `published_claims`, `canonical_entities` (reached through the evidence
  chain), `evidence_sources`, `source_items`, and `merged_organization_ids`.
- `evidence.source_library_unmapped_hosts`: published hosts with no publisher. This is the
  work queue.
- `evidence.source_library_fitness`: evidence-use fitness per publisher, current policy
  version only.

Invariant: `sum(source_library.published_claims) + sum(source_library_unmapped_hosts.published_claims)`
equals the active release's claim count. If it does not, look for a merge cycle.

### Admin

`/admin/sources` lists the library and the unmapped hosts. `/admin/sources/<organizationId>`
shows one publisher's profile, fitness, hosts, and the published records citing it.

### Keeping it accurate

1. When a host appears in `source_library_unmapped_hosts`, add a `source_domains` row pointing at
   an existing publisher, or create the publisher first.
2. When two rows are the same publisher, set `merged_into_organization_id` on the smaller one.
   Never delete.
3. When writing a profile, state only what opened pages say, list them in `profile_sources`, and
   set the review fields only if that held for every statement.
4. Never store a count. If a number is needed, query the views.
