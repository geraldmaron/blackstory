<!--
  Structure decision for Lives Across the Decades. Supersedes the decade-grid reading of
  lives-regions-and-sources.md (plan of record) for the READER SURFACE only; the figure method in
  docs/methodology/lives-across-decades.md is unchanged and binding.
-->

# Lives: the structure decision

**Status:** Decision record, pending two owner calls (§10)
**Date:** 2026-09-17
**Epic:** `repo-0clax`
**How it was reached:** Two adversarial design passes. The first challenged the collection-first
approach (17 agents: 9 auditors, 4 critics, 3 adversaries, 1 synthesis). The second designed the
structure (21 agents: 5 research packets, 5 independent structures, 2 adversaries attacking each,
1 decision). **All ten attacks in the second pass returned `fails`.** Every structure's spine
survived; every structure's *mechanic* broke. What follows is composed from the surviving spines.

---

## 1. The decision

**One milestone, six eras, one panel per era.**

The reader picks a life milestone and nothing else. That choice fixes the measure, the universe,
and the unit. Each era contributes exactly one panel: one decade, one place, the comparison already
drawn, each figure carrying its own definition label printed in place.

Panels stack and are **never connected by a line.** Every definitional break, regime break, and
visibility break lands between panels, where it can be stated instead of crossed.

Milestones are entrances, not a sequence. There is no "next milestone," so the product has no
terminal screen and no ending.

**Five reader controls become one:** which milestone, and scroll.

## 2. Why the grid had to go

The product today is a four-dimensional explorer (area x decade x lens x unit) over 13 measures.
Measured off the live snapshots on 2026-09-17:

| Cell state | Count |
|---|---|
| published | 1,527 |
| pending (collectible) | 967 |
| suppressed for **our** partial state coverage | 138 |
| not_measured (the census never published it) | 1,736 |

58% of collectible cells are filled. **1970-2020 is 100% complete in every area**, and those panels
are not the engaging ones. That is the internal experiment that disproves completeness as the
objective: the half of the timeline with no gaps is not the half that works.

Meanwhile all 112 area x decade panels ship `frame: null` and `worldBeats: []` in the snapshot.

## 3. The eras

Six. Identified **by their years.** Each carries a one-line subtitle stating a verifiable change in
what was counted. Every boundary is pinned to a change the code already enforces
(`LIVES_CONDITIONS` windows, `livesRegimeForDecade`, `crossesLivesRegimeBoundary`,
`livesHispanicCounting`), so no boundary is defended on interpretive grounds alone.

**The product asserts no era name in its own voice.** Contested stretches carry a block, "What this
stretch gets called," listing scholars with their own brackets and no product verdict:

- The nadir: Logan 1877-1901, Franklin and Callis to 1923, Loewen 1890-1941, Cha-Jua 1877-1917.
- The present: Joseph's Third Reconstruction (2008-), Cha-Jua's New Nadir, Alexander's Age of
  Colorblindness, Marable's New Racial Domain.

Two of the six are modern, which is the owner's requirement: the product must not be a historical
corridor the reader visits and leaves.

**Hispanic periodization does not align** with the Black American scheme (repatriation, Bracero,
1965 immigration reform, Puerto Rican migration). It gets **its own panel** in the "Being counted"
column rather than being rendered as an absence everywhere.

## 4. The milestones

Nine backed by a condition, plus one backed by nothing here. Universe strings are verbatim from
`LIVES_CONDITIONS`.

