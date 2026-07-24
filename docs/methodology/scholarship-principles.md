<!--
  Methodology: scholarship-derived principles for naming, vocabulary, uncertainty,
  agency framing, community review, and causal confidence. Binds enrichment prompts,
  story packet review, and theme-impact publishability alongside
  juxtaposition-not-causation.md.
-->

# Scholarship principles

**Status:** Binding product methodology
**Date:** 2026-07-24
**Related:** [juxtaposition-not-causation.md](./juxtaposition-not-causation.md), [research-operations.md](../research/research-operations.md), `packages/domain/src/provenance/` (evidence, lineage, rights), `packages/domain/src/statistics/theme-impact-packet.ts`

## Problem

`juxtaposition-not-causation.md` binds *how BlackStory talks about causal claims*. It does not
bind *how BlackStory names people, chooses vocabulary, represents uncertainty, frames agency, or
decides who gets a say before a story publishes*. Those are separate, real methodological
commitments this project has reviewed and is adopting from named external practice — not
invented in-house. Each principle below cites its source; where a specific claim about a named
project could not be independently verified, that is stated rather than asserted.

## 1. Naming and dignity

**Source:** Colored Conventions Project, published principles, `coloredconventions.org/about/principles/`.
CCP states its aim to avoid "exploiting Black subjects as data" and instead to name the Black
people in its records as agents and creators of the historical record — the record exists
because of choices about whose histories get documented and how.

**Binding rule:** copy referring to a person in the catalog names them as a subject of the
history, never as raw "data" to be mined. Editorial drafts (`publicSummary`,
`historicalContext`) describe what a person *did*, built, organized, or decided, not only what
was done to them. Attribution notes (research case sourcing, story cite maps) credit Black
women's collective and organizational labor by name where the source material supports it —
do not flatten a named organizer or a women's auxiliary/organizing body into an unattributed
"community effort." (CCP does not publish a separate "Black Women's Organizing" initiative
under that name as far as this review could confirm — the labor-attribution rule above is this
project's own extension of CCP's stated agent-not-data principle, not a direct CCP quote.)

## 2. Controlled vocabulary

**Sources:**
- LCSH/LCNAF as the interoperability layer (already anchored per repo-xez5.3).
- Sanford Berman, *Prejudices and Antipathies: A Tract on the LC Subject Heads Concerning
  People* (Scarecrow Press, 1971; reissued McFarland, 1993) — the foundational documented
  critique of racial and cultural bias in LC subject headings.
- Steven Knowlton, "Three Decades Since *Prejudices and Antipathies*: A Study of Changes in the
  Library of Congress Subject Headings," *Cataloging & Classification Quarterly* 40(2), 2005 —
  finds roughly 39% of Berman's proposed corrections were ever adopted, i.e. most were not.
- Hope Olson, *The Power to Name: Locating the Limits of Subject Representation in Libraries*
  (Kluwer, 2002), and Emily Drabinski, "Queering the Catalog: Queer Theory and the Politics of
  Correction," *Library Quarterly* 83(2), 2013 — both document that controlled vocabularies
  encode the biases of the institutions that maintain them and require active correction, not
  passive trust. (Cited for their well-established thesis; exact page citations were not
  re-verified against the primary journal text in this pass.)

