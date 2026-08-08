# Voice: era-immersion theme packets

**Status:** binding structure + voice guide for every flagship theme packet
built on the spine-series data engine, regardless of how many are live at a
given time. Applies to "Buying a home," "The gap that never closed,"
"Sentenced," "Casting a ballot," and any packet added later on the same
architecture: this document does not need updating when a new packet ships;
a new packet simply follows it. **Extends** `docs/ui/voice-theme-chapters.md`
and `docs/ui/story.md`; it does not replace either. Those documents still
govern named-actor scene voice, presence+proof, dispute phrasing, and
legal-status vocabulary. This document adds the second-person era-jump
structure that a spine-anchored packet uses instead of (or around) a single
folded chapter.

If a flagship packet's copy isn't traceable to this document, `story.md`, and
`voice-theme-chapters.md`, it's ad hoc and should be rewritten.

## Why this document exists

The old theme packets narrated what the data *couldn't* count: hedges,
caveats, and "the record is incomplete here" apologies sitting in the body
copy, competing with the story for the reader's attention. The new flagships
invert that. The reader is placed inside a specific year, told the rule in
force and the odds under it in plain numbers, then jump-cut forward one or
two generations and told the same thing again. The gap accumulates through
repetition of the same move, not through the prose explaining that a gap
exists. Data-gap honesty doesn't disappear, it moves into method notes,
where it belongs.

## 1. Structure per packet

Each flagship is a sequence of **eras** (typically 3-4) followed by a
**present-day close**. Every era beat follows the same five-part shape:

1. **Cold open, second person, present tense.** Drop the reader into the
   specific year with a concrete, ordinary action: filling out a form,
   standing in a doorway, opening a letter. No scene-setting throat-clearing.
2. **The rule in force.** A primary-document quote (statute text, manual
   clause, form language) that governs what just happened to "you." Quoted
   verbatim, cited inline.
3. **The measured odds.** The spine value(s) for that year, stated as a
   plain-number comparison, never a bare decimal or a percent sitting alone.
4. **Jump-cut.** A one-sentence transition that advances the calendar
   (a name, a date, nothing more) into the next era. No summary of what was
   just shown.
5. *(Repeat 1-4 for each era.)*
6. **Present-day close.** The sequence lands in the current year, second
   person present tense continues, and the spine chart for the full run
   becomes the visual anchor of the page. The prose does not re-explain the
   chart, it hands off to it.

A packet is not required to give every era all five parts at equal length.
Era 1 typically carries the most scene-setting; later eras can compress to a
sentence or two of new detail plus the numbers, since the reader already
knows the shape of the move.

## 2. Voice rules

- **Tense and person:** second person, present tense, inside every era
  ("You sign the form." / "You are told the rate is two points higher.").
  Do not slip into past tense or third person mid-era; a full tense shift is
  only allowed at the jump-cut into a new era, and only if the new era is
  itself narrated consistently once you land in it.
- **Numbers as odds or comparisons, never bare decimals.** Write "roughly
  1 in 5," "about twice as likely," "$44,900 against $285,000," not "17.2%"
  or "a ratio of 6.3" sitting unexplained in prose. The exact figure and its
  citation still belong in the adjacent `DataMoment`/`DisputeBlock`
  component; the prose translates it into a comparison a reader can hold in
  their head without doing arithmetic.
- **No hedging boilerplate inside the narrative.** "It's important to note
  that the data has limitations" and its relatives do not appear in body
  copy. Every caveat that would have produced that sentence goes into a
  collapsible **Method note** attached to the era (see §3).