| Milestone | Measure / universe | Law domains | Eras |
|---|---|---|---|
| Being counted | population_share, "Everyone living in the area," 1870-2020 | voting, justice | all six |
| Learning to read | literacy, "People 10 and older," 1870-1930 | schooling, voting | 1-2 |
| Starting school | school_attendance, "School-age children," 1870-1930 | schooling, family | 1-2 |
| Finishing school | high_school, "Adults 25 and older," 1940-2020 | schooling | 3-6 |
| Working land you don't own | farm_tenancy, "Farm operators," 1900-1950 | work, credit, housing | 2-3 |
| Finding work | unemployed, "People in the labor force," 1930-2020 | work, income_support | 2 (1930), 3-6 |
| Keeping a home | homeownership, "Occupied homes, by the race of the household head," 1900-2020 | housing, credit | 2-6 |
| Earning against everyone else | income_to_national_median + brackets, 1940-2020 | work, credit, income_support | 3-6 |
| Leaving, and staying | urban, 1890-2020, plus `lives-population` state numerators | housing, public_accommodation, work | 1 (1890) - 6 |
| **How long a life ran** | **not in the condition set** (see §9) | justice, income_support, family | gated |

"Finishing school" is a **separate entrance** from "Learning to read" and "Starting school," never a
continuation. Different question, different universe, different people. That is the same wall that
killed the cohort diagonal; here it is a door rather than an obstacle.

### The three absences, which must never look alike

- **The census's silence** (`not_measured`) renders a **full panel**, not a blank: heading, the
  reason string, the decade's count note, the rules that began.
  > *"Not published. The census asked whether you could read for the last time in 1930. The
  > question that replaced it, in 1940, asks how far adults 25 and older got. They are not two
  > points on a line."*
- **Our silence** (`pending`) gets different chrome and names what we have not done.
  > *"We have not transcribed this. It was published in [table]."* — with a link to the tracked issue.

  Rendering our gap in the census's voice is the easiest dishonesty available in this product, and
  the structure forbids it at the component level.
- **Withheld** (`suppressed`): the word, plus the floor that triggered it.

## 5. The perspective mechanic

### Layer one: the comparison is drawn, never chosen

Inside a panel, groups are **overlaid**. Across panels, eras are **juxtaposed** and never connected.
Xiong et al. measured that overlay affords the across-group comparison and juxtaposition affords the
over-time one, and that essentially nobody makes the across-group-across-time comparison
spontaneously. Doing both inside one panel is the formal description of what `/lives` does wrong
today.

Every panel carries, adjacent and in the same scroll, never behind a tab: each group's **definition
label printed in place**; **within-group spread** with the regime attached; the **rules that began
in this era**, filtered by the milestone's life domains; **voice**, or a stated absence naming what
was searched; and an **exit** to a record, entity, or law.

### Layer two: the Turn

**One per milestone column. Never more.** Three admissible forms:

1. **Place against place, same group.** Which region, or where in a range. Being wrong indicts a
   belief about geography and institutions, not about a group.
2. **Then against now, same group, same definition label, no regime break between.** *Direction
   only* — up, flat, down. Never a magnitude.
3. **Rule or question.** Which of these rules had already begun; what the form asked this decade.
   No group appears in the question at all.

**What the Turn never does.** It never asks the reader to estimate a group's outcome rate. It never
draws the white figure complete and leaves the Black figure blank. It never prints an error in
points. It never scores, streaks, or tallies. It never shows other readers' guesses — low-consensus
crowd guesses reduced recall and hardened wrong priors by six points in the measured study, which is
the predicted profile here. Nothing is persisted, logged, or transmitted. Discrete tap bands or a
native radio group, minimum 24x24 CSS pixels, keyboard and screen-reader operable, no drag, no draw,
no `touch-action` override. Never offered on a cell that is not `published`: a reveal of "Withheld"
after a guess is the worst screen this product could build.

**The open causal prompt is cut.** "Why do you think that is?" next to a rendered racial gap, on a
page contractually barred from stating a cause, elicits a deficit account. The self-explanation
evidence assumes a model follows. None can. Cut it.

**The one control that makes spread safe.** A within-group spread shown bare is the deficit hazard
wearing the mitigation's clothes. Every spread renders **with the jurisdictions named and their
rules attached**, or it does not render.

