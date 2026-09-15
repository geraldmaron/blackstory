<!--
  Methodology: how "Lives Across the Decades" turns IPUMS USA microdata into published
  region x decade x group x class-tier cells, and what the surface is allowed to say about them.
  Binds packages/ops-data/src/lives/, packages/domain/src/statistics/lives-timeline.ts, and the
  /lives surface. Companion to juxtaposition-not-causation.md.
-->

# Lives Across the Decades: method

**Status:** Binding product methodology
**Date:** 2026-09-14
**Related:** [juxtaposition-not-causation.md](./juxtaposition-not-causation.md),
[national-black-population-timeline.md](./national-black-population-timeline.md),
[scholarship-principles.md](./scholarship-principles.md)

## What the surface shows

A reader chooses a region, a lens (Black, white or Hispanic) and a class tier, then moves through
the decades from the 1870s to the 2020s. Each decade shows four things:

1. The share of each of the three groups in each class tier.
2. Measured conditions for the chosen group and tier, with the other two groups beside them.
3. The laws and court rulings in force that applied to that place and group.
4. A short narrative frame that states only what the first three already show.

All three groups are always on screen. The lens changes which one is emphasized, never which ones
are visible. The surface describes the conditions people in a group lived under. It never invents
a person, assigns a fate, or invites a reader to "become" a race.

## Source

Every cell is **tabulated** by BlackStory from IPUMS USA microdata (Ruggles et al., IPUMS USA,
University of Minnesota). Tabulated means our own weighted count from licensed microdata. It is not
a figure the Census Bureau published, and the UI says so with the status `tabulated`. The cell's
status is never `observed`.

Microdata stays in the gitignored `.cache/ipums/` directory and is never committed, uploaded or
served. Only aggregates reach `bb_reference`. Extract *definitions* (samples, variables, case
selections) are configuration and are committed, so any cell can be rebuilt.

## Groups

Groups do not overlap:

| Group | Definition | Slice |
|---|---|---|
| Black | Race Black, not Hispanic | `black_nh` |
| White | Race white, not Hispanic | `white_nh` |
| Hispanic | Hispanic origin, any race | `hispanic` |

This follows the Pew Research Center convention. The existing national spine series use `black_alone`,
which includes Hispanic Black people, so the national context rows on the surface keep their own
label and are never merged with these cells.

**Hispanic origin before 1970 is imputed.** The census first asked about Hispanic origin in 1970, on
the 5% long form, and asked everyone from 1980. For 1870 through 1960, IPUMS `HISPAN` is assigned
from birthplace, parents' birthplace and, in five southwestern states in 1960, Spanish surname
(Gratton and Gutmann). Cells from those decades carry the regime label "Hispanic origin imputed by
IPUMS."

## Class tiers and measurement regimes

Class is measured differently as the census changed what it asked. Each decade belongs to exactly one
regime. The surface marks every boundary, and **no change is ever computed across a boundary.**

| Decades | Regime | Measure | Label |
|---|---|---|---|
| 1870s–1930s | `occupational_strata` | Household head's `OCC1950` group | Work-based class |
| 1890s | none | No surviving microdata (1890 schedules destroyed) | Gap |
| 1940s | `earnings` | Household earnings from `INCWAGE` (wages only, top-coded $5,001) | Earnings tier |
| 1950s | `sample_line_income` | `INCTOT`, asked only of sample-line persons | Income tier, sample-line note |
| 1960s–1970s | `constructed_household_income` | Household income summed from members' `INCTOT` | Income tier, method note |
| 1980s–2000s | `household_income` | `HHINCOME` | Income tier |
| 2010s–2020s | `acs_household_income` | `HHINCOME`, ACS 5-year files | Income tier |

### Income tiers (1940s onward)

We use the Pew Research Center method:

1. Size-adjusted income = household income ÷ √(number of persons in the household).
2. The national median of size-adjusted income is computed from that year's nationwide sample,
   weighted by household.
3. **Lower:** below two-thirds of the national median. **Middle:** two-thirds to double. **Upper:**
   above double.

