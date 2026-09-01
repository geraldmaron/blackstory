# v10 Place / Entity anatomy

**Status:** binding target for `/place/[slug]`.  
**Parent:** [`../design-direction-v10.md`](../design-direction-v10.md).  
**Protected:** evidence honesty, precision honesty, dignity ([`../PROTECTED-EXPERIENCES.md`](../PROTECTED-EXPERIENCES.md)).

## Current state (source-validated)

| Piece | Today | Gap |
|---|---|---|
| Public URL | `/place/{slug}` (or `{slug}--{id}` on collision) for standable records; `/entity/{id}` for people / non-standable | Constellation + discovery continuity still incomplete |
| Holding set | Search-index slug resolve + point-get; Door pin walks still use stand allowlist | Door Rest stays calm by design |
| Entity route | 308 to Place when `canStandHere`; people and street-precision residences render here | Keep |
| Renderer (Place) | `HomeFirstPaint`: evidence, precision caveat, trust block, Atlas/Records return | RelationshipConstellation visual still open |
| Banned on Place | schema strip, Grade letter strip, precision shop talk | Keep |
| Sections | `EntityRoomSections` + trust + discovery off-ramp | Constellation visual incomplete |
| Neighbors | `RelationshipConstellation` for typed edges; continue-learning separate | Batch public relationship projection still open |
| Discovery return | Atlas/Records with arrival filters; list prev/next when `from=list` | Map-context prev/next still open |

**Critical product gap (closed for resolution):** Place resolves standable release records via the search index + point-get. Door Rest pin walks remain allowlist-only. Remaining Place work is constellation, trust, and discovery continuity, not address coverage.

## Required question sequence

### 1. What is this?

Display name, kind, concise summary, primary authentic media + credit, era/date, location, sensitivity notice.

### 2. Where and when?

Documented geography at honest precision, framed map, jurisdiction if relevant, date/era, precision explanation when coarsened, chronology when it helps.

### 3. What do we actually know?

Distinguish verified facts, claims, estimates, disputes, unknowns, context, derived values. Repeatable claim/evidence anatomy — not equal bullets.

### 4. How do we know?

Evidence Apparatus identical in concept to Methodology: grade/confidence, sources, primary vs secondary, citations, provenance, disagreement, limits.

### 5. Who and what is connected?

Entity Constellation from **typed** edges only (`located_at`, `founded`, `cites`, …). Visual optional; **semantic list required**. Never proximity-as-related.

### 6. Where is this discussed?

Citing stories with title, role if known, era/place, series position. No generic “related content” carousel.

### 7. What else should I investigate?

Nearby (labeled nearby), explicitly related, prev/next in discovery context, collection siblings. Basis stated.

### 8. Can I trust or correct this?

Status, source count, methodology link, correction path, citation/export.

### 9. Persistent discovery state

Preserve Atlas/Records/search/story arrival context: previous/next, return to map/list, filters, scroll restoration where appropriate.

## Visual model components

`PlaceMast`, `PlaceContext`, `ClaimSet`, `EvidenceApparatus`, `RelationshipConstellation`, `DiscoveryContext`.

## Data / cost constraints

- One public place projection for identity + summary + media + geo + status.
- Batch relationship edges (no N+1 point-gets).
- Evidence and citing stories lazy or included in the same projection only if payload stays narrow.
- Do not hydrate full graph on first paint.

## Disposition

**Redesign** Place from thinned walk page → complete Place Record, while keeping Door Rest calm and Memorial untouched.
