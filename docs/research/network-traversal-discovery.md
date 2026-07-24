# Network Traversal Discovery

A catalog-seeded research-discovery methodology for BlackStory. Start from a **known** canonical
entity, read its relationships from `bb_canonical.entity_relationships`, and for every related
entity that is **not already in the catalog** (catalog-match `no_match`), emit a private discovery
candidate carrying the relationship context that surfaced it.

Historical networks are dense. Every organization has local chapter leaders; every court case has
plaintiffs, defendants, and attorneys; every movement has organizers who never became famous. The
neighborhood of a cataloged entity is therefore a high-yield, low-noise seam for finding the
thinly attested people and places that a keyword-first crawl misses.

> Discovery produces **private research candidates only** — never public entities (ADR-009).
> A relationship edge is a **lead**, not a claim: evidence before assertion.

## Where it lives

`packages/domain/src/discovery/network-traversal.ts` — a new self-contained module in the
discovery contract layer. It reuses `resolution/resolveEntityCandidate` for catalog blocking and
`discovery/obscurity.scoreObscurity` for catalog-relative ranking, mirroring the shape of
`community-obscurity-campaign.ts`.

## Public surface

| Export | Kind | Purpose |
|--------|------|---------|
| `extractRelationshipTargets(entityId, relationships)` | PURE | Neighbor descriptor (name + identifiers + predicate + direction) for each edge that involves the seed |
| `resolutionCandidateFromTarget(target)` | PURE | Project a traversal target into a `ResolutionCandidate` |
| `catalogMatchFnFromProfiles(profiles, context?)` | factory | Build a `NetworkCatalogMatchFn` backed by `resolveEntityCandidate` (propose / review / no_match — never a silent merge) |
| `classifyNetworkTargets(targets, catalogMatchFn)` | PURE | Attach the resolver outcome + rationale to each target |
| `resolveUnknownTargets(targets, catalogMatchFn)` | PURE | Filter to `no_match` neighbors — the leads worth a campaign |
| `buildNetworkDiscoveryCandidates(unknownTargets, context)` | PURE | `DiscoveryCandidateRecord[]` with `networkContext` embedded in each payload |
| `networkContextOf(candidate)` | PURE | Read the embedded relationship context back off a candidate |
| `runNetworkTraversalCampaign(opts)` | orchestration | read → extract → classify → keep unknowns → build → score obscurity → ranked summary |

Types: `NetworkRelationshipRecord`, `NetworkRelationshipTargetDescriptor`,
`NetworkTraversalTarget`, `NetworkTraversalContext`, `NetworkTargetClassification`,
`NetworkCatalogMatchFn`, `BuildNetworkCandidatesContext`, `NetworkTraversalRankedLead`,
`RunNetworkTraversalCampaignInput`, `NetworkTraversalCampaignResult`.

Constants: `NETWORK_TRAVERSAL_CAMPAIGN_KIND` (`network-traversal.v1`),
`NETWORK_TRAVERSAL_ADAPTER_ID`, `NETWORK_TRAVERSAL_PARSER_VERSION`,
`NETWORK_TRAVERSAL_CLASSIFICATION`.

## Pipeline

```
seed entity id
  → readRelationships(seedId)            (injected; no I/O in this module)
  → extractRelationshipTargets           neighbors + predicate + direction
  → classifyNetworkTargets               resolveEntityCandidate per neighbor
      ├─ proposed_match  → already cataloged (counted, dropped)
      ├─ review_required → ambiguous       (counted, dropped)
      └─ no_match        → resolveUnknownTargets → keep
  → buildNetworkDiscoveryCandidates      private discovery-candidate.v1 + networkContext
  → scoreObscurity + rankByObscurity     catalog-relative, with disclaimer
  → NetworkTraversalCampaignResult
```

`direction` records which side of the edge the seed sits on: `outbound` when the seed is
`from_entity_id`, `inbound` when the seed is `to_entity_id`. Both directions are traversed, so a
person who is `member_of` a cataloged org and an org that a cataloged person `founded` are both
reachable.

