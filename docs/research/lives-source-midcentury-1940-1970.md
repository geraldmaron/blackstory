# Citable sources for the mid-century holes, 1940-1960, plus the 1969 national median

**Date:** 2026-09-15
**Scope:** research only. Nothing in the repository was touched.
**Method:** every source below was downloaded from `www2.census.gov` and opened — either as
extracted text (`pdftotext -layout`) where the scan carries an OCR layer, or as rendered page
images where it does not. Table numbers, captions, universes, race wording and page numbers are
read off the page itself, never off a catalog record. Anything I could not open is marked
**unverified** and says so.

---

## Headline

Five of the six gaps close with published Census Bureau tables at **state level**. The sixth
(1939 income by race) has no state-level publication and closes only at national level. The 1969
median is **found**.

The single most important finding: **the 1960 PC(1)-C state parts carry 1940, 1950 and 1960 side
by side, crossed by color, in three tables with identical numbering in every state part.** That
one series closes gaps 1 and 2 for all three decades and gap 3 for 1959, across all 50 states and
DC, without touching the 1940 or 1950 population volumes at all.

| Gap | Best source | Geography | Tier |
|---|---|---|---|
| 1. High school completion by race, 1940/1950/1960 | 1960 PC(1)-C, Table 47 | all states + DC | A |
| 2. Unemployment by race, 1940/1950/1960 | 1960 PC(1)-C, Table 53 | all states + DC | A |
| 3. Income by race, 1959 | 1960 PC(1)-C, Table 65 (families) | all states + DC | A |
| 3. Income by race, 1949 | 1950 Vol. II, Table 32a (families + unrelated individuals) | **some states only** | A |
| 3. Income by race, 1939 | 1940 *Families*, Table 12 | **nation only** | A |
| 4. Home tenure by race, 1950 | 1950 Census of Housing Vol. I, Table 2 | all states | A |
| 4. Home tenure by race, 1960 | 1960 Census of Housing Vol. I, Tables 8/9 (state chapters), 22-29 (US Summary) | all states | A |
| 5. Farm tenancy by race, 1940 + 1950 | 1950 Census of Agriculture Vol. II, Ch. XI, Tables 22 and 27 | all states | A |
| 6. 1969 national median family income | 1970 PC(1)-C1, Table 83 — **$9,590** | nation | A |

---

## THE 1969 MEDIAN — YES

**Found, and it also hands over the 1959 median for free.**

