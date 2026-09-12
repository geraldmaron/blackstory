# Learning-index entity contract

Every public entity is a **learning node**: a short factual lede, topic tags for
discovery, always a path onward (related records and/or tag/search/explore),
optional longer prose when curated later, and an optional rights-cleared photo.
This document is the editorial and engineering contract for that surface.

## Content roles (do not conflate)

| Field | Required? | Role | Length / rules |
|-------|-----------|------|----------------|
| `summary` | **Yes** at release | Catalog lede, card one-liner, SEO description, search blurb | Editorial band **400–900** characters (Floor v2). Schema still parses from **120** so thin live rows do not 404 mid-campaign. Factual who/what/where/when. Not marketing fluff. Not assembled from claims. Sub-400 only with an explicit best-effort exception after evidence is exhausted. |
| `topicTags` | Strongly preferred (≥1) | Discovery chips → search/explore theme filters | Controlled strings aligned with search theme facets. Empty only with gap honesty. |
| `eraBuckets` / `notabilityLabels` | When present | Secondary chips (ADR-015) | Never numeric scores. |
| `historicalContext` | Strongly preferred | Framing in Black-history place | Not new unsourced facts about this record (those live in `claims`). |
| `extendedNarrative` | Optional | Multi-paragraph further reading | Omit UI section when absent. Never replaces Accepted claims. |
| `primaryImage` | Optional | Hero/aside photo | Requires publishable rights (`public_domain` \| `licensed` \| `fair_use`) and `display_media`. Alt + credit required (WCAG). When missing, UI shows a kind-derived record mark (book/pin/arch), not a stock portrait or mosaic. |
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
- First viewport is an **editorial mast**: rights-cleared photo or kind-derived record mark as a
  media plane beside (desktop) / above (mobile) the name and serif summary — not a dossier
  header with media buried in an aside.
- No rights-cleared photo: show the **record mark** (book / pin / arch by entity kind) — symbolic
  only, never a stock portrait or mosaic. Caption states that a rights-cleared portrait is still
  awaited.
- No extended narrative: **omit** that section entirely.
- Empty related: `RecordGapNotice` plus tag and map CTAs still provide learning paths.
- Empty timeline: **omit** the Chronology section entirely — timeline only appears when dated
  status-history entries or relationship timespans exist.
- Neighbor stubs are denormalized at read time; do not embed full neighbor docs on every projection.
- Listed entity names link quietly via `EntityLink` / `ds-entity-link` (inherit color; underline on hover/focus — not copper pills). Related rails keep `ds-story-link` row anatomy; a short discovery hint invites clicking onward.
- At-a-glance keeps only non-mast facts (evidence count, confidence, coverage, location precision).
- Trust pedagogy on the entity page is a one-line methodology off-ramp — not a full technique banner.
- Connected records are one section (1-hop, then optional 2-hop “Also connected”).

## Rights for entity media

Reuse domain provenance gates (`requiresResolvedRights('media')`,
`PUBLISHABLE_RIGHTS_STATUSES`). Release builders must drop `primaryImage` when
the rights gate fails rather than publishing unclear media.

## Leftover GCS / public-media (photos)

> **Current media path (2026-08-28):** Supabase Storage on `blackstory-app`. The GCS /
> Firestore projection notes below are leftover dual-serve history.

Entity photos are **not** Firebase Storage objects. The Firestore-era promote/clear scripts
that uploaded bytes to the GCP `black-book-efaaf-public-media` bucket and patched a Firestore
projection have been retired with the Firestore wind-down
(`docs/data/firebase-wind-down.md`). The live path is Postgres-only:

| Concern | Convention |
|---------|------------|
| Object path | `public/entities/{entityId}/primary.png` (helper: `entityPrimaryImageObjectPath`), for stored objects in the Supabase `public-media` bucket |
| Projection fields | `primaryImage.url`, `alt`, `credit`, `rightsStatus`, optional `objectPath` / dimensions |
| Write gate | `preparePublicEntityProjectionForWrite` / `sanitizePrimaryImageForRelease` drop incomplete images; requires learning-index `summary` |
| Assign an image | `packages/ops-data/scripts/pin-commons-primary-images.ts` turns a Commons auto-propose plan into `bb_public.release_entities.projection` + `bb_canonical.entity_media` rows |
| Plan inputs | `dry-run-commons-qid-leftover.ts` (people/institutions), `resolve-nrhp-commons-images.ts` (NRHP places) |

```bash
# Dry-run the pin plan (default), then apply with the double guard.
node --conditions development --import tsx \
  packages/ops-data/scripts/pin-commons-primary-images.ts \
  --from=.cache/commons-qid-leftover-dry-run.json \
  --out=.cache/commons-pin-plan.json

set -a && . apps/web/.env.local && set +a
DRY_RUN=0 PIN_COMMONS_APPLY=1 node --conditions development --import tsx \
  packages/ops-data/scripts/pin-commons-primary-images.ts \
  --from=.cache/commons-pin-plan.json --apply --release-id=rel_xxx
```

Commons pins are 960px `Special:FilePath` thumbnail URLs the reader's browser fetches from
Wikimedia at view time; no original bytes are copied. Stored objects served from Supabase
Storage need the object to be publicly readable in the `public-media` bucket.

## Source map

| What | Where |
|------|--------|
| This contract | `docs/ui/learning-index-entity.md` |
| Brand story / voice | `docs/ui/story.md` |
| Domain helpers | `packages/domain/src/learning-index/` |
| Projection schema | `packages/firebase/src/firestore/types.ts` (`publicEntityProjectionSchema`) |
| Entity media paths | `packages/firebase/src/firestore/entity-media.ts` |
| Serialize choke point | `packages/security/src/serialize.ts` |
| Entity page | `apps/web/src/app/entity/[id]/page.tsx` |
| Quiet entity name links | `apps/web/src/components/entity/EntityLink.tsx` (`ds-entity-link`) |
| Catalog → relationships | `packages/domain/src/graph/catalog-related.ts` + `publish-national-catalog.ts` |
| Immutable releases | ADR-004 (removed 2026-07-24; see `docs/decisions-carryover.md` and `docs/runbooks/release-activation-postgres.md`) |
| Public-media bucket matrix | `infra/gcp/storage-buckets.matrix.md` |
