<!--
  Methodology: the ruling on what NOTABILITY_CRITERIA must say for each entity kind, and why
  `documented_site` stopped being an acceptable default. Binds
  packages/domain/src/entity-status.ts (NOTABILITY_CRITERIA, NOTABILITY_RUBRIC),
  packages/domain/src/publication/release-builder.ts (inference and basis construction), and
  packages/ops-data/scripts/lib/incremental-publish.ts (the synthesized significance claim).
-->

# Notability rubric: what "why is this here" is allowed to say

**Status:** Ruling. Adopted 2026-09-09, and **applied** the same day — vocabulary (`repo-tfqrm`),
positive matching and mechanism (`repo-teb1z`, 3,304 records), and the dignity slice ahead of both
(`repo-90g0i`, 57 records). One step remains: `repo-o6k0c`, retiring `documented_site` as a
fallback against the residual this left. See *Sequencing*.
**Measured against:** active release `rel_20260723_authority_net_001`, 2026-09-09, 4,191 records
and 10,522 basis records.
**Re-measure with:** `packages/ops-data/scripts/audit-notability-basis.ts`
**Related:** [scholarship-principles.md](./scholarship-principles.md) §1 (naming and dignity),
`packages/domain/src/entity-status.ts`, bead `repo-kdmrc`

## The ruling in one paragraph

> **Applied 2026-09-09.** `documented_site` fell from 6,589 basis records to 1,767 and total basis
> records from 10,427 to 6,155. `enacted_law` 135, `court_precedent` 46 → 139,
> `movement_significance` 30 → 106, `black_press_or_archive` 52, `community_anchor` 4 → 49,
> `elected_or_appointed_office` 36, `documented_contribution` 19 → 35, `documented_racial_killing`
> 11. No criterion lost a record. `documented_racial_killing` was ratified by the maintainer before
> it was applied, and its text was extended to cover the event where such killings are documented,
> mirroring the clause `documented_racial_terror` already carried — otherwise the Orangeburg
> Massacre would have stayed a documented site while its three victims read as police killings.

`documented_site` is not a default and never was one. It is a positive claim that a reader can
walk to a place where something documented happened, and it is currently printed as the stated
reason for 63% of every record in the catalog — including nine people murdered at Emanuel AME,
every Supreme Court case, the Civil Rights Act of 1964, and the Chicago Defender. The fix is not
to choose a better per-kind default. **The rubric gets four new criteria, one text amendment, and
a mechanism change that stops a basis record from being an echo of every claim on the record.**
Where no criterion honestly fits, the record fails the publish gate instead of publishing a
sentence that is false.

## What the measurement showed

Two findings, and the second is the one that decides the shape of the fix.

### Finding 1 — the fallback is the system, not a fallback

| Criterion | Basis records | Share |
|---|---:|---:|
| `documented_site` | 6,661 | 63.3% |
| `landmark_or_national_register` | 2,704 | 25.7% |
| `first_to_do_x` | 691 | 6.6% |
| `only_or_oldest` | 165 | 1.6% |
| `documented_racial_terror` | 136 | 1.3% |
| `major_honor_or_hall_of_fame` | 60 | 0.6% |
| `court_precedent` | 46 | 0.4% |
| `movement_significance` | 36 | 0.3% |
| `documented_contribution` | 19 | 0.2% |
| `community_anchor` | 4 | 0.04% |

872 records — 457 places and 415 non-places, 21% of the catalog — have `documented_site` as their
*only* stated reason. They have no honest answer to "why is this here" at all.

### Finding 2 — every multi-kind criterion is in use on exactly one kind, usually the wrong one

This is the finding that rules out repairing the keyword ladder.

| Criterion | Kinds its ratified text names | Kinds it is actually used on |
|---|---|---|
| `court_precedent` | case, law, person | **place = 21**, person 6, institution 5, law 5, **case 4** |
| `movement_significance` | person, organization, event, place, movement | person 36, and nothing else |
| `community_anchor` | church, lodge, HBCU, mutual aid society | person 4, and nothing else |
| `documented_racial_terror` | person, and the event or place of the killing | person 136, **event 0** |
| `documented_contribution` | an invention, process, method or design | invention 19, **person 0** |