**U.S. Bureau of the Census, *Census of Population: 1970*, Vol. I, *Characteristics of the
Population*, Part 1, *United States Summary*, Section 1. U.S. Government Printing Office,
Washington, D.C., 1973.**
URL opened: `https://www2.census.gov/library/publications/decennial/1970/population-volume-1/1970a_us1-10.pdf`
(the report's own suggested citation is on p. II of `…/1970a_us1-01.pdf`)

**Table 83 — "Income in 1969 and 1959 of Families and Unrelated Individuals by Race: 1970 and
1960," pp. 1-377 to 1-378.**

Values read off the page, `Families` / `Total` column:

| | 1969 | 1959 |
|---|---|---|
| **Total** | **$9,590** | **$5,660** |
| White | $9,961 | $5,893 |
| Negro and other races | $6,308 | $3,161 |
| Negro | $6,067 | (1960 shown only for "Negro and other races") |

- **Geography:** United States, with Urban / Rural nonfarm / Rural farm columns. National only, which
  is what this figure is wanted for.
- **Universe:** Families. The table also carries Unrelated individuals in a parallel block — do not
  mix them; the 1970 bands the timeline already holds are families, so the families median is the
  right threshold.
- **Race, in the volume's words:** `TOTAL`, `WHITE`, `NEGRO AND OTHER RACES`, `NEGRO`. The 1960
  panel stops at "Negro and other races"; there is no 1960 "Negro" row.
- **Basis:** headnote reads "Data based on sample."
- **Tier A.** A published Census Bureau table, and — the point that matters for the method — it is
  in *the same publication series as the 1970 bands*, so the threshold and the distribution share a
  vintage and a universe.

Cross-checks I opened in the same volume:
- **Figure 76, p. 1-357**, "Median Income in 1969 of Families, By States," prints
  `UNITED STATES AVERAGE $9,590` and gives all 50 states + DC as a chart (Alabama $7,266,
  Mississippi $6,071, Connecticut $11,811, and so on). Useful as a sanity check on any state figure,
  though it is a figure, not a table.
- **Figure 74, p. 1-356**, median income in 1969 of families by race of head, by the four census
  regions: White $10,721 / Negro and other races $7,603 (Northeast); $10,298 / $7,792 (North
  Central); $8,721 / $4,836 (South); $10,374 / $8,138 (West).

**Caution on a rival number.** *Historical Statistics of the United States* (1975), Series G 205-256,
"Median Money Income of Families, by States: 1949, 1959, and 1969," prints the U.S. 1959 figure as
$5,660 — matching Table 83 exactly — but its 1969 figure OCRs as **$9,586**, not $9,590. I could not
resolve whether that is a scan artifact or a genuinely revised figure without rendering that page
image, which I did not do. **Use $9,590 from PC(1)-C1 Table 83** and treat the Historical Statistics
value as an unresolved four-dollar discrepancy, not as a correction.

---

## GAP 1 — High school completion by race, 1940, 1950, 1960

### Primary, state level: 1960 PC(1)-C, Table 47 — covers all three decades at once

**U.S. Bureau of the Census, *U.S. Census of Population: 1960*, Vol. I, *Characteristics of the
Population*, Part 2, Alabama (and the parallel part for each State). U.S. Government Printing
Office, Washington, D.C., 1963.**
URLs opened: `https://www2.census.gov/library/publications/decennial/1960/population-volume-1/vol-01-02-e.pdf`
(Alabama, chapter C) and `…/24989706v1p47ch4.pdf` (Vermont, chapter C).

**Table 47 — "YEARS OF SCHOOL COMPLETED BY PERSONS 25 YEARS OLD AND OVER, BY COLOR AND SEX, FOR THE
STATE, URBAN AND RURAL, 1960 AND 1950, AND FOR THE STATE, 1940."** Alabama: pp. 2-125 to 2-126.
Vermont: p. 47-54. Listed in the chapter C "LIST OF TABLES" at p. 2-113 (Alabama) and p. 47-45
(Vermont).

- **Geography:** the State, plus Urban / Rural total / Rural nonfarm / Rural farm for 1960 and 1950;
  **the State only for 1940** (no urban-rural split by color in the 1940 panel). One volume part per
  State: parts 2-53 cover the 50 States and DC.
- **Coverage:** I verified the table number, caption and by-color crossing in **both** a
  high-nonwhite state (Alabama) and the lowest-nonwhite state I could pick (Vermont). The chapter C
  table numbering is identical in the two. Treat it as uniform across all state parts; a cheap
  enumeration pass over the 51 list-of-tables pages would confirm it outright.
- **Census years:** 1960, 1950, 1940 in one table.
- **Universe:** persons 25 years old and over. Footnote: "INCLUDES PERSONS NOT REPORTING ON YEARS OF
  SCHOOL COMPLETED." The percent-distribution half of the table is footnoted "PERCENT BASED ON TOTAL
  REPORTING" for the 1950 and 1940 panels — so the denominators differ between the count half and
  the percent half. Take counts and compute the share yourself.
- **Columns:** None / Elementary 1-4, 5-6, 7, 8 / High school 1-3, **4** / College 1-3, 4 or more /
  Median school years completed. "Four years of high school or more" = the `High school 4` column
  plus both college columns.
- **Race, in the volume's words:** `WHITE` and `NONWHITE`. **This is the nonwhite slice, not Negro.**
  There is no Negro row anywhere in Table 47.
- **Suppression rule, printed in the headnote:** "Percent not shown where less than 0.1; percent and
  median not shown where base is less than 200 in 1960, 500 in 1950, or 100 in 1940."
- **Tier A.** Published Census Bureau table; stores as `observed`.

### Corroborating, state level: 1950 Vol. II, Table 20 (1950 and 1940)

**U.S. Bureau of the Census, *U.S. Census of Population: 1950*, Vol. II, *Characteristics of the
Population*, Part 2, Alabama / Part 45, Vermont. GPO, 1952.**
URLs opened: `https://www2.census.gov/library/publications/decennial/1950/population-volume-2/37778831v2p2ch3.pdf`
and `…/41601747v2p45ch2.pdf`.

**Table 20 — "Years of school completed by persons 25 years old and over, by color and by sex, for
the State, urban and rural, 1950, and for the State, 1940."** Alabama p. 2-36; Vermont p. 45-19.
Present in **both** state parts, so this crossing was not dropped for low-nonwhite states.

An independent second reading of the same 1950 and 1940 cells. Race words: color, i.e.
white / nonwhite. **Tier A.**

Also in the 1950 volumes, Chapter C **Table 65** — "Years of school completed by persons 25 years
old and over, by age, color, and sex, for the State, 1950 and 1940, and for urban and rural areas,
and for standard metropolitan areas and cities of 100,000 or more, 1950" (Alabama p. 2-162). **But
this one is state-dependent:** Vermont's Table 65 reads "…by age and sex…" with **no color**
(Vermont p. 45-62). Use Table 20, not Table 65, if you want uniform coverage.

### National baseline: 1970 PC(1)-C1, Table 75 — a 1940-to-1970 retrospective

`https://www2.census.gov/library/publications/decennial/1970/population-volume-1/1970a_us1-10.pdf`

**Table 75 — "Years of School Completed of Persons 25 Years Old and Over by Race and Sex: 1940 to
1970," p. 1-368.**

- **Geography:** United States, with Urban / Rural nonfarm / Rural farm for 1970 only; the 1960,
  1950 and 1940 panels are US totals. Nation only — fills 1 of the 7 areas.
- **Race blocks:** `TOTAL`, `WHITE`, `NEGRO AND OTHER RACES`, `NEGRO`. **The `NEGRO` block has 1970,
  1960 and 1950 rows but no 1940 row** — 1940 exists only as "Negro and other races."
- **Headnote, verbatim:** "Data for racial groups in 1950 and all data for 1940 exclude Alaska and
  Hawaii." That matters if you sum states into the West region.
- Same column structure as 1960 Table 47, including the `High school 4` column and a median.
- **Tier A.** Best used as a national check on the summed state figures, not as the source of them.

### Region-level, Black-labeled: CPR P-23 No. 80, Table 70

**U.S. Bureau of the Census, *The Social and Economic Status of the Black Population in the United
States: An Historical View, 1790-1978*, Current Population Reports, Special Studies Series P-23,
No. 80. GPO, 1979.**
URL opened: `https://www2.census.gov/library/publications/1979/demographics/p23-080.pdf`

**Table 70 — "Level of Schooling Completed for Persons 25 Years Old and Over, by Region: 1940,
1960, 1970, and 1975."** Areas: United States / South / North and West. Black. Columns include
"4 years of high school or more" as a percent of total population, and median school years.

- **1950 is absent** from this table. Its area breakdown is United States, South, North and West.
- **This does not map onto the timeline's six regions** and cannot be summed into them. Useful only
  as a national cross-check and as narrative context.
- **Tier A** (a Census Bureau publication), but geographically unusable for the surface.

---

## GAP 2 — Unemployment by race, 1940, 1950, 1960

### Primary, state level: 1960 PC(1)-C, Table 53 — all three decades, rate already computed

Same volumes as Table 47.

**Table 53 — "EMPLOYMENT STATUS, BY COLOR AND SEX, FOR THE STATE: 1940 TO 1960."** Alabama
p. 2-131; Vermont p. 47-60.

- **Geography:** the State only (no urban-rural). One part per State; verified in Alabama and
  Vermont.
- **Column structure:** three year blocks — 1960, 1950, 1940 — each split `TOTAL` / `WHITE` /
  `NONWHITE`.
- **Row structure:** POPULATION, ALL AGES; TOTAL, 14 YEARS OLD AND OVER; LABOR FORCE; PERCENT OF
  TOTAL; ARMED FORCES; CIVILIAN LABOR FORCE; EMPLOYED; UNEMPLOYED; **PERCENT OF CIVILIAN LABOR
  FORCE**; NOT IN LABOR FORCE. Repeated for Both sexes, Male, Female.
- **Universe:** persons **14 years old and over**. Note this against 1970 and later, which use 16
  and over. The unemployment rate as published is unemployed as a percent of the **civilian** labor
  force — the row is printed, so no derivation is needed.
- **Race, in the volume's words:** `WHITE` / `NONWHITE`. Nonwhite slice again, not Negro.
- **Suppression rule, printed:** "Percent not shown where less than 0.1 or where base is less than
  200 in 1960 or 100 in 1950 and 1940."
- Worked example read off the Alabama page: nonwhite unemployment as a percent of the civilian
  labor force was 11.3 (1940), 5.4 (1950), 8.4 (1960); white 12.7, 3.6, 4.7.
- **Tier A.**

**Table 52** in the same chapter — "EMPLOYMENT STATUS AND SELECTED LABOR FORCE CHARACTERISTICS, BY
COLOR AND SEX, FOR THE STATE, URBAN AND RURAL: 1960" (Alabama p. 2-130, Vermont p. 47-59) — adds the
urban / rural nonfarm / rural farm split for 1960 only, with the same white/nonwhite crossing.

### Corroborating, state level: 1950 Vol. II, Tables 25 and 27

**Table 27 — "Employment status by color and sex, for the State: 1950 and 1940."** Alabama p. 2-40;
Vermont p. 45-23. Present in both.
**Table 25 — "Employment status by color and sex, for the State, urban and rural: 1950."**
Alabama p. 2-39; Vermont p. 45-22.
**Table 26 — "Labor force, 1950 and 1940, and gainful workers, 1930 and 1920, by color and sex, for
the State."** Alabama p. 2-40 — reaches back two more decades on the labor-force side. **Tier A.**

### The one place 1940 is published as *Negro*, at state level

**U.S. Bureau of the Census, *Sixteenth Census of the United States: 1940. Population*, Vol. III,
*The Labor Force*, Part 2. GPO, 1943.**
URLs opened: `https://www2.census.gov/library/publications/decennial/1940/population-volume-3/33973538v3p2ch1.pdf`
(introduction) and `…/33973538v3p2ch2.pdf` (Alabama contents p. 9; Table 1, p. 11).

**Table 4 — "Employment status of the population, by race and sex, for the State, and for cities of
100,000 or more: 1940,"** p. 12 of each state bulletin.

The introduction states the rule in its own words (p. 1): "Statistics on employment status and
occupation for States and all cities of 100,000 or more, and data on employment status and industry
for all States, are presented according to three racial groups: White, Negro, and 'Other races.'"
It adds that "For Southern States and cities, and for 16 cities in Northern and Western States, the
statistics in most of the tables are presented separately for nonwhites."

- **This is the only state-level 1940 employment-status table I found that publishes a true `Negro`
  category** rather than `Nonwhite`. If the project wants the Black slice for 1940 rather than the
  nonwhite slice, this is the table.
- **Table 1** (p. 11), which I opened, is the companion: "Employment status of the population, by
  color and sex, for the State, urban and rural, and by sex for cities of 100,000 or more: 1940."
  Its row blocks are `THE STATE` (total) and `Nonwhite` — white is a residual, not a printed row.
- **Universe:** persons 14 years old and over; employed / seeking work split further into
  "experienced workers" and "new workers," and employment excludes public emergency work, which is
  shown as its own category. That WPA/NYA/CCC carve-out is a real 1940 definitional quirk and has to
  be decided and stated before any 1940 rate is computed.
- **Tier A.** Note the volume has no OCR text layer; it must be read as page images.

### National, 1940-1970 in one table: 1970 PC(1)-C1, Table 77

**Table 77 — "Employment Status by Sex and Race: 1940 to 1970," p. 1-371.**
Race blocks `TOTAL`, `WHITE`, `NEGRO AND OTHER RACES`, `NEGRO`; year rows 1970, 1960, 1950, 1940;
columns Total / Labor force / Armed Forces / Civilian labor force / Employed / Unemployed / Not in
labor force, for Male and Female, 14 years old and over. Headnote: "Data based on sample."

**Trap:** in the `NEGRO` block the **1940 row prints (NA) for employed and unemployed**. 1940 Negro
unemployment is not available from this table; only "Negro and other races" is. Footnote: "For years
prior to 1960, excludes data for Alaska and Hawaii."
**Table 78**, p. 1-372, "Labor Force Status by Age, Race, and Sex: 1940 to 1970," carries the sample
bases: 1970 = 20-percent, 1960 = 25-percent, 1950 = 3⅓-percent, 1940 = 5-percent. Record those in
provenance. **Tier A, nation only.**

---

## GAP 3 — Income by race, 1940, 1950, 1960

This gap splits three ways, and only the 1960 leg closes cleanly at state level.

### 1959, families, state level — closed

**1960 PC(1)-C, Table 65 — "INCOME IN 1959 OF FAMILIES AND UNRELATED INDIVIDUALS, BY COLOR, FOR THE
STATE, URBAN AND RURAL: 1960."** Alabama p. 2-140; Vermont p. 47-69. Present in both state parts.

- **Structure:** three column blocks — `TOTAL`, `WHITE`, `NONWHITE` — each with The State / Urban /
  Rural nonfarm / Rural farm. Two row blocks: **`FAMILIES AND UNRELATED INDIVIDUALS`** and
  **`FAMILIES`** separately. Bands: Under $1,000; $1,000-$1,999 … $15,000-$24,999; $25,000 and over;
  then **MEDIAN INCOME**.
- **Universe:** total money income in 1959. The `FAMILIES` block is exactly the universe the
  `family_income` regime wants.
- **Race:** `WHITE` / `NONWHITE`.
- **Headnote:** "Percent not shown where less than 0.1; percent and median not shown where base is
  less than 200."
- Read off the Alabama page: 1959 median family income $3,937 total, $4,764 white, $2,009 nonwhite.
- **Tier A.** Pairs directly with the national 1959 median of **$5,660** from 1970 PC(1)-C1 Table 83
  above, so the 1960 income condition is fully specifiable.

### 1949, families, state level — partial coverage, and the unit is not clean

**1950 Vol. II, Chapter B, Table 32a — "INCOME IN 1949 OF WHITE AND NONWHITE FAMILIES AND UNRELATED
INDIVIDUALS, FOR THE STATE, URBAN AND RURAL: 1950."** Alabama p. 2-47.
URL opened: `https://www2.census.gov/library/publications/decennial/1950/population-volume-2/37778831v2p2ch3.pdf`

- **Structure:** two column blocks, `White` and `Nonwhite`, each with The State / Urban and rural
  nonfarm total / Urban / Rural nonfarm / Rural farm. Rows: Total; Number reporting; bands from
  Less than $500 through $10,000 and over; Income not reported; **Median income**; then a percent
  distribution.
- **Basis:** "Based on 20-percent sample. Percent not shown where less than 0.1; median and percent
  not shown where base is less than 500."
- **Read off the Alabama page:** 1949 median $2,056 white, $882 nonwhite.
- **TRAP 1 — the unit.** This table's universe is **families *and* unrelated individuals combined**.
  There is no by-color split of families alone for 1949 at state level. Table 32 (p. 2-46) separates
  families from unrelated individuals but is **not** crossed by color. So the 1949 by-color figure is
  not on the same universe as the 1959 figure from 1960 Table 65, and a 1949→1959 change computed
  across the two would be comparing different things. State this in the methodology note or use
  Table 67 below instead.
- **TRAP 2 — partial state coverage, confirmed.** Table 32a is **present in Alabama and absent in
  Vermont.** Vermont's chapter B list of tables (p. 45-9) runs …31, 32, 33… with no 32a. The
  "a"-suffix tables (28a, 30a, 32a, 42a, 45a, 48a, 49a) were printed only for states with a large
  enough nonwhite population; the printed volumes do not state the threshold on the pages I read.
  **Before this is loaded, someone must enumerate which of the 51 state parts actually carry Table
  32a**, and the timeline must record a partial-coverage share for every region that is short a
  state. This is one cheap pass over 51 list-of-tables pages.

**Better-covered alternative for 1949, at the cost of changing the unit:**
**1960 PC(1)-C, Table 67 — "INCOME IN 1959 AND 1949 OF PERSONS, BY COLOR AND SEX, FOR THE STATE,
URBAN AND RURAL: 1960 AND 1950."** Alabama p. 2-143; Vermont p. 47-72. **Present in both.**
Universe: persons 14 years old and over, total money income, `WHITE` / `NONWHITE` blocks with
`MEDIAN INCOME` rows, 1959 and 1949 side by side. Footnote: "TOTAL INCLUDES PERSONS NOT REPORTING ON
INCOME; PERCENT BASED ON TOTAL REPORTING." Headnote: "percent and median not shown where base is
less than 200 in 1960 or 500 in 1950."
This is **persons, not families** — so it does not fit the `family_income` regime — but it is
uniform across all state parts and puts 1949 and 1959 on one page under one definition. If the owner
is willing to let the 1950s decade run on a person-income measure, this closes the 1949 leg with no
coverage hole.

### 1939, wage or salary income by race — no state-level publication exists

I looked in the three places it could have been and it is in none of them at state level.

**Where it actually is, at national level:**

**U.S. Bureau of the Census, *Sixteenth Census of the United States: 1940. Population: Families*.
GPO.** URL opened:
`https://www2.census.gov/library/publications/decennial/1940/population-families/41272167ch1.pdf`
**Table 12 — "FAMILIES BY FAMILY WAGE OR SALARY INCOME AND RECEIPT OF OTHER INCOME IN 1939, BY
MARITAL STATUS, AGE, COLOR, AND SEX OF HEAD IN 1940, FOR THE UNITED STATES, URBAN AND RURAL."**

- **Geography:** United States, urban and rural. **Nation only.**
- **Universe:** families, classified by family wage or salary income in 1939 and by receipt or
  non-receipt of other income. Statistics based on "Sample D."
- **Race:** color, i.e. white / nonwhite, of the head.
- **Tier A.** This is the closest published match to the `wage_income` regime — family-level, wage
  or salary, 1939, by color — and it fills the national baseline only.

**U.S. Bureau of the Census, *Sixteenth Census of the United States: 1940. Population and Housing:
Families, General Characteristics*. GPO, 1943.** URL opened:
`https://www2.census.gov/library/publications/decennial/1940/population-and-housing-families/41272176ch01.pdf`
**Table 17 — "FAMILIES BY FAMILY WAGE OR SALARY INCOME AND RECEIPT OF OTHER INCOME IN 1939, BY
TENURE IN 1940, FOR THE UNITED STATES, BY REGIONS, URBAN AND RURAL (WITH NONWHITE FOR THE SOUTH)."**

- **Geography:** United States and the four census regions — but the nonwhite detail is printed
  **for the South only**, as the caption says in the volume's own words. Bands run None, $1-$199,
  $200-$499 … $5,000 and over, Not reported, crossed by owner/tenant.
- **Tier A,** but its one race-bearing cell is a single region that does not match any of the
  timeline's six.

**Also national, and it reaches 1939 by race:**
*Historical Statistics of the United States, Colonial Times to 1970*, Bicentennial Edition, Part 1,
Chapter G. U.S. Bureau of the Census, 1975. URL opened:
`https://www2.census.gov/library/publications/1975/compendia/hist_stats_colonial-1970/hist_stats_colonial-1970p1-chG.pdf`
**Series G 372-415 — "Median Money Wage or Salary Income of All [workers with wage] or Salary
Income, and of [Year-]Round Full-Time Workers, by Sex, Race, and Major Occupation Group:
1939-1970."** Race columns `White` and `Negro and other races`. Nation only, and the unit is
**workers**, not families. **Tier A** (a Census Bureau publication) with a methodology note, since
it is a compendium reprint rather than the original census table.

---

## GAP 4 — Home tenure by race, 1950 and 1960

### 1950 — closed at state level, and with a real `Negro` category

**U.S. Bureau of the Census, *U.S. Census of Housing: 1950*, Vol. I, *General Characteristics*,
Part 2 (state chapters). GPO.**
URL opened: `https://www2.census.gov/library/publications/decennial/1950/housing-volume-1/36965082v1p2ch01.pdf`
(Alabama chapter; this scan carries an OCR text layer.)

**Table 2 — "OCCUPANCY, TENURE, AND RACE OF OCCUPANTS, FOR THE STATE, URBAN AND RURAL: 1950."**

- **Geography:** The State / Urban and rural nonfarm total / Urban / Rural nonfarm / Rural farm.
  One chapter per state.
- **Rows read off the page:** All dwelling units; Occupied dwelling units; **Owner occupied** split
  `White` / `Negro` / `Other races`; **Renter occupied** split the same way. Counts and percent
  distribution.
- **Race, in the volume's words:** `White`, `Negro`, `Other races` — a genuine three-way race split,
  not white/nonwhite. This is the best mid-century tenure source for the Black lens.
- **Definitional axis: race of *occupants*, not of the householder.** Same axis as 1940, and
  therefore a real break against 1980-2020, which count by race of householder. The break is already
  in the project's trap list; this source keeps it on the 1940 side.
- **Companion:** Table 3 — "OCCUPIED DWELLING UNITS BY TENURE AND COLOR OF OCCUPANTS, FOR THE STATE,
  URBAN AND RURAL" (white/nonwhite version of the same cut). Tables 7, 9, 10, 11 and 15 carry other
  characteristics by color of occupants; Table 8 is "PLUMBING FACILITIES FOR ALL DWELLING UNITS AND
  DWELLING UNITS OCCUPIED BY NONWHITE PERSONS."
- **Tier A.**

### 1960 — closed at state level, but the definitional axis moves

**U.S. Bureau of the Census, *U.S. Census of Housing: 1960*, Vol. I, *States and Small Areas*. GPO.**
URLs opened: `https://www2.census.gov/library/publications/decennial/1960/housing-volume-1/41962442v1p2ch1.pdf`
(Part 2 introduction, pp. XV-XVI) and `…/41962442v1p2ch2.pdf` (Alabama list of tables, p. 2-1).

From the state chapters:
- **Table 2 — "Tenure, vacancy status, and condition and plumbing facilities, for the State, inside
  and outside SMSA's, urban and rural: 1960"** (Alabama p. 2-6). All households.
- **Table 8 — "Selected characteristics of housing units with nonwhite household heads, for the
  State, SMSA's, and places of 10,000 inhabitants or more: 1960"** (Alabama p. 2-12).
- **Table 9 — "Tenure, condition and plumbing facilities, and structural characteristics of housing
  units with nonwhite household heads, for the State, inside and outside SMSA's, urban and rural:
  1960"** (Alabama p. 2-13).

**Coverage restriction, stated by the volume itself** (Part 2 introduction, p. XVI, verbatim):
"Tables 8 to 11 are similar in content to tables 1 to 7 but are restricted to housing units with
nonwhite household heads. **Tables 9 to 11 are omitted for States having fewer than 25,000 units
with nonwhite household heads.**" Table 8 is not named in that exclusion, so it appears to be
present for every state, but I did not open a low-nonwhite state's chapter to confirm — **treat
Table 8's universality as unverified.**

**The efficient route for 1960 is the US Summary volume, not 51 state chapters.** The same
introduction says: "Tables 22 to 29, covering data for the United States, regions, divisions, and
States, are restricted to units with nonwhite household heads. Tables 22 and 23 parallel tables 1
and 2 … tables 24 to 26 parallel tables 3 to 8 and 9 to 14, respectively." So **Vol. I, Part 1,
United States Summary, Table 23** gives nonwhite-household-head tenure for every State in one book,
and its Table 2 gives the all-households denominator. White is then a derived residual. **I did not
open Part 1's list of tables** (I opened only its Summary of Findings, pp. XXIX-XXX) — the table
numbering above is taken from the Part 2 introduction's own cross-reference, so **confirm Part 1
Table 23 before loading.**

- **Definitional axis for 1960: race of *household head*.** Not occupants. So the axis flips
  between 1950 (occupants) and 1960 (household head), and 1960 lines up with 1980-2020 rather than
  with 1940-1950. Record the break at 1950/1960, not only at 1940/1980.
- **Race:** `nonwhite` household heads. No Negro-only cut in these tables.
- **Tier A.**

### National long series, for a cross-check only

CPR P-23 No. 80, **Table 96 — "Tenure of Occupied Housing Units, for Selected Years: 1890 to
1970."** Black and White, Total occupied / Owner occupied / Renter occupied, counts and percent
distribution. Years printed: 1890, 1910, 1940, 1960, 1970 — **1950 is not in this table.** Footnotes
warn that in some years "Data for White include family heads of 'other' races" and in 1960 "Data for
Black include family heads of 'other' races." Table 97 and Table 98 give the same cut by the four
census regions. **Tier A, nation, and it does not cover 1950.** Use it to sanity-check the summed
state figures for 1960, nothing more.

---

## GAP 5 — Farm tenancy by race, 1940 and 1950

**Closed completely, at state level, with a `Negro` category, by one chapter.**

**U.S. Department of Commerce, Bureau of the Census, *United States Census of Agriculture: 1950*,
Vol. II, *General Report: Statistics by Subjects*, Chapter XI, "Color, Race, and Tenure of Farm
Operator," pp. 905 ff. GPO.**
URLs opened: `https://www2.census.gov/library/publications/decennial/1950/agriculture-volume-2/21895591v2ch01.pdf`
(front matter and definitions), `…/21895591v2ch09.pdf` (Chapter XI opening and its table list),
`…/21895591v2ch10.pdf` (Table 27 itself). These scans carry OCR text layers.

**Table 27 — "FARMS OF NEGRO OPERATORS BY TENURE — FARMS AND LAND IN FARMS, 1900 TO 1950; FARMS BY
TENURE, 1910 TO 1950; AND LAND IN FARMS BY TENURE, 1950; BY DIVISIONS AND STATES," p. 1025.**

- **Geography:** United States, the North / South / West, the nine geographic divisions, **and every
  State**, as rows.
- **Census years:** number of farms operated by Negroes for 1950, 1940, 1930, 1920, 1910, 1900;
  farms by tenure class (all owners, full owners, part owners, and the tenant classes) for 1950
  back to 1910.
- **Race, in the volume's words:** `Negro`. A true Negro cut, not nonwhite.
- **This single table covers both gap years *and* cross-checks 1910, 1920 and 1930**, which the
  timeline already holds from NHGIS.
- **Tier A.**

Companions in the same chapter, all opened via its table list:
- **Table 22 — "Number of farms, by color and by tenure of operator, and land in farms by tenure of
  operator, by divisions and States: 1880 to 1950," p. 992.** The white/nonwhite version, by state,
  for every census 1880-1950. Use this for the white and nonwhite slices.
- **Table 21, p. 956** — number of farms, land in farms and cropland harvested by tenure of operator
  (**color and tenure for the South**), by divisions and States, censuses of 1950, 1945 and 1940.
- **Table 26, p. 1024** — farms of Negro operators, farms and land classified by use, by divisions
  and States: 1950.
- **Table 19, p. 939** — farms of Negro and other nonwhite operators by tenure, United States,
  censuses of 1950 and 1940, with a headnote pointing to tables 26, 27 and 30 for divisions and
  States.
- **Table 4, p. 924** — number of farms by color and tenure of operator, United States, 1880 to 1950
  (national baseline).

**Definition, quoted from the volume** (Vol. II, "Classification of farms," Ch. I front matter):
"Farms by color or race of operator.—Farm operators are classified by color as 'white' and
'nonwhite.' Nonwhite includes Negroes, Indians, Chinese, Japanese, and all other nonwhite races."
Race (Negro specifically) is treated separately at p. 917.

**One thing to decide before loading:** the Census of Agriculture's unit is the **farm operator**,
and the census counted sharecroppers as tenant farm operators. The methodology already grades
tenants with laboring work for the work-based regime, so this is consistent — but the denominator is
farms, not households or persons. Say so.

**1940 route if a 1940-vintage source is wanted rather than the 1950 republication:** the 1940
Census of Agriculture Vol. I state bulletins are online, one PDF per state
(`https://www2.census.gov/library/publications/decennial/1940/agriculture/1940-census-agriculture-vol-1-alabama.pdf`
and siblings). **I did not open any of them** — unverified. Table 22/27 above already give 1940
from a Census Bureau publication, so there is no reason to.

---

## What "selected States" means in the 1950 nonwhite special report

**U.S. Bureau of the Census, *U.S. Census of Population: 1950*, Vol. IV, *Special Reports*, Part 3,
Chapter B, *Nonwhite Population by Race*. 1950 Population Census Report P-E No. 3B. GPO, 1953.**
URL opened: `https://www2.census.gov/library/publications/decennial/1950/population-volume-4/41601756v4p3ch03.pdf`

- **Table 9, p. 3B-27** — "Social and economic characteristics of the Negro population 14 years old
  and over, for the United States, by regions, urban and rural: 1950." Nation + four census regions.
- **Table 20, p. 3B-66** — "Social and economic characteristics of the Negro population, for selected
  States, urban and rural, and for selected standard metropolitan areas: 1950."
- **The selection rule, quoted from p. 3B-4:** "The selected areas for Negroes are those with a Negro
  population of 2,500 or more and a combined population of 2,500 persons or more of other nonwhite
  races."
- Subjects covered, per the report's own "General" section (p. 3B-3): age, sex, marital status,
  **years of school completed, employment status, major occupation group, and personal income**.
- **Race:** `Negro` specifically, alongside Indian, Japanese, Chinese, Filipino and a residual.
- **Tier A.**

**Correction to a working assumption.** The project's note that 1950 nonwhite detail was "published
only for areas of 50,000 and over" does **not** describe this report — its threshold is a Negro
population of 2,500, which is a low bar that most states clear. I did not find a 50,000 threshold on
any page I opened. The real 1950 partial-coverage problem I could verify is narrower and different:
**the "a"-suffix tables in Vol. II Chapter B (28a, 30a, 32a, 45a…) are printed for some state parts
and omitted for others** — Alabama has Table 32a, Vermont does not. The methodology note should be
rewritten around that verified restriction rather than the 50,000 figure, unless someone can point
to the specific table the 50,000 claim came from.

---

## Two definitional warnings that must survive into the stored slices

**1. Nonwhite is the default label for 1940-1960 state data, and Negro is the exception.**
Every state-level table that closes gaps 1, 2 and 3 — 1960 Tables 47, 52, 53, 65, 67, and 1950
Tables 20, 25, 27, 32a — crosses by **color**, meaning `WHITE` and `NONWHITE`. The 1950 volume
defines it on p. XVI in its own words: "The term 'color' refers to the division of population into
two groups, white and nonwhite. The group designated as 'nonwhite' consists of Negroes, Indians,
Japanese, Chinese, and other nonwhite races." A `Negro` category at state level exists only in:
- 1940 Vol. III *The Labor Force*, Table 4 (employment status, by race, 1940)
- 1950 Census of Housing Vol. I, Table 2 (tenure, by race of occupants, 1950)
- 1950 Census of Agriculture Vol. II, Table 27 (farm tenancy, by state, 1900-1950)
- 1950 P-E No. 3B, Table 20 (selected States, 2,500+ Negro population)

Everything else stores under the `nonwhite` slice.

**2. 1940 arithmetic is not interchangeable across sources.** The 1940 attainment and employment
figures inside the 1960 and 1950 volumes are the Census Bureau's own republication and are fine as
Tier A — but 1960 Table 47's 1940 panel is the State total only (no urban/rural), 1970 Table 75's
`NEGRO` block has no 1940 row at all, and 1970 Tables 75/77 exclude Alaska and Hawaii for 1940 and
for the 1950 racial groups. A West-region sum built from 1940 state figures and cross-checked
against the 1970 national retrospective will not reconcile unless AK and HI are excluded from the
sum too.

---

## RECOMMENDATION — ranked by cost to close

**Tier 1: one table away. Do these first.**

1. **The 1969 median.** Done. `$9,590`, 1970 PC(1)-C1 Table 83, p. 1-377. One cell, one citation.
   It also hands over `$5,660` for 1959, which unlocks the 1960 income condition at the same time.
   Highest value per unit of effort in the whole list.
2. **Farm tenancy by race, 1940 and 1950 (gap 5).** One chapter, one table. 1950 Census of
   Agriculture Vol. II Ch. XI Table 27 is a single state-by-state, year-by-year grid with a true
   Negro category, and Table 22 is the white/nonwhite companion. The scan has an OCR text layer, so
   this can be machine-transcribed rather than eyeballed. Closes both decades and cross-checks three
   earlier ones.
3. **Home tenure by race, 1950 (gap 4).** 1950 Census of Housing Vol. I, Table 2, one chapter per
   state, **with an OCR text layer**, and a three-way race split. Cheap and high quality.

**Tier 2: one table, repeated 51 times. Mechanical but image-based.**

4. **High school completion by race, 1940/1950/1960 (gap 1).** 1960 PC(1)-C Table 47. 51 state
   parts, two pages each, image-only, so it is transcription by eye or by an OCR step someone has to
   add. But the table is identical in structure everywhere and returns three decades per pass.
5. **Unemployment by race, 1940/1950/1960 (gap 2).** 1960 PC(1)-C Table 53. Same 51 parts, **one
   page each**, and the unemployment rate is already printed as "PERCENT OF CIVILIAN LABOR FORCE" —
   no derivation, no denominator hunting. Cheapest of the three-decade transcriptions.
6. **Income by race, 1959 (gap 3, 1960 leg).** 1960 PC(1)-C Table 65. 51 parts, one page each,
   families published separately from unrelated individuals, median printed. Pairs with the $5,660
   threshold already in hand.
7. **Home tenure by race, 1960 (gap 4).** Confirm Vol. I Part 1 Table 23 first; if it is what the
   Part 2 introduction says it is, this is **one volume for all states** rather than 51 chapters,
   and it becomes a Tier 1 item.

**Tier 3: needs an owner decision before any transcription starts.**

8. **Income by race, 1949 (gap 3, 1950 leg).** Two imperfect options and no clean one:
   - *1950 Vol. II Table 32a* — families and unrelated individuals **combined**, and **missing from
     an unknown number of state parts**. Needs a 51-part enumeration pass and a partial-coverage
     share recorded per region.
   - *1960 PC(1)-C Table 67* — **persons**, not families, but uniform across all state parts and
     puts 1949 next to 1959 under one definition.
   These are different measures. Pick one, do not mix. My recommendation: **use Table 67 and state
   plainly that the 1950s decade's income condition is measured on persons**, because uniform
   coverage beats a matching unit that comes with an unquantified hole in three or four regions.
9. **Income by race, 1939 (gap 3, 1940 leg).** **There is no state-level published source.** The
   `wage_income` regime cannot be built at state level for 1940 from published tables. Options: fill
   the national baseline only, from 1940 *Families* Table 12 (families, by color, US urban and rural)
   and leave the six regions blank with a note; or accept the South-only nonwhite cell from *Families,
   General Characteristics* Table 17. Either way this is a scope decision, not a research one.

**Not recommended.** No Tier C academic reconstruction is needed for any of the six gaps. Every one
of them has a Tier A published Census Bureau table except the state-level 1939 income cell, and for
that cell a reconstruction would have to be built from microdata rather than cited — which is a
different project and would need a distinct status in the schema. I did not go looking for one.

---

## DEAD ENDS

Things I opened that turned out not to answer the question, recorded so nobody repeats the walk.

1. **1940 Population Vol. III, *The Labor Force*, Tables 15 and 16 — the obvious home for 1939
   income — are not crossed by race.** Verified against the Alabama contents page (p. 9) and the
   introduction (p. 6). Table 15 is "Wage or salary income received in 1939 … by employment status
   and **sex**, for the State, urban and rural, and for cities of 100,000 or more"; Table 16 is by
   **occupation and sex**. Neither carries color or race. This is the single biggest negative result
   in the report.

2. **1940 *Characteristics of the Nonwhite Population by Race* (1943) has no income table at all.**
   I read its full contents (pp. V-VI) at
   `https://www2.census.gov/library/publications/decennial/1940/population-nonwhite/population-nonwhite.pdf`.
   Its subjects are age, marital status, household relationship, years of school completed,
   employment status and major occupation group — no income of any kind. Worse for our purposes, its
   nonwhite tables (1-8) are **"for the United States, by regions, urban and rural"** only, and its
   Negro tables (9-14) are **"for selected States, urban and rural, and for selected cities."** It is
   national/regional, not a state-level source. It does not close any gap that the 1960 and 1950
   volumes do not close better.

3. **1960 PC(2)-1B is *Persons of Spanish Surname*, not *Negro Population*.** The brief's table map
   carries the 1970 numbering back one decade. There is **no 1960 "Negro Population" subject
   report.** The 1960 equivalent is **PC(2)-1C, *Nonwhite Population by Race* (1963)**, "Social and
   Economic Statistics for Negroes, Indians, Japanese, Chinese, and Filipinos." I opened both covers
   and both contents. PC(2)-1C's relevant tables are **Table 9** (social characteristics of the Negro
   population, p. 9) and **Table 32** (economic characteristics, p. 101), both "for the United
   States, by regions, and for selected States, urban and rural." Because the 1960 PC(1)-C state
   parts give the same subjects for **all** states, PC(2)-1C is a corroborating source, not a
   primary one. Its value is that it labels by `Negro`, which PC(1)-C does not.

