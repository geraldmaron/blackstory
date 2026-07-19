# UGC compliance and living-person ethics layer

Cross-cutting policy infrastructure for the crowdsource/UGC discovery lane ( RSS/Internet
Archive/DPLA,  Reddit,  web-search/Common Crawl,  community submissions). None
of those adapters exist yet — this bead builds the compliance layer they plug into, once, and
enforces it fail-closed. Implementation lives under `packages/domain/src/rights/`.

## 1. Per-source obligations registry

`packages/domain/src/rights/obligations.ts` extends the  rights model
(`packages/domain/src/provenance/rights.ts`, `source.ts`) with per-source-class obligations, and
mirrors the  adapter registry's fail-closed pattern exactly
(`packages/domain/src/adapters/registry.ts`, `gates.ts`): `getSourceObligationsOrThrow` /
`assertAdapterHasObligations` throw when a source has no registered entry. An adapter cannot run
without both an approved  registry entry *and* a registered  obligations entry.

`defaultSourceObligationsSeed()` seeds:

| Source | Deletion sync | Republication | ML training | Storage-rights tier | Attribution | Liveness re-check |
|---|---|---|---|---|---|---|
| Reddit | Required, ≤48h, contractual | Prohibited | Prohibited | — | Required | Every 7 days |
| Brave Search | — | Prohibited | Allowed | Required | Required | — |
| Exa Search | — | Prohibited | Allowed | Required | Required | — |
| RSS | — | Allowed | Allowed | — | Required | Every 30 days |
| Internet Archive | — | Allowed | Allowed | — | Required | Every 90 days |
| DPLA | — | Allowed | Allowed | — | Required | Every 90 days |

Reddit's deletion-sync obligation is contractual (Reddit's API/developer terms), not a
privacy-law inference — see `ugc-legal-posture.md` for why that distinction matters.

## 2. Evidence-pointer doctrine

`packages/domain/src/rights/evidence-pointer.ts` encodes the strongest available fair-use
posture as a type/schema constraint, not a comment. `EvidencePointer` has no field that can hold
page bytes/markup; `assertEvidencePointerValid` fails closed on:

- a missing or non-`https` `sourceUrl` (the doctrine always links out);
- a `snippet` over **320 characters or 60 words** — the concrete cap chosen for "1-2 sentences,
  the minimum needed to judge relevance" (`MAX_EVIDENCE_SNIPPET_CHARACTERS` /
  `MAX_EVIDENCE_SNIPPET_WORDS`);
- a missing or non-Wayback `waybackCaptureUrl` (must resolve to an `archive.org` host).

`assertNoFullPageFields` additionally rejects payloads carrying full-page-shaped keys (`html`,
`bodyHtml`, `fullText`, etc.) before they ever reach an `EvidencePointer`. Research basis: Field
v. Google and Google Books precedents protect indexing and minimal excerpts that do not
substitute for the original work; full-page preservation is delegated to the Internet
Archive/Wayback Machine rather than self-hosted.

## 3. Deletion-sync framework

`packages/domain/src/rights/deletion-sync.ts` is a pure, scheduler-agnostic module —
`planDeletionSyncPurge` takes a `DeletionSyncRequest` (source id, reason, correlation id,
cascade targets) and returns a plan; `applyDeletionSyncPurge` executes it against any store
exposing `delete(path)`. Cascade targets cover `quarantine`, `graylist`, and
`research_case_attachment` kinds. Either a future scheduled job or a manual operator
invocation can call the same two functions.

The plan's `record` (`DeletionSyncRecord`) captures the **fact** of deletion — source id,
timestamp, reason, correlation id, and target references — and never the deleted content
itself. The plan's `auditEvent`/`outboxMessage` are shaped as `DomainAuditEvent` /
`DomainOutboxMessage` (, `packages/domain/src/audit/index.ts`) using the new
`deletion.purged` audit action, so a storage adapter can hand them straight to the existing
`commitWithAudit` path (`packages/firebase/src/firestore/audit-outbox.ts`) the same way every
other audited mutation in this repo does.