Twenty-one *places* are filed as judicial precedents and four actual court cases are.
`community_anchor`, whose text is written entirely about institutions, has never once been applied
to a school, institution or organization. Elijah McCoy and Granville Woods are not filed as
contributors. The Tulsa Race Massacre and the Colfax Massacre are not filed as racial terror.

The mechanism explains it: `inferNotabilityCriterionFromClaim` keyword-matches free-text claim
prose. There are **1,580 distinct claim predicates** behind the 6,661 fallback basis records —
roughly four basis records per distinct predicate. No keyword set covers a distribution with that
shape. Widening the ladder to catch `decided_on` fixes 42 records; the next thousand predicates
fix one or two each.

### What that produces on live pages

- **Susie Jackson**, murdered at Emanuel AME on 17 June 2015, states four reasons for inclusion:
  "Killed Susie Jackson." · "Date June 17, 2015." · "Location 110 Calhoun Street." · "Group
  Emanuel Nine." — all under a criterion whose ratified sentence says she is a documented site.
  All nine of the Emanuel Nine read this way. The earlier dignity pass (`repo-kdmrc`, 2026-09-09)
  could not reach them: `killed` is deliberately excluded from the racial-terror predicate set
  because "was killed in action" is Doris Miller.
- **Amadou Diallo** states, as a reason he is in this catalog, "Fired 41 shots." He was unarmed.
  The police fired 41 shots. The predicate + object grammar assumes the record's subject is the
  actor, which inverts agency on every killing record. **Sean Bell**: "Fired 50 bullets at a
  silver Nissan Altima."
- **Denise McNair, Addie Mae Collins, Carole Robertson and Cynthia Wesley**, killed in the 16th
  Street Baptist Church bombing, are filed under `movement_significance` — "played a documented,
  non-incidental role in a named movement." They were eleven and fourteen years old.
  **Breonna Taylor** is filed the same way.
- **Brown v. Board of Education** is in the catalog because it is a documented site.
- The **Tulsa Race Massacre** appears twice, as `disc_tulsa_race_massacre_q1824714` and
  `gap_tulsa_race_massacre`. So does CORE.

## The ruling

### A. `case` — keyword gap. No new vocabulary. (37 records)

`court_precedent` already fits and is already ratified. Match judicial-decision predicates
positively (`decided_on`, `held`, `issued ruling`, `struck down`, `affirmed`, `reversed`,
`overturned`) and let `kind === 'case'` be the fallback.

One amendment, because four records are trials rather than precedents — The Trial of Anthony
Burns, The Creole Case, The Amistad Case, Briggs v. Elliott (consolidated into *Brown*). Amend the
text to: *"...tied to a judicial decision — a ruling, an opinion, or a trial — that set binding or
widely cited precedent, or that was itself a documented turning point in how the law was applied
to Black Americans."*

### B. `law` — new criterion `enacted_law`. (22 records)

`court_precedent` says "a judicial decision." The Civil Rights Act of 1964 is not one. Filing it
there would state something false about every statute, amendment and executive order in the
catalog.

> **`enacted_law`** — The entity is a statute, constitutional amendment, executive order or
> ordinance whose enactment or enforcement materially changed the legal status, rights or
> conditions of Black Americans. The criterion is neutral as to direction and the record says
> which: the Mississippi Black Codes of 1865, the Fugitive Slave Act of 1850, the National
> Housing Act of 1934 and the Anti-Drug Abuse Act of 1986 are here because of the harm they
> codified, exactly as the Voting Rights Act of 1965 is here for what it dismantled. A law is
> never filed under a criterion that reads as an achievement.

That last sentence is load-bearing and is the same rule the racial-terror work established: the
reason a record exists must not be dressed as a credit to its subject.

### C. `person` holding office — new criterion `elected_or_appointed_office`. (~45 records)

The largest person cohort is the Reconstruction officeholders — Samuel Nuckles, Alonzo Sledge,
Emanuel Fortune, Hastings Gantt and about forty more, from
`packages/ops-data/scripts/discover-reconstruction-officeholders.ts`. Nothing fits them.
`first_to_do_x` is false (they were not firsts). `movement_significance` is false (Reconstruction
officeholding is not a named movement). They currently read as documented sites.

