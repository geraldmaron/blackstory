# Ringer review: on-screen captions (v005 → v006)

Run per `.claude/skills/blackstory/ringer-review`. Six chairs, one pass, against
every caption and every place/year stamp. The client asked specifically for the
**community-perception** lens, so the Sympathetic Reader chair (the audience we
actually want) is weighted up alongside the Literalist. Captions in a video are
the purest case of bar rule 7: each must stand alone with zero surrounding prose.

Attack codes reference `docs/research/ringer-attack-taxonomy.md`.

## Findings

| # | Card | Chair · code | Caption as shipped in v005 | Severity | Fix | v006 caption |
|---|---|---|---|---|---|---|
| 1 | Ona Judge | Sympathetic · A7 | "slipped out of the presidential mansion in Philadelphia" | correction-forcing | qualify | "enslaved to Martha Washington, she escaped — and died free" |
| | | | *Out of context it reads as a caper. The fact that makes it history, her enslavement, is missing.* | | | |
| 2 | Tulsa | Sympathetic / Producer · A11 | "Postcard caption: 'Little Africa on fire.'" | correction-forcing | strike | "white mobs burned and looted more than 35 square blocks of Greenwood" (record: 100 Block North Greenwood Avenue) |
| | | | *The only words on screen about the massacre were the souvenir-maker's. It re-circulates the perpetrators' framing.* | | | |
| 3 | Seneca Village | Sympathetic | "a community of roughly 225 residents" | clip-friendly | qualify | "founded 1825; cleared by the city in 1857 to build Central Park" |
| | | | *Leaves out the point of the record, a Black landowning community erased for a park.* | | | |
| 4 | Du Bois plate | Producer · A11 | "“Value of land owned by Georgia Negroes”" | clip-friendly | qualify | "a hand-lettered exhibit charting Black land ownership in Georgia" |
| | | | *A 12-second clip shows the word as the ad's own, not the 1900 document's title. The title is still legible on the plate itself.* | | | |
| 5 | Du Bois | Literalist · A7 | stamp "Great Barrington · 1868" + "co-founded the NAACP in 1909" | correction-forcing | qualify | "born here; co-founded the NAACP in 1909" |
| | | | *Read together, the stamp and line say the NAACP was founded in Great Barrington in 1868.* | | | |
| 6 | Robert Smalls | Literalist · A7 | stamp "Beaufort · 1862" + "commandeered … CSS Planter" | correction-forcing | qualify | "born enslaved here; commandeered the Confederate steamer CSS Planter" |
| | | | *He seized the Planter in Charleston harbor, not Beaufort. The record's pin is his Beaufort birthplace.* | | | |
| 7 | Harriet Tubman | Literalist · A7 | stamp "Dorchester County · 1822" + "guiding about seventy people out of slavery" | clip-friendly | qualify | "born into slavery here; guided about seventy people out" |
| 8 | Phillis Wheatley | Literalist · A10 | stamp year 1761 + "first … to publish a book of poetry" | clip-friendly | qualify | stamp year → 1773 (book year, record). Superlative held: the record states it, and it's the standard claim (a *book*; Hammon's 1761 poem was a broadside). |
| 9 | Charles Drew | Literalist · A7 | stamp "Washington, D.C. · 1940" + "directed the 'Blood for Britain' program" | correction-forcing | qualify | "trained a generation of Black surgeons at Howard" (no year). Blood for Britain ran in New York. |
| 10 | Charles H. Turner | Literalist · A10 | "proving insects can hear, learn, and modify behavior" | clip-friendly | qualify | "showed insects can hear, learn, and change behavior". The 1907 stamp was the Chicago PhD, so the year is dropped and the place stays St. Louis, where he taught and researched. |
| 11 | Granville Woods | Literalist · A10 | "patented the multiplex telegraph" | clip-friendly | qualify | "patented the induction telegraph", the record's own alternate name and the 1887 patent's title |
| 12 | Blanche K. Bruce | Historian | "a full six-year term in the U.S. Senate" | correction-forcing | qualify | "the first African American to serve a full Senate term". Without "first" the line states nothing notable. |
| 13 | William Still | Sympathetic · A7 | "kept detailed written records of their journeys" | clip-friendly | qualify | "aided about 800 freedom seekers and published their records" (dangling "their" removed) |
| 14 | Carter G. Woodson | Producer · A11 | "Negro History Week — the seed of Black History Month." | clip-friendly | hold-with-response | unchanged. The proper name Woodson chose in 1926; removing it would erase the history the line is about. |
| 15 | Booker T. Washington (re-added) | Opposition / Sympathetic · A5 | "founded and led Tuskegee Institute" | clip-friendly | hold-with-response | factual, no superlative. The record's "most influential Black leader" is deliberately not used. |
| 16 | Madam C.J. Walker (re-added) | Literalist · A10 | — | avoided | — | "trained tens of thousands of Black sales agents". The contested "first self-made female millionaire" is not used. |
| 17 | W. H. Carney (re-added) | Literalist · A10 | — | avoided | — | "carried the regimental colors despite severe wounds". Not "first Black Medal of Honor" (awarded 1900; earliest *action*). |
| 18 | Frederick Douglass (added) | Literalist · A10 | — | avoided | — | "U.S. Marshal for D.C., the first African American to hold the post". The 1872 VP "nomination" is not used, because he never acknowledged it. |
| 19 | Isaiah T. Montgomery (considered) | Sympathetic · Historian | — | correction-forcing | strike | Not used. He was the only Black delegate at Mississippi's 1890 convention and voted for its disenfranchisement article; a celebratory montage slot would misrepresent him to the people who know that. |
| 20 | Line cards "Her / His / Their Story happened here." | Opposition · A5 | — | bounces | — | the product's own copy |
| 21 | Revels / Bruce stamp "Mississippi" (served in Washington) | Literalist | — | bounces | — | the state each represented, and the record's pin |

## Clip log (prepared responses)

- **Woodson / "Negro History Week."** The week was founded under that name by Carter
  G. Woodson in 1926 and is the documented origin of Black History Month. The ad
  quotes the historical proper noun from BlackStory's record.
- **Booker T. Washington.** The caption states only what is undisputed. His
  legacy is argued over, and the archive's record page is where that argument lives.
- **Every "first."** Each one is stated in the record the image comes from, and none
  is stronger than the record's wording.

## Verdict

**fix-then-ship.** Six correction-forcing findings (1, 2, 5, 6, 9, 12) and one
strike (19). All are fixed in v006 by the rewrites above. The clip-friendly
items are rewritten where the fix costs nothing true, or held with a response.