**Classroom test**, a ship gate: would this screen be harmful projected in a mixed classroom with no
facilitator? *Freedom!* (1992) was withdrawn because the harm happened between students, not inside
one. A Turn about a rule or a region passes. A Turn about a Black outcome rate does not.

**What this does for a Black reader.** No screen asks her to estimate her own group's outcome and
then corrects her. No screen constitutes her as a member of an ignorant majority. A Turn she gets
right is not a null event, because the panel's substance does not depend on her having been wrong.

**What this does for a white reader.** He is made wrong about **institutions**, not about people.

## 6. What leaves the reader's hands

**Removed.**

- **Lens.** `race` comes out of `LivesViewState`. Today it only sets emphasis and every group
  already stays on screen, so this is prophylactic: it forecloses the costume rather than removing
  one. Worth doing, because every design in the set wanted to add the costume.
- **Unit.** `LIVES_UNITS` and `livesUnitEmphasis` are **deleted**, not extended. A three-value enum
  cannot express "adults 25 and older," "farm operators," or "people in the labor force," and
  extending it to seven would add a dimension to fill a content gap. The `universe` string is
  already the life-stage statement; the panel prints it verbatim. `selectLivesWorldBeats` gains
  `'all'` on its input side so the testimony corpus is queryable without a unit.