4. **1970 PC(1)-C1 Table 77 cannot supply 1940 Negro unemployment.** The `NEGRO` block prints (NA)
   for employed and unemployed in the 1940 row. Only "Negro and other races" is populated.

5. **1970 PC(1)-C1 Table 75 has no 1940 row in its `NEGRO` block.** Same shape of problem for
   attainment.

6. **CPR P-23 No. 80's retrospective tables skip 1950 and use the wrong regions.** Table 70
   (schooling, 1940/1960/1970/1975) and Table 96 (tenure, 1890/1910/1940/1960/1970) both omit 1950,
   and Table 70's areas are United States / South / North and West while Tables 97-98 use the four
   census regions. None of these sum into the timeline's six regions. It is a narrative and
   cross-check source, not a data source.

7. **Historical Statistics Series G 205-256 is state-level median family income for 1949, 1959 and
   1969 — but not by race.** Tantalizing and useless for this purpose. Its companion
   Series G 189-204 (median income by race of head) is annual CPS, national only, and starts at
   **1947**, so it cannot reach 1939.

8. **The 1940 Population Vol. II state parts are image-only scans with no OCR layer**
   (`33973538v2p2ch1.pdf` returns zero extractable characters; scanned 2001). Same for the 1950
   Vol. II population parts, the 1960 Vol. I parts, the 1960 PC(2) reports, the 1970 Vol. I parts,
   and the 1960 Census of Housing. Machine transcription of any of these needs an OCR step added
   first — there is no `tesseract` or `ocrmypdf` on this machine. By contrast, these **do** carry
   OCR text and can be machine-read today: the 1940 nonwhite volume, the 1940 *Families* and
   *Families, General Characteristics* reports, the 1940 *Labor Force (Sample Statistics)* series,
   the **1950 Census of Housing Vol. I**, the **1950 Census of Agriculture Vol. II**, *Historical
   Statistics* Chapter G, and CPR P-23 No. 80.

