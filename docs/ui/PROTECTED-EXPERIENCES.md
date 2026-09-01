# Protected Experiences Register

**Status:** binding (2026-08-31).  
**Authority:** overrides aesthetic modernization, visual-model preference, and route template normalization.  
**Branch verified against:** `cursor/v10-modernization` (door tip + staging merge).

These constraints are non-negotiable for BlackStory v10 and later. Implementation cleanup is allowed only when the rendered experience remains materially equivalent.

---

## P-01 Memorial wall (immutable experience)

**Route:** `/memorial`  
**Primary implementation:**

- `apps/web/src/app/memorial/page.tsx`
- `apps/web/src/components/patterns/memorial-wall/MemorialWallAtmosphere.tsx`
- `apps/web/src/app/memorial/MemorialScrollCue.tsx`
- `apps/web/src/app/memorial/MemorialSections.tsx`
- `apps/web/src/app/memorial/MemorialListContrastZone.tsx`

**Immutable visible experience:**

| Element | Rule |
|---|---|
| Handwritten names wall | Must remain the opening atmosphere |
| `MemorialWallAtmosphere` | Must remain the background layer |
| Quiet opening composition | Bare kicker/title; no stacked lede/prose cluttering the wall |
| Scroll invitation/cue | Keyboard-reachable quiet link into the accessible list |
| Accessible names list | Must remain below the fold as the non-canvas path |
| Dignity framing | Names stay names; national memorial, not a join from a place record |
| No gamification | No scores, streaks, unlocks |
| No score-like statistics | No counters as spectacle |
| No harm imagery | No depictions of violence |

**Forbidden redesigns:**

- Generic Room-card normalization of the opening wall
- Replacing the handwritten wall with a standard list-first page
- Discovery widgets, animated map chrome, or engagement mechanics over the wall
- Turning names into map pins
- Decorative animation for novelty
- Making the wall “more interactive” without a verified a11y/perf defect

**Allowed:** implementation cleanup, contrast fixes, performance fixes, and accessibility corrections that preserve perceptual and semantic equivalence.

---

## P-02 Evidence honesty

Never visually imply a relationship the source material does not establish.

| Forbidden implication | Required treatment |
|---|---|
| Same location ⇒ historically related | Label proximity as nearby only |
| Overlapping dates ⇒ causality | Require typed causal edges (`caused`, `enabled`, …) |
| Jurisdictional law coverage ⇒ record caused by law | Preserve law reference without manufactured joins |
| Same collection membership ⇒ connected people | Require explicit relationship rows |
| Algorithmic similarity ⇒ evidence | Never present as historical edge |
| Geographic proximity ⇒ relationship | Distinct from `related` |

Every shown edge must have a semantic basis (`bb_canonical.entity_relationships.relationship_type` or an equivalently typed public projection). Different strengths/types must not look identical when the data distinguishes them.

---

## P-03 Geographic precision honesty

Never map a record more precisely than its evidence allows.

State / county / city / neighborhood / broad-site documentation must not render as an artificial street-level point. If visualization coarsens or approximates, say so in the UI.

---

## P-04 Dignity constraints (violence-adjacent material)

Motion may explain geography, sequence, context, and scale. It may not dramatize harm.

**Forbidden:** aggressive push-ins, pulsing, shake, alarm animation, sensational heatmaps, “crime map” language, gamification, harm-density ranking, person-spotlight spectacle.

---

## P-05 Public access

Core public functionality must remain useful without an account:

- reading, discovery, citations
- basic local saving where reasonable
- map exploration, methodology, evidence, public records

Do not gate these behind authentication to imitate SaaS products.

---

## P-06 Brand integrity

Respect the BlackStory brand kit (`brand/`, `docs/ui/brand.md`).

**Forbidden:** reconstructing official marks from type, arbitrary recolor of approved artwork, fake lockups, trendy gradients, glassmorphism, glows/neon, ornamental 3D chrome.

Visual richness comes primarily from historical material and information, not decoration.

---

## Change control

Amendments to this register require an explicit owner decision. Accessibility or performance defects may be fixed without amending the register when equivalence is preserved and verified on the real Memorial surface.
