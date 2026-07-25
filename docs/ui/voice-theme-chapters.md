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
the statistic and let the prose become a caption. Five rules keep it in the
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

## Sample chapter — illustrative figure

**This is an illustrative figure, not the original artifact.** The original
voice-study sample chapter (Walter Hayes / 1114 Fourth Avenue) referenced in
the issue that produced this document could not be located in this
repository, its design-mock directories, or prior conversation history at
the time of writing. If that original artifact surfaces later, it should
replace the sample below; until then, the sample below is a newly written
exemplar that follows all five rules above and should be treated as
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
| Folded-chapter prose rules (the five rules above) | This document |
| `named_actors` / `multiDecadeChecklist` data contract | `packages/domain/src/statistics/theme-impact-packet.ts` |

This document governs prose craft only. It does not change the data
contract, the `DataMoment` component API, or the dispute/confidence
components — it specifies how prose must be written around them.
