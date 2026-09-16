<!--
  Which published census tables IPUMS NHGIS can supply for Lives Across the Decades at nation and
  state level, decade by decade and condition by condition, and which cells it cannot supply at all.
  Every code here was returned by a live api.ipums.org/metadata/nhgis call on 2026-09-15. Companion
  to lives-regions-and-sources.md; method in docs/methodology/lives-across-decades.md.
-->

# Lives Across the Decades: the NHGIS table map, 1870-1970

**Status:** Research record
**Date:** 2026-09-15
**Related:** [lives-regions-and-sources.md](./lives-regions-and-sources.md),
[lives-across-decades.md](../methodology/lives-across-decades.md)

The timeline runs 1870 to 2020. The 1980s through the 2020s were already loaded from NHGIS summary
files and the ACS. This records what the eleven earlier decades can and cannot be built from, so
nobody has to rediscover it, and so every blank cell on the surface has a reason behind it.

The rule that produced this map: a figure is usable only if the published table crosses the measure
by race **and** NHGIS carries it at nation and state level. A table that is county-only, or that
publishes race and the measure on separate axes, cannot answer the question and is recorded as a gap.

## What NHGIS can supply

| Decade | population | urban | homeownership | literacy | school | farm tenancy | unemployment | high school | income |
|---|---|---|---|---|---|---|---|---|---|
| 1870 | yes | — | — | males 21+ only | yes | — | n/a | n/a | n/a |
| 1880 | yes | — | — | yes, 10+ | qualified | — | n/a | n/a | n/a |
| 1890 | yes | no | — | no | qualified | — | n/a | n/a | n/a |
| 1900 | yes | no | no | native males 21+ | no | yes | n/a | n/a | n/a |
| 1910 | yes | no | no | yes | yes | yes | n/a | n/a | n/a |
| 1920 | yes | no | no | yes | no | yes | n/a | n/a | n/a |
| 1930 | yes | no | yes | yes | no | yes | no | n/a | n/a |
| 1940 | yes | no | yes | n/a | n/a | no | no | no | no |
| 1950 | yes | no | no | n/a | n/a | no | no | no | no |
| 1960 | yes | no | no | n/a | n/a | n/a | no | no | no |
| 1970 | yes | yes | yes | n/a | n/a | n/a | yes | yes | bands only |

"n/a" means the condition is not part of that decade by design (the surface does not claim it).
"—" means the condition does not start until a later decade. "no" is a real gap: the census asked,
or published, but not in a form crossed by race at this geography.

## The gaps that matter most

**Work-based class, 1870 through 1930.** This is the largest single hole. Class for those seven
decades is supposed to come from the kinds of work the census published by race. NHGIS carries the
full occupational classification for 1870, 1880, 1900, 1910, 1920 and 1930 — and every one of those
tables crosses occupation by sex, age or place of birth, never by race. 1890 has no occupation table
at all. The class dimension for the whole work-based regime has to come from transcription, chiefly
the occupation volumes and *Negroes in the United States, 1920-32* (1935).

**Urban residence, 1890 through 1960.** Published, but never crossed by race at state level in any
NHGIS table for those decades. 1970 is the first year the crossing is available, through the urban
geographic component. A 1930 family-level residual is derivable but is families rather than persons,
and is derived rather than published.

**Everything about 1940, 1950 and 1960 except population and two tenure tables.** 1940 has no income
table of any kind, so the `wage_income` regime has no NHGIS source. 1950 has no dwelling-unit table
at all, and its median family income is county-level value ranges. 1960 carries no urban, housing,
attainment, labor-force or income table at nation and state level. These are the decades that need
printed volumes.

**Hispanic, 1870 through 1960.** Not a gap in coverage but a gap in the count itself: no table in any
dataset across these decades carries a Spanish-origin concept. The 1930 "Mexican" race is folded into
undifferentiated `Other` residuals and is not equivalent. The 1940 and 1950 hits for "Mexico" are
country of birth of the foreign-born **white** population, which excludes US-born people of Mexican
descent and everyone not counted as white. No proxy is used. 1970 is the first decade with a
Spanish-origin figure.

## Traps, each of which would have published a wrong figure

**"Colored" changes meaning at 1890.** In 1870 and 1880 it sits beside separate Chinese and Indian
columns and means Black. In 1890 and 1900 it is the four-way non-white aggregate. The obvious 1890
population table (`1890_cPHAM` NT6, `AV0007`/`AV0008` "Colored") is therefore *not* Black; the Black
count is `AVF001`. Both 1890 school attendance and 1900 farm tenancy exist only as "Colored". These
are stored under the `nonwhite` slice, never `black` — the domain reaches the Black lens through it
and names the definition on screen.

**Two unemployment tables are the 1937 registration, not a census.** `1930_cPAE` NT87 (`BFM`) and
`1940_cPHAE` NT121 both look like race-crossed unemployment and are filed inside the 1930 and 1940
datasets. Both have universe "Unemployed Persons Registered, 1937" — a voluntary registration, seven
and three years off, with no race denominator anywhere in either dataset. Neither may be presented as
a census figure.

**Race of occupants is not race of householder.** 1940's tenure table counts by race of *occupants*;
1980 through 2020 count by race of *householder*. A real definitional break, not a wording change.

**Label text drifts between tables in the same decade.** `White: Native-born` in the population and
literacy tables against `White: Native born` in `1930_cFH`; `White`/`Colored` in the state occupation
datasets against lowercase `white`/`colored` in `1930_cAg`. Ingest matches on cell text, so each table
is matched against the string that table actually publishes.

**No breakdowns before 1970.** The 1980-2000 loader requests race through `breakdownValues`. Every
dataset from 1870 through 1960 returns no breakdowns at all: race lives in the variable list instead.
1970 is the first decade with the familiar shape (`bs01` spatial, `bs02` race and ethnicity), and
NHGIS labels its breakdown `Black` while the 100-percent variable descriptions say `Negro`, which is
what 1970 published.

**1970 sample bases are not uniform.** 1970 ran a 15-percent and a 5-percent questionnaire, and the
Count 4 tables rest on different bases by subject; the origin-or-descent question behind the
Spanish-origin tabulations was a 5-percent item. NHGIS exposes no per-table sample-base field, so it
must be read from the 1970 Census Users' Guide and recorded in provenance.

## What needs transcription rather than NHGIS

Work-based class for 1870-1930; urban residence by race for 1890-1960; educational attainment by race
for 1940-1960; unemployment by race for 1930-1960; income by race for 1940-1960, including the
national medians the income bands are measured against; farm tenancy for 1940-1950; school attendance
for 1900, 1920 and 1930; literacy for 1890; homeownership for 1900-1920, 1950 and 1960.

Two warnings for that work. The 1950 nonwhite detail in the printed volumes covers only areas of
50,000 and over, so a partial-coverage share has to be recorded alongside any figure taken from it.
And the printed tables label by "Nonwhite" far more often than by "Negro"; the distinction has to
survive into the stored slice.