- **Forbidden words/patterns**, aligned with this project's standing style
  rules and `voice-theme-chapters.md` Rule 3:
  - Hype words: "seamless," "robust," "revolutionary," "best-in-class," and
    similar, unless defined and earned.
  - Em dashes: avoid them in narrative prose. Use periods, commas, colons,
    or parentheses instead.
  - Uplift/perseverance cliches: "against all odds," "refused to give up,"
    "a testament to the human spirit," or any phrasing that resolves
    hardship into a moral the record hasn't earned.
  - Stacked adjectives characterizing a number before showing it ("a
    staggering drop," "the numbers tell a grim story"). Per
    `voice-theme-chapters.md` Rule 2, the figure lands the emotional beat
    alone; prose sets up the stakes, it does not announce or editorialize
    the result.
  - References to internal issue trackers, session status, or any
    non-published-domain identifiers. Published content must read as
    standalone; it never names how or where the work was tracked.

## 3. Epistemic stance: gaps live in method notes, not body copy

The old packets put "here's what we don't know" in the reader's path. The
new structure keeps that honesty but relocates it:

- Every era's numbers get an attached **Method note**, a collapsible block,
  not inline prose, covering: what the spine segment actually measures, any
  real gap in coverage for that span, and any unreconciled seam between
  source vintages (see `bb_reference.spine_segments.seam_check` for the
  structured version of this same information).
- The narrative prose never says "we don't have data for this year" or "this
  comparison isn't perfectly apples-to-apples." If an era's spine segment has
  a real gap or an unresolved seam, either pick an era year the spine
  actually covers, or state the method note's caveat in the method note only.
  Never let it surface as a hedge in the second-person narrative.
- This mirrors the multi-decade evidence-spine checklist already enforced in
  `packages/domain/src/statistics/theme-impact-packet.ts`. A packet's public
  claims must be backed by real observations with provenance; the method
  note is where that provenance and its limits are shown, not the scene.

## 4. Causal language tiers

Mirrors `ThemeImpactMethodStance` in `theme-impact-packet.ts` and
`docs/methodology/juxtaposition-not-causation.md`:

| Stance | When it applies | Allowed verbs in prose |
|---|---|---|
| `juxtaposition` (default) | No `claimId`/`causalClaimIds` attached to the packet's artifacts | "alongside," "while," "in the same year," "at the same time as": the two facts sit next to each other, the sentence does not claim one produced the other |
| `gated_causal_claim` | A `claimId` (on an artifact) or `causalClaimIds` is present, backed by the boundary-discontinuity-grade citations required in `docs/methodology/scholarship-principles.md` §6 | Causal verbs ("caused," "produced," "cost the family") are allowed, but only in the sentence directly citing the gating claim inline, not retroactively applied to earlier juxtaposed comparisons in the same era |

Default every era to `juxtaposition` language unless the packet has an
explicit gated claim wired up for that specific comparison. When in doubt,
juxtapose.

## 5. Worked example: "Buying a home," era 1955 to present

This example uses real spine values, with obs ids in the trailing comment so
they can be re-verified against the current database before use. It is
illustrative of register and structure only, not a finished packet section.
A real packet would cite a named primary-document artifact for the FHA/HOLC
quote rather than the representative language shown here, and should pull
fresh values at the time it is written rather than reusing the figures below.

---

> You are filling out a mortgage application in the spring of 1955. The loan
> officer's manual, open on the desk between you, instructs him to weigh
> "the infiltration of inharmonious racial groups" against the property's
> value before approving the loan, language lifted almost verbatim from the
> Federal Housing Administration's own underwriting standard.
>
> If you are Black, you own a home at roughly this rate: about 35 in 100.
> If you are white, the rate is closer to 55 in 100, the gap already twenty
> points wide before you've signed anything. The wealth behind those two
> numbers is even further apart: national estimates for the decade put a
> white family's wealth at roughly eight times a Black family's, benchmark to
> benchmark.
>
> Sixty-nine years pass. Your grandchild fills out the same kind of form.
>
> The manual language is gone. The gap is not: about 45 in 100 Black
> households own their home today, against 74 in 100 white households, the
> twenty-point spread from 1955 essentially unmoved. The wealth ratio has
> narrowed on paper, to roughly six-to-one by the most recent survey, but a
> typical Black family still holds a fraction of what a typical white family
> holds, on the same terms the 1955 form set in motion.
>
> *[Spine chart: Black vs. white homeownership rate, 1900-2024, and the
> white-to-Black wealth ratio, 1860-2019, run together as the page's spine]*

<!--
Sourced from bb_reference.statistical_observations, obs ids below.
Re-verify current estimates against the live table before reuse; values
will change as the spine is re-ingested or extended:
- obs:census-decennial-homeownership-black-nation:nation:US:1950
- obs:census-decennial-homeownership-white_nh-nation:nation:US:1950
- obs:dkks-wealth-ratio-white-black-nation:nation:US:1959
- obs:acs-homeownership-rate-black-nation:nation:US:2024
- obs:acs-homeownership-rate-white_nh-nation:nation:US:2024
- obs:scf-wealth-ratio-white-black-nation:nation:US:2022
1950 (nearest decennial year to 1955) used for the era-1 homeownership figures;
1959 (nearest DKKS benchmark year) used for the era-1 wealth ratio, both
rounded to whole numbers in prose per §2. method_stance: juxtaposition
throughout (no gated causal claim wired to this illustrative excerpt).
-->

---

## Relationship to existing voice documents

| Concern | Governed by |
|---|---|
| Presence+proof, microcopy, dispute phrasing, legal-status vocabulary | `docs/ui/story.md` |
| Named-actor folded-chapter prose rules (six rules, sentence rhythm, earned flourish, standalone prose) | `docs/ui/voice-theme-chapters.md` |
| Theme arc structure, journey beats, ink-sketch visuals, instrument rail rules | `docs/ui/design-direction-v6-themes.md` §1.1-1.2 |
| Second-person era-jump structure, odds-not-decimals numeric voice, method-note gap handling, causal-language tiers | This document |
| Juxtaposition-vs-causal-claim gate, boundary-discontinuity citation requirements | `docs/methodology/juxtaposition-not-causation.md`, `docs/methodology/scholarship-principles.md` §6 |
| Narrative-fact sourcing (two independent sources per fact, three-layer research/verify/integrate protocol), event buildup requirement, 2,000-word prose floor | `docs/methodology/chapter-fact-validation.md` |
| `methodStance` / multi-decade checklist data contract | `packages/domain/src/statistics/theme-impact-packet.ts` |
| Spine segment structure, seam checks | `bb_reference.spine_series` / `spine_segments` |

This document governs prose craft and structure only. It does not change the
`DataMoment`/`DisputeBlock` component API, the spine schema, or the
theme-impact-packet publish gate; it specifies how prose must be written
around them.
