<!--
  Plan of record for Lives Across the Decades: the six state-built regions, where every figure is
  sourced from in each era, and what the census could and could not see. Companion to
  docs/methodology/lives-across-decades.md (binding method). Decided 2026-09-15.
-->

# Lives Across the Decades: regions, sources and what the count could see

**Status:** Plan of record
**Date:** 2026-09-15
**Epic:** `repo-0clax`
**Method:** [lives-across-decades.md](../methodology/lives-across-decades.md)

## Decisions

1. **Six regions built from whole states, plus a national baseline.** They are not cities or counties.
2. **Figures come from published census tables,** not IPUMS microdata. IPUMS USA registration is no
   longer required.
3. **The data is a static, versioned build.** Tables are acquired, validated and loaded once, then frozen
   into a snapshot per region. Pages render from the snapshot. A rebuild happens only when a source
   vintage changes (a new ACS five-year release) or a correction lands. There is no live feed.
4. **What the census could not see is content, not a footnote.** Every decade carries a sourced account
   of who was counted, how, what is missing, and what that meant.

## Why these regions

The timeline exists so a reader can see how the same class, in the same decade, was lived differently
by Black, white and Hispanic Americans, and which rules governed those lives. The largest historical
divides in that experience are regional: the rural South against Northern cities, and the Southwest
and a handful of big cities for Hispanic Americans. County detail adds false precision, empty cells and
heavy transcription without changing that story.

- **Four census regions are too few.** They merge the Mississippi Delta with Virginia and Tejano Texas
  with Georgia, which are the contrasts the experience exists to show.
- **Eight to ten would split areas the published data cannot tell apart.** The Plains and Mountain
  states had small Black and, before 1970, small counted Hispanic populations, so those cells would be
  thin or suppressed and their stories largely repeat their neighbors'.
- **Six gives every region a distinct story for at least two of the three groups.**
- **Whole states keep the rules honest,** because segregation, covenant enforcement, disfranchisement
  and school law were state and local. A region can say "in 7 of 8 states" and name them.
- **Every state is assigned exactly once,** so the six regions sum to the published national totals.
  That sum is a validation check on every ingested figure.

**If exactly five is ever wanted,** merge the Deep South and the Upper South. The cost is the contrast
between plantation counties and the capital's Black middle class.

## The regions

States are as of 2020. Before statehood, a territory is included wherever the census enumerated it
(Oklahoma and Indian Territories before 1907, Arizona and New Mexico before 1912, Alaska and Hawaii
before 1959), and the region's comparability note says so.

| Region | States | Distinct story | Where the count sees clearly |
|---|---|---|---|
| **Deep South** | AL, AR, FL, GA, LA, MS, SC | Sharecropping, disfranchisement, the origin of the Great Migration; later Cuban Florida | Black and white in every era. Hispanic mostly from 1970 |
| **Upper South & the Capital** | DE, DC, KY, MD, NC, TN, VA, WV | Black colleges, federal employment, a Black middle class, border-state segregation | Black and white in every era. Hispanic late |
| **Texas & Oklahoma** | TX, OK | Jim Crow law on a borderland, Tejano history, oil | Black strong. Hispanic through the 1930 count, 1950–1960 Spanish surname, then 1970 on |
| **The West** | AK, AZ, CA, CO, HI, ID, MT, NV, NM, OR, UT, WA, WY | The Mexican American Southwest and California; the wartime Black migration West | Hispanic strongest and earliest. Black populations small before 1940 |
| **Midwest** | IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI | Great Migration destination, auto and steel, Mexican Chicago, deindustrialization | Black and white strong. Hispanic mostly from 1970 |
| **Northeast** | CT, ME, MA, NH, NJ, NY, PA, RI, VT | Harlem and Philadelphia, Puerto Rican migration | Black and white strong. Puerto Rican through the 1950–1960 reports |

**Place anchors.** Each region names two or three catalog places (for example Harlem, Bronzeville, the
Delta, East Los Angeles) with sourced local laws and stories. Anchors illustrate a region. Their
figures are the region's, never the city's.

## Where the figures come from