9. **Unverified, listed so it is not mistaken for checked.**
   - *Historical Statistics* Chapters D (Labor) and H (Education) — downloaded, confirmed to have
     **no OCR text layer**, and **not opened as images**. Their unemployment-by-race and
     attainment-by-race series are presumed present but I make no claim about them.
   - 1940 *Population: Education — Educational Attainment by Economic Characteristics and Marital
     Status* (1947) — I opened only the title page. No claim about its tables or geography.
   - 1960 Census of Housing Vol. I **Part 1** list of tables — not opened. The Tables 22-29 claim
     rests on the Part 2 introduction's cross-reference (p. XVI), which I did read.
   - Whether 1960 Census of Housing Table 8 really is present for every state — the volume's
     exclusion sentence names only Tables 9 to 11, but I did not open a low-nonwhite state chapter.
   - Which of the 51 1950 Vol. II state parts carry Table 32a — verified present in Alabama, absent
     in Vermont, unknown for the other 49.
   - 1940 Census of Agriculture Vol. I state bulletins — located, never opened.

---

## Index of files downloaded during this pass

All under
`/private/tmp/claude-501/-Users-geralddagher-Developer-Projects-blackstory/a2416c54-e05a-4d3b-92a6-c475c87e2fcd/scratchpad/dl/`.
Scratch only; safe to delete.

