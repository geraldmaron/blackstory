# Learning-index entity contract

Every public entity is a **learning node**: a short factual lede, topic tags for
discovery, always a path onward (related records and/or tag/search/explore),
optional longer prose when curated later, and an optional rights-cleared photo.
This document is the editorial and engineering contract for that surface.

## Content roles (do not conflate)

| Field | Required? | Role | Length / rules |
|-------|-----------|------|----------------|
| `summary` | **Yes** at release | Catalog lede, card one-liner, SEO description, search blurb | Target **120–280** characters; hard max **400**. Factual who/what/where/when. Not marketing fluff. Not assembled from claims. |
| `topicTags` | Strongly preferred (≥1) | Discovery chips → search/explore theme filters | Controlled strings aligned with search theme facets. Empty only with gap honesty. |
| `eraBuckets` / `notabilityLabels` | When present | Secondary chips (ADR-015) | Never numeric scores. |
| `historicalContext` | Strongly preferred | Framing in Black-history place | Not new unsourced facts about this record (those live in `claims`). |
| `extendedNarrative` | Optional | Multi-paragraph further reading | Omit UI section when absent. Never replaces Accepted claims. |
| `primaryImage` | Optional | Hero/aside photo | Requires publishable rights (`public_domain` \| `licensed` \| `fair_use`) and `display_media`. Alt + credit required (WCAG). Omit entirely when missing — no stock placeholders. |
| `related` (1-hop) | Strongly preferred | Typed graph edges on the projection | Stored on release; adjacency is single-hop by design. |
| Continue learning (2-hop) | Read-time only | “Also connected” | Server-composed from neighbors’ related IDs; capped; never stored on the projection. |
| `claims` / facts | Sourced detail | Atomic cited statements | Claims are the evidence layer; summary is the index lede. |

## Public revision vs audit

Public pages show thin **release provenance** (`releaseId`, `generatedAt`,
`recordUpdatedAt`) and lifecycle **`statusHistory`** where applicable — not a
Wikipedia-style field edit log. Corrections ship as **new immutable releases**
(ADR-004). Internal `auditEvents` can reconstruct publication/correction/
retraction history for operators; that trail is not the learning-index UI.

## UI sparsity (honesty over fake richness)

- Sparse entity: summary + tags + why-appears + gap notices is OK.
- No photo / no extended narrative: **omit** those sections entirely.
- Empty related: `RecordGapNotice` plus tag and map CTAs still provide learning paths.
- Neighbor stubs are denormalized at read time; do not embed full neighbor docs on every projection.

## Rights for entity media

Reuse domain provenance gates (`requiresResolvedRights('media')`,
`PUBLISHABLE_RIGHTS_STATUSES`). Release builders must drop `primaryImage` when
the rights gate fails rather than publishing unclear media.

## Source map

| What | Where |
|------|--------|
| This contract | `docs/ui/learning-index-entity.md` |
| Brand story / voice | `docs/ui/story.md` |
| Domain helpers | `packages/domain/src/learning-index/` |
| Projection schema | `packages/firebase/src/firestore/types.ts` (`publicEntityProjectionSchema`) |
| Serialize choke point | `packages/security/src/serialize.ts` |
| Entity page | `apps/web/src/app/entity/[id]/page.tsx` |
| Immutable releases | `docs/adr/ADR-004-public-projection-immutable-snapshots.md` |
