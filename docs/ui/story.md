# Brand story, voice, and site narrative

This is the narrative platform every BlackStory surface draws from — home,
map, entity pages, methodology, about, corrections. If a page's copy isn't
traceable to this document, it's ad hoc and should be rewritten to match.

## The thesis

**Black history is everywhere.** Not a handful of famous incidents in a
handful of famous cities — a continuous, documented presence across every
state, county, and neighborhood in the country. The product's job is to
make that presence *visible and verifiable at once*: show how much is
here, and for every single thing shown, show the receipts.

That pairing — presence *and* proof — is the whole design brief. A site
that only proves (a dense archive with no way to see the shape of the
whole) undersells the thesis. A site that only shows presence (a map with
no evidence underneath) is a claim, not an archive. Every major surface
does both: the map proves scale, the entity page proves the individual
record, the methodology page proves the process.

## What the site is

An **archive of record with receipts.** Every fact traces to evidence:
source, capture, confidence, and — when evidence conflicts — the conflict
itself, preserved rather than resolved by fiat. This is not a
crowdsourced trivia site and not a raw research dump; it's the layer
between the two, where only claims that clear the evidence bar get a
public page.

Concretely, that means:

- **Presence over incident.** The default unit is "this place/person/
  institution is documented here," not "this bad thing happened here."
  Crime and tragedy are part of the historical record where they belong,
  but they are never the organizing lens — see `docs/security/threat-model.md`
  and the constitution's `sensitivityRules` for why crime statistics never
  enter the composite confidence score.
- **Confidence is never color-only.** Every confidence level and dispute
  flag carries a text cue alongside any color, because color-only
  signaling fails colorblind readers and fails screenshots/print.
- **Disputes stay visible.** When credible sources disagree, both values
  stay on the record instead of one "winning." Erasure of minority
  evidence is a bug, not a simplification.
- **Living-person protection is load-bearing, not decorative.** Street-
  level residence never appears on a public map or page, unknown living
  status is treated as living, and this is stated plainly to readers, not
  buried in a privacy policy.

## Who it serves

Readers, educators, journalists, and community researchers who need
**accountable** place history — not anonymous scrapes, not unverifiable
timelines, not a wiki anyone can silently rewrite. The persona is someone
who trusts nothing by default and wants the tool to make trust
*checkable* rather than asking for it.

## Emotional register

**Proud, precise, unflinching — never trauma-forward.** Concretely:

- Proud: the presence of Black history everywhere is stated as fact, not
  hedged or apologized for.
- Precise: claims are exact about what is and isn't known; "unknown" is a
  legitimate, stated answer, not a gap papered over.
- Unflinching: hard history (violence, dispossession, injustice) is not
  softened or euphemized when it's the documented record.
- Never trauma-forward: hard history is never the *default lens* or the
  *hook*. A place's page leads with what's documented about the place —
  people, institutions, events across time — not with the worst thing
  that happened there. See "Why this appears" for how the product
  explains *why* a record surfaced, which is the mechanism that keeps a
  search from feeling like it's fishing for tragedy.

This register comes directly from the design precedents already guiding
the visual system (`docs/ui/brand.md`): EJI's practice of narrative
off-ramps (data is never terminal — there's always a next place to go),
Mapping Police Violence's published-methodology-as-trust-surface, and
Native Land's presence rendering.

## Homepage narrative arc

**Map-led (current):** the homepage opens on the national map already
populated — "everywhere" proven visually before a word is read — then
offers paths into Explore, Search, and featured entity records. Brand and
thesis copy sit as support chrome over the map; the map is the proof.

## Methodology and About as brand surfaces

Transparency is not legal boilerplate here — it's a brand element, the
same way a citation chip or a confidence badge is. `/methodology` and
`/about` should read like the rest of the product (same voice, same
citation/confidence components where relevant), not like a separate
"legal" register. The existing copy on both pages already follows this —
short declarative sections, no hedging, methodology sections built from
the actual `Citation`/`Confidence`/`Notice` components rather than prose
describing them. Keep extending both pages this way as new capabilities
ship (e.g., link-rot handling from  gets a methodology section when
it lands, not just a runbook entry).

## Editorial voice guide

**Register:** short declarative sentences first, structure second. State
facts plainly; don't hedge unless the hedge is the fact ("unknown" is a
real, complete answer). No marketing superlatives ("groundbreaking,"
"revolutionary," "the definitive source").

**Microcopy standards:**