Regions are unions of states, so the sources do not change by region. Every figure is stored at state
level as published (`observed`), and region and national-baseline figures are sums or ratios of state
figures (`derived`, with their inputs recorded).

| Era | Source of record | Extraction | Status |
|---|---|---|---|
| 1870–1930 | Printed decennial volumes; *Negroes in the United States, 1920–32* (Census Bureau, 1935) | NHGIS county and state tables, checked against the volume page | NHGIS race tables verified for school attendance (1870, 1890), literacy (1900–1930), farm tenure by race (1900–1930), home value and rent by race (1930), unemployment by race (1930). Occupation by race: to verify per volume |
| 1940 | 1940 Census of Population volumes; *Characteristics of the Nonwhite Population by Race* | Transcription | Report existence verified. Geographic detail and wage-income-by-race tables: to verify |
| 1950 | 1950 Vol. II state parts; Vol. IV special reports (*Persons of Spanish Surname*, *Puerto Ricans in Continental United States*) | Transcription | Reports verified. Vol. II nonwhite detail covers only areas with 50,000+ nonwhite residents (search summary) |
| 1960 | Vol. I state parts; PC(2)-1B *Persons of Spanish Surname* (AZ, CA, CO, NM, TX); PC(2)-1C *Nonwhite Population by Race*; PC(2)-1D *Puerto Ricans in the United States* | Transcription, plus NHGIS tract files as a cross-check | Reports verified |
| 1970 | PC(2)-1B *Negro Population*; PC(2)-1C *Persons of Spanish Origin*; state PC(1)-C reports | NHGIS Count 4 county tables (race, Spanish indicator, housing for Negro and Spanish American households); transcription for income | Reports and NHGIS tables verified |
| 1980 | Summary Tape Files 2B (100-percent data), 3 and 4 | NHGIS extract | Loaded 2026-09-15 for the nation and every state: population and urban shares for non-Hispanic Black and white residents and people of Spanish origin, and homeownership (STF 2B); unemployment, family income brackets and the national median family income (STF 3); high school completion (STF 4, states only, so the national figure is summed from states) |
| 1990 | Summary Tape Files 2B, 3 and 4B | NHGIS extract | Loaded 2026-09-15 for the nation and every state: population and urban shares, and homeownership (STF 2B); household income brackets, high school completion and unemployment for Black, non-Hispanic white and Hispanic groups (STF 4B); the national median household income (STF 3) |
| 2000 | Summary Files 1 and 3 | NHGIS extract | Loaded 2026-09-15 for the nation and every state: population and urban shares, and homeownership (SF 1); household income brackets, high school completion, unemployment and the national median household income (SF 3) |
| 2010s, 2020s | ACS five-year detailed tables, 2008–2012 and 2019–2023 | NHGIS extract (datasets `*_ACS5a` and `*_ACS5b`); the Census API data endpoint now requires a key (checked 2026-09-15) | Verified: B03002 population, B19001B/H/I household income, B19013 national median, B25003B/H/I tenure, C15002B/H/I education, C23002B/H/I employment, for both vintages at nation and state level |

**Source of record.** Census Bureau publications and API tables are public domain (17 U.S.C. §105).
They are the cited source for every figure. NHGIS is used to extract and cross-check. Its terms
restrict redistributing its files, so a published figure cites the Census volume or API table it came
from, and the NHGIS table code is kept in provenance.

**National context** (national only, labeled as such): life expectancy (NCHS), the white-to-Black
wealth ratio (Derenoncourt, Kim, Kuhn and Schularick), turnout (CPS), imprisonment (BJS). These are
already ingested as spine series.

**Rules in force.** Federal laws and rulings apply to every region (22 rows are already published).
State and local rules are researched per region from session laws and state codes, U.S. Reports
(tile.loc.gov), federal and state court opinions, and city ordinances, through the catalog's research
lane. Each rule's in-force dates come from its cited claims.

## What published tables cannot show, and what the page does instead