The grounding is external and specific. Eric Foner's *Freedom's Lawmakers: A Directory of Black
Officeholders During Reconstruction* (LSU Press, revised edition 1996) is the standard directory
of the more than 1,500 African Americans who held political office in the South during
Reconstruction, ranging from U.S. congressmen to local justices of the peace and constables. The
cohort is a documented historical phenomenon in its own right; holding the office **is** the
basis, not a step toward some other achievement.

> **`elected_or_appointed_office`** — The entity is a person documented as holding elected or
> appointed public office — legislative, executive, judicial or a commission — where the holding
> of that office is itself the documented fact. Eric Foner's *Freedom's Lawmakers* establishes the
> more than 1,500 Black officeholders of Reconstruction as a cohort recorded for the office they
> held, not for a separate achievement, and this criterion carries that reading forward. A
> professional or institutional post is not public office and does not qualify here.

The last sentence keeps "served as chief of neurosurgery" out. Alexa Canady's basis is
`first_to_do_x`, which is true of her and which the ladder is currently missing.

### D. The Black press and Black archives — new criterion `black_press_or_archive`. (~43 records)

Two cohorts with one reason. Eighteen newspapers — the Chicago Defender, the Pittsburgh Courier,
the Richmond Planet, the Norfolk Journal and Guide, the Green Book — and roughly twenty-five
museums, archives and research centers, from the Schomburg Center to NMAAHC to the Amistad
Research Center.

`community_anchor` is false for both: its text requires "a documented multi-decade role in a
specific community," the Defender was national and NMAAHC opened in 2016.

> **`black_press_or_archive`** — The entity created, preserved or interprets the documentary
> record of Black life: a Black-owned or Black-edited newspaper, periodical or guide; or an
> archive, library, research center or museum of Black history. These exist because the
> mainstream record excluded, distorted or ignored Black Americans — *Freedom's Journal* opened
> in 1827 with "We wish to plead our own cause. Too long have others spoken for us." The basis is
> the documented role in making or keeping that record, and it is a role this catalog depends on:
> these are the sources BlackStory itself cites.

### E. Killings — one text amendment and one new criterion. (~25 records)

`documented_racial_terror`'s existing text already covers "other extrajudicial racial killing"
and "the event or place where such a killing is documented." Two extensions follow from the text
as ratified, need no amendment, and should be applied:

1. **White-supremacist attacks.** The Emanuel Nine, the four girls killed at 16th Street Baptist
   Church, Vernon Dahmer, Emmett Till.
2. **Events.** The Tulsa Race Massacre, the Colfax Massacre, the Ocoee massacre, the 1866 Memphis
   massacre, East St. Louis, Elaine, Rosewood, Wilmington 1898. The criterion is used on zero
   events today.

   **Corrected 2026-09-09 while applying `repo-90g0i`:** this list first included the Orangeburg
   Massacre. It should not have. Orangeburg was state highway patrolmen firing on student
   protesters, so by this ruling's own distinction it belongs with Breonna Taylor under
   `documented_racial_killing`, not with Tulsa. The applied matcher excludes it.

Killings by police, or by a civilian claiming authority to use force, are a **separate criterion,
not an extension of that one**:

> **`documented_racial_killing`** — The entity is a person killed in a documented killing in which
> race is a documented element of the case — by police, by someone acting under a claim of
> authority or self-defense, or by a private individual — where the killing and the public record
> it produced are the reason the record exists. It is distinct from `documented_racial_terror`,
> which names the lynching era and the white-supremacist attack: the two rest on different
> documentary records — the Equal Justice Initiative's *Lynching in America* research on one side,
> and investigations, grand jury proceedings, federal findings and consent decrees on the other —
> and each record cites its own. As with racial terror, the basis is never an accusation made
> against the person killed.

Cohort: Eric Garner, Sean Bell, Amadou Diallo, Jordan Neely, Breonna Taylor, Trayvon Martin,
Michael Griffith. Small, and deliberately separate. Collapsing a killing by the state into "racial
terror" makes a category claim this catalog cannot source; leaving Breonna Taylor under
`movement_significance` says her reason for being here is a role she played in a movement, when
she was asleep in her apartment. **This is the one part of the ruling that is genuinely
contestable and it goes to explicit ratification before it is applied.**