Thresholds are national, not regional, and are not adjusted for local cost of living. The surface says
so. Regional Price Parities only exist from 2008, and a partial adjustment would create a false break.

### Work-based class (1870s–1930s)

Before 1940 the census did not ask about income. Class comes from the observed occupation of the
household head, grouped by `OCC1950`:

| Stratum | OCC1950 groups |
|---|---|
| Lower | Laborers, farm laborers, private household and service workers |
| Middle | Operatives, craftsmen, clerical and sales workers, farm tenants |
| Upper | Professionals, managers, officials and proprietors, farm owners |

These are **not income classes** and are never labeled as income. We do not use `OCCSCORE`. It gives
every worker in an occupation that occupation's 1950 median income, which erases pay gaps between
races doing the same work and would overstate Black workers' standing.

Farm owners and farm tenants are separated using `OWNERSHP` where the decade records it. The exact
code lists live in `packages/ops-data/src/lives/strata.ts` and its tests.

## Universe, weights and dollars

- **Universe:** adults age 18 and over living in households (group quarters excluded).
- **Weights:** `PERWT` for person shares, `HHWT` for household measures.
- **Dollars:** 2024 dollars. CPI-U-RS from 1978 onward, chained to CPI-U for 1913–1977. The deflator
  series is stored as its own statistical series so any conversion can be reproduced.

## Geography

IPUMS identifies places differently by decade:
- `METAREA` covers 1850–1950 and the 1960 5% sample.
- Metro identification in 1970–2000 is partial and has population thresholds.
- `MET2013` and PUMA are needed from 2012.
- `CITY` is absent in 1970.

Each region and decade has a row in `bb_reference.region_decade_definitions` recording the exact
geography rule, the member counties where they are known, a `boundary_version`, and a required
`comparability_note`. A region is a jurisdiction such as `region:chicago-il`. When the geography
rule changes between decades, the comparability note says what changed, and the surface shows it.

## Uncertainty and suppression

Every published cell carries its unweighted count, a standard error, and a 90% margin of error.

- **ACS decades:** variance from the published replicate weights.
- **Earlier decades:** a household-cluster bootstrap with 200 replicates and a fixed seed, so reruns
  reproduce the same margins.

| Condition | Cell state | Surface |
|---|---|---|
| Unweighted n < 50, or relative standard error > 30% | `suppressed` | "Too few records in the census sample to say." |
| RSE 15–30% | `wide_margin` | Value shown with a wide-margin marker |
| Not asked in that decade | `not_measured` | "The census did not ask this in the 1920s." |
| Otherwise | `published` | Value, n and margin |

Suppressed and unmeasured cells are never interpolated, estimated from neighbors, or borrowed from
another geography.

## Rules in force

Laws and rulings come from the catalog. Their applicability lives in
`bb_reference.law_applicability`:
- the jurisdiction they applied to
- the in-force window, taken from cited claims, never from entity `statusHistory`
- the groups the rule named, in its own words
- the life domains it touched
- whether its text was exclusionary, protective or facially neutral

A rule shows in a decade when its window overlaps that decade and its jurisdiction is the region,
one of its counties, or an ancestor.

A facially neutral rule whose racial effect is disputed by scholars renders as a dispute, not as a
settled effect. Examples are the agricultural and domestic worker exclusions in the Social Security
Act of 1935 and the Fair Labor Standards Act of 1938.

## What the surface may say

The surface follows [juxtaposition-not-causation.md](./juxtaposition-not-causation.md). Every rules
panel carries the fixed disclaimer:

> Context indicators are published measurements from named custodians. Showing them with a law or
> place does not establish that the law caused the indicator values. Causal statements require
> separately evidenced claims.

Allowed:
- "In 1950, about N in 100 Black adults in the Chicago area lived in lower-income households."
- "The Fair Housing Act was in force."
- "In the same decade, homeownership among white adults was M%."

Not allowed:
- "Because of redlining, Black families earned less."
- "You would have been poor."

A causal sentence needs a gated claim citing peer-reviewed work. Narrative frames are validated so
that every number in them matches a published cell.