| Limit | Why | On the page |
|---|---|---|
| Conditions within a class tier (for example homeownership among middle-income Black households) | Published tables do not cross income with other measures by race | Conditions are shown for each group. The tier choice changes the class shares only, and the page says why |
| Pew's size-adjusted tiers | Needs individual records | Income bands against the national median of the same unit (wages, families or households) in the same year, estimated within published brackets and labeled as estimated |
| Hispanic figures before the census counted Hispanic origin | See the next section | Figures begin where the count begins, by region. Earlier decades carry sourced narrative and laws |
| Detailed nonwhite characteristics for small states in 1950 | Published only for areas with 50,000+ nonwhite residents | A region figure states its coverage share, or is withheld if coverage is too low |
| Individual 1890 lives | Schedules destroyed in 1921 | Published 1890 totals are used; the loss is itself a count note |

## What the count could see

Verified so far. The research lane (in progress) extends this to every decade.

| Decade | Finding | Source |
|---|---|---|
| 1890 | A fire in the Commerce Department building on January 10, 1921 destroyed most of the 1890 population schedules; statistical compilations for the nation survived | National Archives, [1890 Census](https://www.archives.gov/research/census/1890) |
| 1930 | Enumerators were told to return a person of "White and Negro blood" as Negro "no matter how small the percentage," while Native American ancestry did not preclude being "white" | National Archives, [The 1930 Census in Perspective](https://www.archives.gov/publications/prologue/2002/summer/1930-census-perspective.html) |
| 1930 | "Mexican" was a race category for the only time; in prior censuses and in 1940, enumerators listed Mexican Americans as white | National Archives (as above); Pew, [Census History: Counting Hispanics](https://www.pewresearch.org/social-trends/2010/03/03/census-history-counting-hispanics-2/) |
| 1930 → 1940 | Scholarship attributes dropping the category to lobbying by Mexican Americans, LULAC and the Mexican government | *Journal of Policy History*, ["La Raza: Mexicans in the United States Census"](https://www.cambridge.org/core/journals/journal-of-policy-history/article/abs/la-raza-mexicans-in-the-united-states-census/2D20DBCD1360E3648DAB50A9ACBC525D) (**abstract not yet opened**) |
| 1950, 1960 | The only national Hispanic proxies were Spanish surname (five Southwestern states) and Puerto Rican birth or parentage | census.gov, [1960 PC(2)-1B](https://census.gov/library/publications/1965/dec/population-pc-2-1b.html), [1960 PC(2)-1D](https://www.census.gov/library/publications/1965/dec/population-pc-2-1d.html), [1950 Vol. IV](https://www.census.gov/library/publications/1953/dec/population-vol-04.html) |
| 1970 | Hispanic origin was first asked, on a sample; hundreds of thousands in the South and central regions were misclassified as Central or South American | Pew (as above) |
| 1980 | The Hispanic question moved to the form sent to all households | Pew (as above) |
| 1940 on | Demographic analysis estimates a net undercount of 5.4% overall and 8.4% for Black Americans in 1940; the Black–nonblack differential was 3.4 points in 1940 and 4.4 points in 1990 | National Academies, [Modernizing the U.S. Census, ch. 2](https://www.nationalacademies.org/read/4805/chapter/4) |

**What it means.**
- **Absence is a record of a choice.** Counting Mexican Americans as white removed them from the data in
  the same decades courts were asked whether discrimination against them existed. *Hernandez v. Texas*,
  347 U.S. 475 (1954), turned on recognizing them as a class apart.
- **The count carries weight.** House seats are apportioned from it, so people missed more often were
  represented less, and published Black figures carry a measured undercount from 1940 on.
- **Missing numbers never mean missing people.** Where the count is silent, the page uses sourced
  narrative and records instead of estimates.

## Validation

- **Published figures:** each value stores its table, cell, page or API query, retrieval date and
  content hash. Transcribed values are entered twice independently and reconciled, and rows must add
  to the table's own totals.
- **Region sums:** the six regions must reproduce the published national total for every measure the
  census publishes nationally, within rounding.
- **Estimated bands:** stored as derived measurements with the formula and every input row. The same
  interpolation must reproduce the published median within tolerance.
- **Count notes and rules:** Tier-1 or scholarly source opened and quoted; dates from cited claims only.