### F. Kinds that need no new vocabulary — apply the criteria that already exist

| Cohort | Criterion | Records |
|---|---|---:|
| HBCUs, Rosenwald schools, Black churches, lodges, Divine Nine chapters, mutual aid, Black hospitals | `community_anchor` | ~70 |
| Movement and labor organizations (NAACP, CORE, COFO, MFDP, SCLC, MIA, Deacons for Defense, CBTU, NALC), marches, campaigns, and every `movement`-kind record | `movement_significance` | ~55 |
| Person inventors — McCoy, Woods, Morgan, Van Brittan Brown, Rillieux, Banneker, Joyner, Eglin | `documented_contribution` | ~10 |
| Desegregation-crisis schools and event sites — Little Rock Central, Clinton High, Mansfield High, Moton | `documented_site`, correctly | ~20 |

The last row matters: for a real minority of records `documented_site` is the right answer, and it
only looks wrong because it is also the fallback. Making it a positive-match-only criterion is
what lets it mean something again.

## The mechanism ruling

Vocabulary alone does not fix this. Three changes to how a basis record is built:

**M1. A basis record is a reason, not an echo of every claim.**
`buildReleaseNotabilityBasis` emits one basis record per distinct claim predicate, which encodes
the assumption that every claim is a reason for inclusion. It is not. "Architectural style Greek
Revival." "Buried at Lincoln Cemetery." "Collection size more than 35,000 artifacts." "Boarded
northbound F train." Emit basis records only for predicates a criterion positively identifies; if
none is identified, emit exactly one fallback record built from the record's strongest claim. The
Tulsa Race Massacre goes from six basis records to one.

**M2. `documented_site` becomes positive-match-only and stops being reachable as a fallback.**
Positive markers: `site_of`, `preserved as`, `stood at`, `located at the site of`, plus
`kind === 'place'`. A record that matches nothing gets no basis record, fails
`hasRequiredNotabilityBasis`, and is held from publication. That is the correct failure mode: a
gate satisfied by a sentence that means nothing certifies nothing.

**M3. The publisher stops manufacturing the fallback as a claim.**
`incremental-publish.ts:541` hardcodes `predicate: 'documented_site'` on every non-invention
record so the builder reads the word back as its own criterion — 238 basis records whose note
literally begins "Documented site". Remove it and let the record's real claims speak.

## Sequencing, and the control on the blast radius

M2 applied alone would drop 872 records — 21% of the catalog — out of the release. So it goes
last, and only after measurement.

1. **Now, ahead of everything.** The Emanuel Nine, the 16th Street Baptist Church four, and the
   agency inversion on killing records ("Fired 41 shots" on Amadou Diallo). This is the same
   defect the racial-terror pass was raised for, on a cohort that pass could not reach, and it
   does not wait for the rest of the ruling. `repo-90g0i` is **done** — 57 records, applied and
   verified on the page. `repo-39h6s` (agency inversion) is still open.
2. **Vocabulary** — `repo-tfqrm`, **done**. Add the four criteria to all four copies that must agree —
   `packages/domain/src/entity-status.ts`, `packages/schemas/src/public-projections.ts`,
   `packages/ops-data/src/firestore/types.ts`, and `NOTABILITY_CRITERION_LABELS` in
   `packages/domain/src/relevance/why-public-basis.ts`. Missing the fourth 404s records; see
   `repo-8x306`.
3. **Positive matching + M1 + M3** — `repo-teb1z`, **done**. Applied as a MERGE, never a
   replace: a straight recompute took `first_to_do_x` off Carter G. Woodson and Hattie McDaniel
   and `major_honor_or_hall_of_fame` off Denzel Washington and Katherine Johnson, because the
   published basis is not always derived from claims — earlier passes hand-authored criteria that
   no keyword reproduces. Every non-fallback criterion a record already carries is kept; only the
   `documented_site` records are up for replacement.
4. **M2 only then** — `repo-o6k0c`, the one step left — against a measured residual rather than
   an estimated one. That residual is now known: 1,767 basis records across place 1,009, person
   260, institution 132, event 104, school 102, organization 100, other 40. Records that still
   have no honest basis are a research gap to fill, not a default to invent.