| Local file | Source URL (all under `https://www2.census.gov/library/publications/`) |
|---|---|
| `us1-01.pdf` … `us1-13.pdf` | `decennial/1970/population-volume-1/1970a_us1-NN.pdf` |
| `nonwhite40.pdf` | `decennial/1940/population-nonwhite/population-nonwhite.pdf` |
| `pc2-ch03.pdf`, `pc2-ch06.pdf` | `decennial/1960/population-volume-2/41927938v2p1a-1echNN.pdf` |
| `al60-a/-c/-e.pdf` | `decennial/1960/population-volume-1/vol-01-02-{a,c,e}.pdf` |
| `vt60-ch4.pdf` | `decennial/1960/population-volume-1/24989706v1p47ch4.pdf` |
| `al50-ch1/-ch3/-ch4.pdf` | `decennial/1950/population-volume-2/37778831v2p2chN.pdf` |
| `vt50-ch2/-ch3.pdf` | `decennial/1950/population-volume-2/41601747v2p45chN.pdf` |
| `lf40-p2ch1/-p2ch2.pdf` | `decennial/1940/population-volume-3/33973538v3p2chN.pdf` |
| `fam40-ch1.pdf` | `decennial/1940/population-families/41272167ch1.pdf` |
| `pohfam40.pdf` | `decennial/1940/population-and-housing-families/41272176ch01.pdf` |
| `lfs40p1.pdf` | `decennial/1940/population-labor-force-sample/41236810p1_ch1.pdf` |
| `h50p2c1.pdf` | `decennial/1950/housing-volume-1/36965082v1p2ch01.pdf` |
| `h60p2c1/-c2.pdf`, `h60p1c1.pdf` | `decennial/1960/housing-volume-1/41962442v1p{1,2}chN.pdf` |
| `ag50v2c1/-c9/-c10.pdf` | `decennial/1950/agriculture-volume-2/21895591v2chNN.pdf` |
| `v4p3c03/-c05.pdf` | `decennial/1950/population-volume-4/41601756v4p3chNN.pdf` |
| `hs-G.pdf` | `1975/compendia/hist_stats_colonial-1970/hist_stats_colonial-1970p1-chG.pdf` |
| `p23-080.pdf` | `1979/demographics/p23-080.pdf` |