**Known integration gap:** `packages/firebase`'s current `StateMutation` union only supports
`create`/`set`/`update`, not a true `delete`. Wiring a real Firestore purge through
`commitWithAudit` needs that added — out of scope for this bead (packages/firebase is read-only
context here) and flagged for whoever builds the  scheduler integration or the –076
adapters.

## 4. Living-person UGC ethics rules

Constitution: `packages/schemas/constitution/policy.v1.json` gains `ugcLivingPersonRules`
(mirrored in `product-constitution.schema.json` and the Zod schema in
`packages/schemas/src/constitution/schema.ts`), following the exact pattern  used to add
`sensitivityRules`: additive fields, `policyVersion` stays `"1.0.0"`, JSON Schema
`additionalProperties: false` + `required` and Zod `.strict()` keep the TS/JSON/Python readers
in sync structurally (any drift fails the existing loader tests in
`packages/schemas/src/constitution.test.ts` and
`packages/constitution/src/black_book_constitution/test_constitution.py`, both extended for
this bead rather than duplicated).

`packages/domain/src/rights/living-person-ugc.ts` implements the three rules:

- **No cross-source aggregation into profiles** — `assertNoCrossSourceProfileAggregation`
  rejects merging the same living-person personal-detail field from more than one source.
  **Mechanical enforcement caveat:** this only catches aggregation routed through the function;
  a write path that never calls it is invisible to this guard. Full prevention is an
  architectural constraint enforced by code review, not something a single runtime check can
  guarantee — documented here rather than overclaimed.
- **Elevated verification threshold** — `assertUgcLivingPersonClaimMayAdvance` maps UGC-derived
  claims about a living (or unknown, treated-as-living) person onto the constitution's existing
  `claimConfidenceThresholds.highImpactPublish` tier (**0.9**, already used by /'s
  confidence engine for outsized-consequence claims). Decision: reuse the existing tier instead
  of adding a parallel threshold, since living-person UGC claims are exactly that category.
- **Deanonymization prohibited everywhere** — `assertNoDeanonymization` fails closed on any
  action tagged as targeting a pseudonymous/anonymous UGC subject, mirroring
  `assertPublicProjectionSafe`'s fail-closed pattern (`packages/security/src/serialize.ts`).
  The pattern is reproduced rather than imported because `@repo/security` depends on
  `@repo/domain` — the reverse import would be circular.

## 5. Public takedown/contest routing

`packages/domain/src/rights/takedown.ts` is the routing/data-model piece only.
 (Correction and challenge experience) is a separate, not-yet-built bead that owns the
actual public-facing takedown page — nothing here renders UI.

`buildTakedownRequestRecord` produces a `TakedownRequestRecord` structurally compatible with
's submission intake (`packages/security/src/submissions/quarantine.ts`
`SubmissionInput`: `targetRecordId`/`statement`/`sourceUrls`/`requestorContact`), tagged with
`distinctTag: 'takedown'` and bridged onto 's closest existing `SubmissionKind`
(`'abuse_report'`) pending a native `'takedown'` kind, which is /'s call. Domain
cannot import `@repo/security` for the same circular-dependency reason as above, so the
bridge is structural, not a direct call.

SLA fields (documented, not yet operationally enforced by a scheduler):

- **Acknowledgement**: 72 hours (`TAKEDOWN_ACKNOWLEDGEMENT_SLA_HOURS`).
- **Resolution**: 30 days (`TAKEDOWN_RESOLUTION_SLA_DAYS`).

Privacy/harassment takedowns concerning a living (or unknown-status) subject are flagged
`elevatedPriority: true`.

## Validation

```bash
pnpm --filter @repo/domain test
pnpm --filter @repo/domain typecheck
pnpm --filter @repo/schemas test
pnpm --filter @repo/schemas typecheck
cd packages/constitution && uv run pytest
```

See also [`ugc-legal-posture.md`](./ugc-legal-posture.md) for the CCPA/CPRA and fair-use legal
ground truth this layer is built against.