## Invariants honored

- **Discovery cannot publish (ADR-009).** `runNetworkTraversalCampaign` asserts the publish guard
  (`assertDiscoveryCannotPublish`) at its boundary, and every emitted record is
  `discovery-candidate.v1`. No public projection or release table is ever written.
- **No I/O in the module.** Relationships are supplied by the caller or an injected
  `readRelationships` reader (fixtures in tests; a `@repo/security` safe-fetch / Supabase client in
  production). The pure functions are deterministic and side-effect free. Reads target
  `bb_canonical.entity_relationships`, which is staff-select-only (see `20260720220010_rls_policies`).
- **Evidence before assertion; dignity.** Candidates are leads with the originating predicate as
  provenance; the obscurity score is a relative heuristic carrying
  `OBSCURITY_METHODOLOGY_DISCLAIMER` (never importance, truth, or completeness).
- **Living addresses never public.** Traversal emits private candidates only; residential
  precision is never rendered, and unknown living status is treated as living downstream.
- **Bounded fan-out.** `maxCandidates` caps the neighbors turned into candidates per run.

## Predicates

Neighbor edges use the `black-history.v1` profile `relationshipPredicates` /
`queryPacks.relationships` vocabulary: `served_as`, `located_at`, `succeeded`, `challenged_law`,
`participated_in`, `funded_by`, `founded`, `member_of`, `published`, `occurred_at`. The predicate
is preserved verbatim on each candidate so a reviewer can see *why* the lead surfaced.

## Integration (barrel export lines for the parent agent)

This module is self-contained and does **not** edit any barrel. The parent agent should add the
following block to `packages/domain/src/discovery/index.ts`:

```typescript
export {
  NETWORK_TRAVERSAL_CAMPAIGN_KIND,
  NETWORK_TRAVERSAL_ADAPTER_ID,
  NETWORK_TRAVERSAL_PARSER_VERSION,
  NETWORK_TRAVERSAL_CLASSIFICATION,
  extractRelationshipTargets,
  resolutionCandidateFromTarget,
  catalogMatchFnFromProfiles,
  classifyNetworkTargets,
  resolveUnknownTargets,
  buildNetworkDiscoveryCandidates,
  networkContextOf,
  runNetworkTraversalCampaign,
  type NetworkTraversalDirection,
  type NetworkRelationshipTargetDescriptor,
  type NetworkRelationshipRecord,
  type NetworkTraversalTarget,
  type NetworkTraversalContext,
  type NetworkCatalogMatchFn,
  type NetworkTargetClassification,
  type BuildNetworkCandidatesContext,
  type NetworkTraversalRankedLead,
  type RunNetworkTraversalCampaignInput,
  type NetworkTraversalCampaignResult,
} from './network-traversal.js';
```

The package barrel already re-exports the discovery surface via `export * from './discovery/index.js';`
(see [discovery-pipeline.md](./discovery-pipeline.md)), so no `packages/domain/src/index.ts` edit
is required beyond the discovery barrel line above.

To run the new test alongside the others, add
`src/discovery/network-traversal.test.ts` to the `test` script file list in
`packages/domain/package.json`.

## Migration

No schema change is required. Traversal reads the existing `bb_canonical.entity_relationships`
table (created in `20260720220006_canonical_entities_claims`, indexed by `from_entity_id` /
`to_entity_id` in `20260720220011_indexes`) and writes only private discovery candidates. If a
future pass adds a persisted network-traversal run receipt, reserve migration prefix
**`20260724000004`** for it.

## Deferred (not this pass)

- Live `bb_canonical.entity_relationships` reader wiring (callers inject `readRelationships` today).
- Multi-hop traversal (current pass is one hop from the seed; `relationshipHops` budget in
  `black-history.v1` allows 3–4 for a later pass).
- Firestore/Supabase persistence of network candidates and run receipts.
- Feeding unknown neighbors into a downstream `runDiscoveryCampaign` for full adapter capture.
