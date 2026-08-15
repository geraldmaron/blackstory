# Voice: folded theme chapters

**Status:** binding prose-voice guide for stories that fold into a theme's
narrative spine as chapters (see `design-direction-v6-themes.md` § 1.1 "Theme
arc voice"). **Extends** `docs/ui/story.md`'s presence+proof principle — it
does not replace it. Presence+proof says every claim shown must carry
receipts; this document says what the *prose* has to do so those receipts
land as scholarship, not as decoration bolted onto a paragraph.

If a folded chapter's copy isn't traceable to this document (and to
`story.md`'s editorial voice guide, which still governs microcopy, disputes,
and legal-status vocabulary), it's ad hoc and should be rewritten.

## Why this document exists

A theme chapter is not a standalone `/stories` article and not a data
dashboard with captions. It is prose that a reader sits inside for several
paragraphs before a number ever appears. That format fails in two specific
directions if left unguided: it can slide into anonymous "trends affected
communities" mush that presence+proof already forbids, or it can front-load
the statistic and let the prose become a caption. Six rules keep it in the
narrow lane between those failures.

## Rule 1 — Specific person, specific hour

Never write "families were displaced." Write the named person, on the named
block, in the named month. If the record only supports a partial name or an
approximate date, say exactly that ("a man the deed lists only as 'J.
Coleman,' spring 1938") rather than smoothing it into an anonymous plural.

This is the same requirement the data layer already enforces: a folded
chapter's opening scene should be able to satisfy the `named_actors` item of
`multiDecadeChecklist` in
`packages/domain/src/statistics/theme-impact-packet.ts` — that item reads
`present()` only when the packet carries an `entityBinding`, i.e. a real
named actor tied to the record, not a demographic aggregate. If a chapter's
opening paragraphs can't name who `entityBinding` points to, the chapter
isn't ready to fold in; go back to research, not to euphemism.

**Good:**

> Walter Hayes signed the deed to 1114 Fourth Avenue on the second Tuesday
> of March 1936, six weeks before the Home Owners' Loan Corporation
> surveyor drew the line three blocks east of his porch.

**Bad:**

> Throughout the 1930s, many Black families in the neighborhood struggled
> to secure home loans as federal housing policy took shape.

## Rule 2 — Prose builds stakes, data delivers the verdict

The emotional peak of a section is a `DataMoment` figure, and it lands
*after* two to four paragraphs of restrained setup — not before, not
alongside. The prose in those paragraphs establishes who is at stake and
what they stood to lose; it never announces the number itself, characterizes
it ("a staggering drop," "the numbers tell a grim story"), or editorializes
around it. The figure is left to do that work alone, in the data component,
where it's cited.

**Good (prose, ending right where the figure takes over):**

> Hayes refinanced twice in the 1940s, each time at a rate two points above
> what his white counterpart three blocks north was quoted the same season.
> By the time his daughter inherited the house in 1961, the loan had cost
> the family more in interest than the original purchase price.
>
> *[DataMoment: HOLC grade "D" appraisal differential, 1936–1961, this
> tract vs. adjacent "B" tract — cited to National Archives Record Group
> 195]*

**Bad (prose pre-empts the number, then repeats it as color):**

> The discrimination was staggering — Black homeowners like Hayes paid
> wildly more in interest than their white neighbors, a shocking gap that
> the data below confirms in full.
>
> *[DataMoment: HOLC grade "D" appraisal differential...]*

## Rule 3 — Sentence rhythm

Full sentences, each carrying at most one subordinate clause. Vary sentence
length across a paragraph rather than settling into a single cadence. No
staccato fragments used for dramatic effect. No uplift or perseverance
language ("against all odds," "refused to give up," "a testament to the
human spirit"). No "Disney corny" phrasing — nothing that resolves hardship
into a moral before the record has earned one. Model register: Isabel
Wilkerson, *The Warmth of Other Suns* — patient, declarative, letting scale
accumulate sentence by sentence rather than being announced.

**Good:**

> The bank's ledger listed the loan as paid in full in 1958, four years
> before the city rezoned Fourth Avenue for the arterial that took the
> block. Hayes did not live to see the rezoning. His daughter did.

**Bad:**

> Denied. Rejected. Redlined. But Walter Hayes never gave up — and his
> spirit lived on in the family that refused to let the system win.

## Rule 4 — Disputes in prose

When records disagree, the disagreement is shown in the body of the prose
itself, side by side, not relegated to a metadata panel or a footnote the
reader has to seek out. This mirrors `story.md`'s dispute rule ("state the
dispute as a fact, not a warning; preserve both values") but requires it to
surface in the narrative sentence, not only in the `Confidence`/dispute
component.

**Good:**

> The city's 1936 survey lists Fourth Avenue as "gradually infiltrated by a
> lower grade population"; the county assessment rolls for the same block,
> filed eight months earlier, describe it as "well maintained, stable
> occupancy." The two records were never reconciled.

**Bad:**

> The area was assessed poorly at the time. (See dispute metadata.)

**When two figures disagree because of *method*, not because anyone hid or
lost anything** — one is a raw historical tabulation, the other a later
scholar's adjusted reconstruction — say only what the sources actually
establish: both numbers, both attributed, then stop. Do not narrate a cause
the sources don't give ("nobody can resolve it," "the difference wasn't
worth checking to them"), and never assign motive or negligence to a
record-keeper unless a cited source supports that motive. A discrepancy of
a few dozen against a total in the hundreds of thousands does not need to
be made to feel large; state it at its actual size and let the reader do
that arithmetic.

**Good:**

> By the Census Bureau's own historical tables, 697,681 of them are
> enslaved; a peer-reviewed demographic history of the same census puts the
> figure at 697,624.

**Bad (invents a cause and a culprit neither source supports):**

> Fifty-seven human beings sit inside that disagreement. Nobody can resolve
> it now, because the only people who knew were never asked, and the men
> who wrote the totals didn't think the difference worth checking.

## Rule 5 — Earned flourish

A folded chapter may end on one lyrical line — no more than one per
chapter — and only when the receipts placed above it justify the reach.
"Earned" means the line draws directly on a fact already on the record in
that chapter; it does not introduce new imagery, metaphor, or claim that
isn't grounded in what's already been shown and cited. If a chapter has no
receipts strong enough to carry a closing line, end on the plainest
declarative sentence available instead of forcing one.

**Good (one line, drawing only on facts already shown):**

> The house at 1114 Fourth Avenue still stands. The line the surveyor drew
> three blocks east of it does too, in the shape of who owns what on either
> side.

**Bad (two flourishes stacked, second one ungrounded):**

> The house at 1114 Fourth Avenue still stands, a quiet monument to
> resilience. And somewhere, in the space between the lines on that old
> map, the ghosts of everyone who was ever told no are still whispering
> that they were here.

### Coda discipline

A chapter's closing section gets **one** synthesis pass, not several. If a
draft ends with two or three paragraphs that each restate "here is how to
read this record" in different words, that is Rule 2's failure at the scale
of a whole section: the narrator explaining the point instead of trusting
the material that already made it. Pick the single strongest closing
move — usually the one earned flourish Rule 5 allows — and cut the rest
rather than stacking them. A closing list that just re-itemizes sources or
scenes already given their own beat earlier in the chapter is the same
over-explanation in list form; if the reader already sat inside those
scenes, they don't need a recap to be convinced they happened. Meta-framing
that announces its own instructional purpose ("so here is how to read this
archive," "which is also the instruction for reading the rest of it") gets
cut on sight — let the sentence that follows stand on its own.

## Rule 6 — The chapter stands alone

A chapter is a piece of history, not a page of a product. Its prose never names the
site it is published on, never points at sibling chapters as chapters, and never
speaks in the publisher's first person.

This is a reader-facing requirement before it is a stylistic one. Readers arrive on
these pages from search, syndication, and shared links with no idea what else is
published here. "Another chapter on this site follows what happened next" is a dead
end to that reader and an unexplained brand reference to everyone else, and it dates
badly the moment the other chapter is renamed, merged, or unpublished. It also
quietly changes what the piece is: prose that references its own navigation is
marketing the surface, not narrating the record.

Forbidden in body prose and pullquotes:

- **Naming the surface** — "this site," "this page," "this project," "on our site."
- **Cross-referencing siblings as siblings** — "another chapter," "the other
  chapters," "the wealth chapter," "a chapter here."
- **The publisher's first person** — "our summary," "a story we are telling you,"
  "none of it needs us in order to be believed," "we show them side by side."

Allowed and encouraged:

- **"This chapter"** referring to the piece the reader is currently inside
  ("two wealth series run through this chapter, and they're never averaged"). That
  is ordinary essay voice about the writing at hand, not a reference to a platform.
- **Second person** for the reader inside an era, which the era-immersion structure
  requires.
- **Entity links** — `[[entityId|Label]]` inline, plus `relatedEntityIds` on the
  article. This is how related history gets reached: through links that resolve to
  real records and degrade gracefully, never through prose describing navigation.

When a chapter genuinely needs the history a sibling covers, write the history, cited,
in one or two sentences and link the entity. "Four days later Sherman issues Special
Field Orders No. 15, and within the year the land goes back" carries the reader
without assuming they can see a table of contents.

**Enforced** by `gateStandaloneProse` in `packages/ops-data/scripts/articles.ts`: a
hard error on published articles, a warning below that. The gate matches phrasings,
not intent, so it is a floor rather than a substitute for reading the prose.

**Scope:** this rule governs chapter *content*. Site chrome written by components
(drawer labels, the dispute block's standing line, empty states) is the site
speaking as itself and may use the institutional voice.

## Sample chapter — illustrative figure

**This is an illustrative figure, not the original artifact.** The original
voice-study sample chapter (Walter Hayes / 1114 Fourth Avenue) referenced in
the issue that produced this document could not be located in this
repository, its design-mock directories, or prior conversation history at
the time of writing. If that original artifact surfaces later, it should
replace the sample below; until then, the sample below is a newly written
exemplar that follows all six rules above and should be treated as
canonical guidance for register, not as historical fact about a real
person or address.

---

> Walter Hayes signed the deed to 1114 Fourth Avenue on the second Tuesday
> of March 1936, six weeks before a Home Owners' Loan Corporation surveyor
> stood on the corner three blocks east and drew a line on a map that would
> outlive him. Hayes was thirty-one. He had spent four years as a machinist
> at the rail yard south of downtown, and the down payment came from
> overtime he'd banked since 1933, in a coffee tin his wife, Odessa, kept
> on the top shelf of the kitchen cabinet.
>
> The surveyor's report, filed that April, never mentioned Hayes by name.
> It described the four blocks around Fourth Avenue as "infiltrated," rated
> the area "D," and recommended against further mortgage insurance in the
> district. The county assessment rolls, filed the previous August for tax
> purposes, told a different story: they listed the same four blocks as
> "well maintained, stable occupancy, moderate turnover." The two documents
> were never reconciled. Both stayed in the public record, eighteen inches
> apart in the same courthouse annex, for the next four decades.
>
> Hayes refinanced twice — once in 1944, once in 1951 — and each time the
> rate came in two points above what a loan officer at the same bank quoted
> a buyer on Linden Street, on the "B" side of the line, that same season.
> He kept every statement. Odessa kept the coffee tin, empty now, on the
> same shelf, because she said throwing it out felt like admitting
> something.
>
> *[DataMoment: HOLC grade "D" interest differential vs. adjacent "B"
> tract, 1936–1958 — cited to National Archives Record Group 195, county
> assessment rolls, and bank refinancing statements held in family
> records]*
>
> By 1958 the loan was paid in full. Four years later the city rezoned
> Fourth Avenue for an arterial that would eventually take the block on
> the "D" side entirely and leave Linden Street untouched. Hayes did not
> live to see the rezoning; he died in 1960, at fifty-five, of a heart
> condition his doctor's notes attributed in part to "prolonged financial
> strain." His daughter, Marguerite, inherited what was left of the house
> and the tin.
>
> The house at 1114 Fourth Avenue still stands. The line the surveyor drew
> three blocks east of it does too, in the shape of who owns what on
> either side.

---

## Relationship to existing voice documents

| Concern | Governed by |
|---|---|
| Presence+proof, microcopy, dispute phrasing, legal-status vocabulary, "why this appears" | `docs/ui/story.md` |
| Theme arc structure, journey beats, ink-sketch visuals, instrument rail rules | `docs/ui/design-direction-v6-themes.md` § 1.1–1.2 |
| Folded-chapter prose rules (the six rules above) | This document |
| Standalone-prose enforcement (no site/sibling-chapter/publisher-voice references) | Rule 6 above, gated by `gateStandaloneProse` in `packages/ops-data/scripts/articles.ts` |
| `named_actors` / `multiDecadeChecklist` data contract | `packages/domain/src/statistics/theme-impact-packet.ts` |

This document governs prose craft only. It does not change the data
contract, the `DataMoment` component API, or the dispute/confidence
components — it specifies how prose must be written around them.