- **Class tier.** `classShares` always carries all four buckets, so removing the tier costs no data.
- **Measure.** The milestone names it.
- **Decade.** Replaced by era. Each era contributes one panel; the decade inside it is chosen by a
  computable rule (the decade where the milestone's cells are published for the compared lenses in
  the column's area). If none qualifies, the era gets an **absence panel**, not a missing one.

**Subordinated.** Area becomes an authored property of each column, and on a Turn of form 1 it is
the comparison axis itself.

**The route.** The four controls come off `/lives`, which becomes the milestone surface. The
existing explorer moves to its own route and is **demoted to an appendix**. Honest accounting: one
collapsed front door and one demoted appendix, not one surface. The explorer keeps real value — it
is the only surface reaching all 42 count notes and all 112 decade panels.

## 7. Worked screen, before 1940

**Starting school. 1900-1930. The Deep South. Panel decade: 1910.**

> **Starting school**
> 1900-1930 · the Deep South · counted in 1910
> *School-age children.*

Overlaid, trimmed axis: **Black 54.1, white 73.8.** Under each, its label as the census wrote it.
Third row, not a bar: *"No category. The census had no way to count Hispanic Americans separately in
1910; most were recorded as white."* (shipped `LivesCountSight` treatment).

**The Turn, form 1:**

> The census published this for 47 states. Among Black school-age children, the lowest state figure
> was 37 in 100.
> **Where did the highest state figure fall, against the lowest white state figure?**
> [ well below it ] [ about equal ] [ above it ]

Reveal, same surface: **above it.** Black highest 92.0, white lowest 68.3. Nation: Black 59.7
(1,280,949 of 2,146,116), white 84.7 (12,386,954 of 14,622,156). Then the states at each end are
named with their rules in force. **The spread is a map of regimes, not of capacity, and the panel
says so before the reader can supply the other reading.**

**Rules that began**, schooling: Second Morrill Act 1890; *Plessy* 1896-1954; *Berea College v.
Kentucky* 1908. Not the in-force wall.

**Voice:** the 1910 decade's beats are region-scoped to the Northeast and Midwest and none are
schooling. So: *"No sourced first-person account of school attendance in this region and decade is
in this corpus yet. Searched: [named collections]."* Under-investment named as under-investment.

**Where it ends:** *"The census asked who was in school for the last time in 1930. The question that
begins in 1940 asks adults 25 and older how far they got. Different people, different question.
'Finishing school' is its own door."* No line leaves this panel.

## 8. Worked screen, after 1990

**Keeping a home. 2010-2020. The nation. Panel decade: 2020 (ACS 2019-2023).**

The reader arrives having scrolled past this column's earlier panels, each labeled, none connected:
1910 Deep South 18.6; 1930 Deep South 20.6 / 43.6; 1940 nation 22.8 / 45.7; 1970 nation 41.5 / 65.4;
2000 nation 46.3 / 72.4.

**The Turn, form 2:**

> Between 2000 and 2020, Black high school completion went from 72 in 100 to 88 in 100.
> **Over the same twenty years, Black homeownership went which way?**
> [ up ] [ flat ] [ down ]

Reveal: **down.** Verified against `bb_reference.statistical_observations` on 2026-09-17:

| National homeownership | 2000 | 2010 | 2020 |
|---|---|---|---|
| Black alone | 46.3 | 44.5 | **43.6** |
| White, not Hispanic | 72.4 | 72.7 | 72.9 |
| Hispanic | 45.7 | 47.5 | **50.6** |

All three Black panels carry the identical definition label and there is no regime break, so the
comparison is legal. No error in points, no score.

**Margins printed:** Black 43.59 ±0.29 (B25003B), white NH 72.90 ±0.23 (B25003H), Hispanic 50.61
±0.36 (B25003I).

**The non-partition, in place, not in a footnote.** *"These are not three slices of one population.
The Black figure counts 'Black or African American alone,' so a Black Hispanic household is in it and
in the Hispanic figure too. The white figure excludes Hispanic households and overlaps neither. They
do not add to 100. On this same 2020 panel, population share comes from B03002, where the three do
partition."* **This is a correctness defect on the page today and fixing it is unconditional.**

**Rules that began**, housing and credit: **none.** Nine housing rules are in force, the most recent
from 1977. The emptiness is the content, and it sits directly under a figure that went down.

**The reckoning:** *"The 2020 count showed no significant national error. Hispanic Americans were
undercounted by 4.99%, Black Americans by 3.30%, and non-Hispanic white Americans overcounted by
1.64%."* A national total can be right while every group in it is wrong.

## 9. Build order, and what it does to the 1,105

1. **Enumerate the addresses before authoring anything.** Nine milestones x six eras x the column's
   area, checked against cell **state** rather than publication window. Publish the matrix. One
   read-only query, and it decides whether the structure has a middle. Every failed design skipped
   this.
2. **Three free wins on the existing surface.** Delete `unit` and `tier` (pure view state). Swap the
   in-force wall for rules-that-began. Add the modern non-partition notice.
3. **Wire `validateLivesWorldBeats` to a build-time caller.** It has **zero production callers**
   today while the published methodology tells readers narrative is validated against figures.
   Turning it on may fail the build on the 25 existing fixtures; that cleanup is the prerequisite.
4. **Extend the dignity guard** with a subject-position check: every panel must carry at least one
   sourced sentence whose grammatical subject is a Black person or institution **acting**.
5. **Fix the testimony corpus before any panel calls it perspective-getting.** Add a mediation field
   to `LivesWorldSpeaker` (self-authored / as-told-to / reported-by-third-party) and retag. Carey
   McWilliams is a white journalist's account in the Hispanic speaker slot; Nate Shaw is
   Rosengarten's edited transcription (and *All God's Dangers*, 1974, is in copyright). Both may
   appear, labeled as what they are. Neither may stand in for a group's voice.
6. **Build one column end to end: "Keeping a home."** The only measure reaching 1900 to 2020 on a
   stable universe, a panel in five of six eras, strongest modern content.
7. **Then "Being counted,"** which carries the Hispanic periodization panel and is the front door.

### The 1,105

This structure makes **completionism unnecessary and a small subset urgent.** Only cells a panel
addresses matter: roughly **50 addresses, not 1,105**.

- **Newly urgent:** the 1940-1960 holes, because era 3 is where every design went hollow. 1950 is 30
  published of 189 condition cells (16%); 1960 is 26 of 189 (14%); nationally in that era urban and
  income have **zero** published condition cells. Target the era-3 addresses the nine columns need,
  and nothing else in that range.