| Context | Rule | Example |
|---|---|---|
| Confidence levels | Always pair the color with a text label and non-color glyph (the `Confidence` component's `●●○` marks + "Medium confidence" text) — never color alone. | "●●○ Medium confidence" |
| Disputes | State the dispute as a fact, not a warning. Preserve both values; don't imply one is more likely correct unless the confidence engine says so. | "Two accepted claims disagree on the 1910 school address." |
| "Why this appears" | Name the specific match reason (place, era, entity relationship) — never a generic "related content" line. | "Appears because: documented at this address, 1948–1967." |
| Empty states | State what's missing and the next action; never apologize ("Oops," "Sorry") and never blame the reader. | "No published records at this precision yet. Try a broader area." |
| Corrections | Neutral, procedural tone; a correction is normal system function, not an admission of failure. | "Submit a correction" / "Under review" / "Resolved — record updated." |
| Legal/procedural status | Use only the constitution's `legalStatusVocabulary` (alleged, charged, indicted, arraigned, convicted, acquitted, dismissed, settled_civil, ruled, enacted, repealed, unknown_procedural) — never a conclusory label like "guilty," "the criminal," or "proven murderer" (see `unsupportedProceduralLanguage` in `packages/schemas/constitution/policy.v1.json`, enforced by `@repo/schemas`/`@repo/constitution`). | "Charged, 1952. Case dismissed, 1953." not "Innocent." |
| Living persons | Never state or imply a current residential address; unknown living status is written as living, not as "presumed deceased" or similar. | "Current status: living (protected)." not a street-level location. |
| Seed/sample data | Always disclosed plainly wherever fixtures stand in for live data (see `SeedDataNotice`) — never presented as if it were a live release. | "Sample seed data — not a live release." |

**Never:** exclamation points in body copy; rhetorical questions as
headlines; "unlock," "discover" (implies gamification); crime-statistic
language anywhere near a confidence score (constitution: crime stats never
enter the composite — see `docs/security/threat-model.md`).

## Longform story craft (oral methodology, citation-gated)

Staged `/stories` articles use the **research linking method** from strong oral
storytelling — start-line relocation, omitted actors, winner-built tests — without
importing viral rhetorical costume. Skill reference:
`.claude/skills/black-book/story-craft/SKILL.md`. Packets use
`story.research.packet.v1`; human approval maps an approved packet onto
`apps/web/src/data/stories-seed.ts`. Nothing auto-publishes.

**Adapt from oral craft (keep cite-map + dignity gates):**

| Oral move | Product rule |
|---|---|
| Thesis question as spine | One sentence the story answers; may open the draft, not a trauma hook |
| Start-line relocation | Name the conventional middle, then an earlier checkable origin on the map |
| Named anchors | Person + date + place + instrument when the catalog supports it |
| Omitted actors | Who the popular version erased — only with a published cite |
| Winner-built test | Constitutions, charters, treaties, contracts — what winners wrote, not slogans |
| Mechanism layer | Legal / economic / institutional why — no unsourced market or continental claims |
| Verification close | End with an off-ramp to linked entity/fact records, not a call to outrage |

**Hard bans (unchanged):** trauma-as-hook / graphic violence as the opening
paragraph; unsourced sweeping claims; personal family testimony as proof; open-web
scrape-as-truth. Authority-host URLs are **leads**, not silent body facts.

**Rhythm:** short declarative sentences, one reveal per paragraph, place and date
before abstraction. Vivid is allowed; brochure copy and marketing superlatives are not.

## Naming conventions

- Feature names describe what the thing does, not a coined brand term:
  "Search," "Explore," "Methodology," "Corrections" — not "BlackBook
  Discover™" or similar. The wordmark carries the brand; feature chrome
  stays plain.
- Section names on entity pages describe content directly: "Evidence,"
  "Confidence & disputes," "Location precision," "Provenance" — matching
  the methodology page's own section names, so the vocabulary a reader
  learns on `/methodology` transfers directly to every entity page.
  (/ must reuse these exact section names.)
- No gimmick names for internal concepts that leak into public copy: the
  research pipeline's internal vocabulary (quarantine, promotion,
  graylist, research case) stays internal; public copy translates each to
  a plain-language equivalent ("under review," "published," "flagged for
  research," etc.) rather than exposing pipeline jargon to readers.

## Source map

| What | Where |
|---|---|
| This document | `docs/ui/story.md` |
| Learning-index entity contract (summary, tags, related, prose, photo) | `docs/ui/learning-index-entity.md` |
| Brand mark/palette/type | `docs/ui/brand.md` |
| Design system tokens/components | `docs/ui/README.md` |
| Legal status vocabulary + unsupported language | `packages/schemas/constitution/policy.v1.json` |
| Sensitivity/living-person rules | `packages/schemas/constitution/policy.v1.json` (`sensitivityRules`, `livingPersonRules`) |
| Current homepage (map-led) | `apps/web/src/app/page.tsx`, `apps/web/src/app/HomeMapHero.tsx` |
| Methodology page | `apps/web/src/app/methodology/page.tsx` |
| About page | `apps/web/src/app/about/page.tsx` |

Consumed by:  (shell copy),  (entity page section naming),
 ("why this appears" storytelling),  (corrections voice),
 (editorial trust surfaces).