Republishing rebuilds `related[]` — see `repo-66mv1` and commit `0f15aed3`.

## Not decided here

- **Military service.** ~~A fifth criterion is not yet earned.~~ **Superseded by the owner
  ruling of 2026-09-12 (bead `repo-ytq3n`): the criterion is earned and is now
  `documented_military_service`.** What changed the answer was measuring the residue rather than
  the cohort: the 91st United States Colored Infantry, the Golden Thirteen, the Black Seminole
  Scouts, Lewis Broadus and Prince Romerson were all still resting on `documented_site` alone
  — the honest-but-wrong fallback this whole document exists to retire — and neither
  `first_to_do_x` nor `major_honor_or_hall_of_fame` was true of them without stretching.
  `elected_or_appointed_office` covers a commission but not enlisted service, which is exactly
  the gap. See section H.
- **The `other` kind.** Eleven records: plantations, the *Clotilda*, Nat Turner's rebellion,
  "history of slavery in Colorado", "Hidden Figures". Heterogeneous, and a kind-assignment problem
  rather than a rubric problem. Bead `repo-ytq3n`.
- **Duplicate live records.** Tulsa Race Massacre and CORE each appear twice. Bead `repo-ytq3n`.
- **Places.** 457 place records have `documented_site` as their only reason. For a place the
  sentence is at least not false, so it is out of scope here — but "it is a site" is a
  near-tautology for a place and those records are carrying no real inclusion reason either.

### H. Military service — new criterion `documented_military_service`. (~5 records measured)

Added by owner ruling 2026-09-12, after section G's open-items list had recorded the opposite
conclusion. The trigger was not a new cohort but a measurement: the records this was meant to
cover had not moved off `documented_site`, so the "not yet earned" verdict was leaving five
published records carrying a reason that is a near-tautology for a place and plainly false for a
regiment.

Scope is deliberately narrow. Service alone is not a basis — most people who served are not in
this catalog, and should not be. The basis is service that carried institutional weight: a
segregated or newly integrated formation, a first commission or enlistment that broke a service's
color line, or a unit raised specifically from Black or Black and Native soldiers.

> **`documented_military_service`** — The entity (a person, unit or regiment) has a documented
> record of military service that is itself the reason it is here: service in a segregated or
> newly integrated formation, a first commission or enlistment that broke a service's color line,
> or a unit raised specifically from Black or Black and Native soldiers. Service alone is not the
> basis — the record has to show the service carried that weight.

Operational note from the same session: this criterion was written into live data before the enum
that validates it existed in `@repo/schemas`, and the five affected rows silently failed
`mapPostgresSearchIndexRow` and were dropped from the published `search-index.json` (the publisher
reported "5 unmappable search rows dropped" and kept going). A new criterion is three coordinated
edits — `NOTABILITY_CRITERIA`, `NOTABILITY_RUBRIC`, and the zod enum in
`packages/schemas/src/public-projections.ts` — plus `NOTABILITY_CRITERION_LABELS`, and the pinned
count in `entity-status.test.ts`. Land all of them before writing the data.

## Source verification

| Source | Status |
|---|---|
| Eric Foner, *Freedom's Lawmakers*, LSU Press revised ed. 1996 — publisher description | Opened, `lsupress.org/9780807120828` |
| 36 CFR 60.4, National Register criteria A–D | Opened, Cornell LII transcription `law.cornell.edu/cfr/text/36/60.4`; the CFR is the authority |
| EJI, *Lynching in America* | Established in-repo by the racial-terror pass |
| *Freedom's Journal* 1827 founding statement; LoC African American newspapers collection | **Not opened** — loc.gov and britannica.com both returned 403 to the fetch tool. Verify before the `black_press_or_archive` text is ratified. |

The NRHP criteria are cited as precedent for one specific move: Criterion B admits a property for
being "associated with the lives of persons significant in our past" — an association criterion,
not an achievement criterion. `elected_or_appointed_office` and `documented_racial_killing` are
association criteria in the same sense, and the federal register has carried that distinction
since 1966.