- **Newly unnecessary:** everything outside the address list. Kill the regional occupation sweep
  (~255 state-table subjects, the bulk of the 572-cell bead).
- **Reclassified, not collected:** a pending cell is now visible to readers as *our* gap with a named
  source table. A stronger forcing function than a coverage dashboard.

### Mortality: wiring, not collection

**Correction to an earlier claim in this epic's discussion.** NCHS life expectancy at birth by race
is **already in `bb_reference`** and routed only to `/data`:

```
nchs-life-expectancy-birth-black-nation   19 obs   1900-2021
nchs-life-expectancy-birth-white-nation   19 obs   1900-2021
```

Gated on two bounded items: the stored Black 2000 value (71.3) is flagged as disagreeing with
*Health, United States* Table 4, and both series cite `NCHS/Socrata API` — a bare API reference, not
a named table, which fails this project's own citation rule. On the surface it must also state that
1900-1960 is the **nonwhite** population per the published footnote, Hispanic does not exist before
2006, and a bridged-race methodology change begins in 2018. Era 1 gets nothing; the series starts in
1900.

**Genuinely new collection, worth doing:** NCHS infant mortality by race, 1915-2013, one CDC open
dataset. The only true birth measure available, decade-alignable across five of six eras, and its
1980 break (race of child before, race of mother after) is exactly the kind of definitional change
these panels are built to state.

**Second, high value per byte:** NCES Digest table 216.50, share of Black students in schools with
90%+ minority enrollment, 34.1% (1995) to 40.2% (2018). A ready-made Turn of form 2: a reader who has
just watched high school completion go 72 to 88 will predict school segregation fell. It did not.

## 10. Open decisions, and residual risk

**Two calls are the owner's, not a designer's, and should be made before this is built.**

1. **The causation policy.** `docs/methodology/lives-across-decades.md` and
   `juxtaposition-not-causation.md` bar the product from explaining a gap it renders. A structure
   that makes gaps *more* memorable and still cannot complete the proposition leaves dispositional
   explanation as the only one available to the reader. The mitigations here are real — rules-that-
   began adjacent to the figure, spread with regimes attached, Turn form 1 letting the reader derive
   a structural account rather than receive an asserted one — but they are mitigations, not a fix.
   Whether to permit a gated, peer-reviewed causal claim inline on gap panels is a policy decision.
2. **The community review note.** `docs/methodology/scholarship-principles.md` requires a recorded
   `communityReviewNote`, including an explicit "not yet sought," before sensitive material is
   approved. A perspective mechanic designed almost entirely from studies of white learners, shipped
   with that field empty, is the clearest single failure this design can have.

**Residual risk.**

- **Joy is not a measure, and this structure does not solve it.** A census-backed spine carries it
  only through voice and through agency content in "Being counted" (the 1870 first listing by name;
  "Mexican" dropped as a race in 1940 after Mexican American lobbying; the surname counts used in
  *Hernandez v. Texas*). The subject-position validator is a floor, not an answer. **If the testimony
  commission does not happen, nine columns of thresholds crossed or not crossed is the suffering
  narrative arrived at by a different road.**
- **The Turn's evidence transfer is partial.** Forms 1 and 3 are closer to prequestions, whose
  benefit is well-evidenced but only on the prequestioned material. Form 2 is direction, not
  magnitude. Evaluate on recall or attribution, never on a "was this useful" widget.
- **`LivesCell` has no universe field and no denominator field**, so a label-equality check is not
  sufficient for Turn comparability. Test source identity, or add a structured denominator at
  ingest, or do not place form 2 on cells whose sources differ. Pick one before building.
- **State-level spread is not in the bundle.** `LivesConditionBundle` carries one cell per lens.
  Spread is a bundle-shape change with a snapshot rebuild attached. **Do not bump
  `LIVES_SNAPSHOT_VERSION` without shipping the rebuild first** — `isLivesAreaSnapshot` pins the
  version and every area falls back to "Not yet counted" until the rebuild lands.