**Binding rule:** LCSH/LCNAF ids remain the interoperability key (crosswalk value, external
linkage) but are never the *display* vocabulary on their own. Any LCSH-derived subject heading
or name form shown to a reader is paired with, or replaced by, this project's own
dignity-conscious label (the catalog's `identityLabel`/topic registry) and never displays an
outdated or pejorative LCSH term verbatim. Known LCSH bias is treated as an open, documented
problem in the field (Berman/Knowlton/Olson/Drabinski above), not a neutral default — a subject
heading is a starting crosswalk key to check, not an endorsement to repeat.

## 3. Uncertainty and variant names

**Source:** Enslaved.org, *Recommended Practices for Historical Slavery Data* v1 (2 March 2022),
`docs.enslaved.org/recommendedPractices/v1/enslavedrecommendedpractices-v1.pdf`; underlying
ontology documented in "Ontology-based Data Organization for the Enslaved.org Project,"
*Journal of Slavery and Data Preservation* 6(4), 2022, built on the W3C PROV-O provenance
ontology. Enslaved.org's own practices verify extracted data against source material and record
provenance at the level of individual data statements. (Enslaved.org's published materials were
not found to use the exact phrase "statement-level uncertainty" — that label is this project's
own name for the pattern below, applied to a real PROV-aligned practice.)

**Mapping to this repo's existing model:** this project already has a PROV-shaped kernel —
`EvidenceRecord` (`packages/domain/src/provenance/evidence.ts`) resolves every excerpt to a
`sourceItemId` with rights/permission status, and `EvidenceLineage`
(`packages/domain/src/provenance/lineage.ts`) tracks derivation (`syndication`,
`republication`, `derivative`, `same_capture`, `translation`) back to a `lineageRootId` — the
same "trace every statement to its origin, and trace derivative copies to their root" shape
Enslaved.org's PROV-O ontology encodes. The `ThemeImpactProvenanceQuartet`
(`theme-impact-packet.ts`: source, sourceUrl, retrievedAt, contentHash, humanCitation) is this
project's statement-level provenance unit; `uncertaintyLabel` on `ThemeImpactPacketArtifact` and
`gapStates` (`insufficient_evidence` | `modeled`) are this project's statement-level uncertainty
markers. **Binding rule:** variant names for a person or place (alternate spellings, name
changes, aliases in different sources) are recorded as data on the entity/evidence record, not
silently normalized away — the source form is preserved alongside the display form, per
Enslaved.org's practice of retaining verified source variants rather than overwriting them.

## 4. Agency framing

**Source:** Freedom on the Move (Cornell University), public project framing — subtitled
"Rediscovering the Stories of Self-Liberating People" (Zinn Education Project materials;
Cornell Chronicle, Feb 2019, `news.cornell.edu/stories/2019/02/freedom-move-builds-database-fugitive-slave-ads`).
The project deliberately frames people who escaped enslavement as agents of their own liberation
rather than as passive "runaways" or "fugitives" defined by an enslaver's advertisement.

**Binding rule:** editorial and enrichment prose defaults to agency-centered language for people
who resisted, escaped, organized, sued, petitioned, or otherwise acted — "self-liberating,"
"organized," "sued for," "petitioned" — over passive or crime-framed language ("runaway,"
"fugitive," "escaped slave") except when quoting a historical document verbatim in a clearly
marked citation. This extends the existing story-craft ban on "personal testimony as proof" and
"trauma-as-hook" (`research-operations.md`, story-craft section): agency framing is about verb
choice and subject position, not about withholding hard history.

## 5. Community review before publication

**Source:** SNCC Digital Gateway (Duke University Libraries / Center for Documentary Studies /
SNCC Legacy Project), published Editorial Policy, `snccdigital.org/about/editorial-policy/`.
The project is governed by an Editorial Board with equal representation from the SNCC Legacy
Project (movement veterans), established from the project's first meeting as equitable partners
in ownership, decision-making, and content — not consulted after the fact.

**Binding rule, mapped onto this repo's existing staged-review pattern
(`research-operations.md`):** story packets already pass through a human approval gate
(`story-research-run --commit` → quarantine `story_packet` → **Story review** desk,
`apps/admin/src/stories/story-review-queue.ts` / `story-review-copy.ts`) before a seed handoff
is ever pasted into `public-story-seed.ts`. v1 community review is a **named advisory reader
step inserted into that same lane**, not a parallel workflow: before a packet with sensitive
subject matter (redlining, racial violence, forced displacement, family separation) moves from
`needs_evidence`/draft to `approved`, the review desk records a `communityReviewNote` (who was
asked, what they said, or an explicit "not yet sought" flag) alongside the existing decision
note. This does not block on a formal board (that is future work, tracked separately) — it makes
the absence of community input visible and recorded rather than silent, consistent with SNCC
Digital Gateway naming movement participants as structural partners rather than passive sources.

## 6. Causal confidence (extends juxtaposition-not-causation.md)

**Sources:**
- Daniel Aaronson, Daniel Hartley, Bhashkar Mazumder, "The Effects of the 1930s HOLC
  'Redlining' Maps," *American Economic Journal: Economic Policy* 13(4), 2021 — boundary-
  discontinuity design across HOLC grade lines.
- Jacob W. Faber, "We Built This: Consequences of New Deal Era Intervention in America's Racial
  Geography," *American Sociological Review* 85(5), 2020.
- Aaronson, Faber, Hartley, Mazumder, and Sharkey have a related co-authored line of work on
  place-based effects of HOLC maps; cite the specific paper by title when used, not "Sharkey"
  as a standalone HOLC redlining author — his individual authorship on a HOLC-specific paper
  was not independently confirmed in this pass and should be checked before use.
- National Community Reinvestment Coalition, "HOLC 'Redlining' Maps: The Persistent Structure of
  Segregation and Economic Inequality," `ncrc.org/holc/`.

**Binding rule:** juxtaposition remains the default product shape for all theme-impact content
(unchanged from `juxtaposition-not-causation.md`). A causal claim in a redlining narrative
specifically (not other themes) may only be published as a `gated_causal_claim` methodStance
when its `causalClaimIds`/`claimId` cite a peer-reviewed study using a boundary-discontinuity or
equivalent quasi-experimental identification strategy against HOLC grade lines — the Aaronson/
Hartley/Mazumder line, Faber, or the NCRC study above are the reference class; a co-moving time
series or a single correlational observation is never sufficient, per the existing forbidden
list in `juxtaposition-not-causation.md`.

## Wiring: where this binds

- **Story packet review** — `apps/admin/src/stories/story-review-copy.ts`
  (`STORY_REVIEW_STEPS`) gains a step referencing this document's naming/agency and community-
  review principles; the review desk records a community-review note per §5.
- **Theme publishability** — `packages/domain/src/statistics/theme-impact-packet.ts`. Note:
  repo-xez5.7 is extending this file's publishability checks concurrently (multi-decade
  checklist). This document adds a `methodologySources` reference (doc links, additive field)
  rather than restructuring `assertThemeImpactPacketPublishable` — see that function's existing
  causal-claim gate, which already implements §6 structurally and needs no logic change here.
- **Enrichment prompts** — `packages/operator-cli/src/editorial-run.ts` `SYSTEM_PROMPT` gains a
  naming/agency-language rule line referencing this document (§1, §4), without rewriting the
  rest of the prompt contract.

## Implementation checklist

- [x] Sourced principles document exists and cites every claim
- [ ] `story-review-copy.ts` references this doc and gains a community-review note field
- [ ] `theme-impact-packet.ts` gains an additive `methodologySources` reference (coordinate with
      repo-xez5.7 before merging to avoid a structural conflict)
- [ ] `editorial-run.ts` `SYSTEM_PROMPT` gains a naming/agency-language line
- [ ] Redlining theme pages link both this doc and `juxtaposition-not-causation.md` publicly
