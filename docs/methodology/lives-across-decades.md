<!--
  Methodology: how "Lives Across the Decades" turns published census tables into region x decade x
  group figures, and what the surface is allowed to say about them. Binds
  packages/domain/src/statistics/lives-*.ts, packages/ops-data ingest for Lives, and the /lives
  surface. Companion to juxtaposition-not-causation.md. Plan of record:
  docs/research/lives-regions-and-sources.md.
-->

# Lives Across the Decades: method

**Status:** Binding product methodology
**Date:** 2026-09-15 (revised from the 2026-09-14 microdata method)
**Related:** [juxtaposition-not-causation.md](./juxtaposition-not-causation.md),
[national-black-population-timeline.md](./national-black-population-timeline.md),
[scholarship-principles.md](./scholarship-principles.md),
[lives-regions-and-sources.md](../research/lives-regions-and-sources.md)

## What the surface shows

A reader chooses a region, a lens (Black, white or Hispanic), a **unit of analysis**
(household, child, or woman), and a class tier, then moves through the decades from the 1870s
to the 2020s. Each decade shows:

1. **A hand-drawn street** whose layers hatch from published cells (and optional modeled affordance).
2. **What the count could see:** who the census counted, how, what is missing, and what that meant.
3. **The share of each group in each class tier.**
4. **Measured conditions for each group:** homeownership, schooling, work, city living and more.
5. **The laws and court rulings in force** for that region and group.
6. **World beats or gap cards** for housing, school, policy, justice, testimony, war, and related domains.
7. **A short narrative frame** that states only what the rest of the decade already shows.

All three groups are always on screen. The lens changes which one is emphasized, never which ones are
visible. The unit names the subject. The surface never invents a person, assigns a fate, or invites a
reader to "become" a race.

### Unit of analysis

| Unit | Carries | Refuses |
|---|---|---|
| Household (default) | Tenure, urban, farm, income bands, modeled rent burden | Treating the house as a child's life |
| Child | School attendance, literacy, child-labor laws | Income bands as the child's wage |
| Woman | Sex-crossed occupation where ingested; suffrage and property as laws | Household income labeled as her wage |

### Derived income and modeled affordance

**Derived income.** From 1913 on, published income may be restated into comparison-year dollars with
chained CPI-U-RS (`lives-cpi-math`, annual averages from BLS). Status `derived`. Not available before
1913.

**Modeled affordance.** Same-year published rent or home value against same-year income. The ratio uses
original-year dollars. CPI may restate both sides for a caption only. Status `modeled`. Work-based class
never enters. National price against regional income must say so.

**Forbidden:** CPI-deflating a modern sticker price into a historical decade and calling that what people
could not buy.

## Regions

Six regions, each a union of whole states, plus a national baseline:

| Region | States |
|---|---|
| Deep South | AL, AR, FL, GA, LA, MS, SC |
| Upper South & the Capital | DE, DC, KY, MD, NC, TN, VA, WV |
| Texas & Oklahoma | TX, OK |
| The West | AK, AZ, CA, CO, HI, ID, MT, NV, NM, OR, UT, WA, WY |
| Midwest | IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI |
| Northeast | CT, ME, MA, NH, NJ, NY, PA, RI, VT |

Every state belongs to exactly one region, so the regions sum to the nation. Territories are included
wherever the census enumerated them before statehood, and the decade's note says so. Place anchors
(catalog places such as Harlem, Bronzeville, and the Delta) illustrate a region and never carry
figures of their own. Each region shows two or three anchors so the story is not collapsed into one
metro. Gap inventory and sourcing ladder:
[lives-gap-and-sourcing.md](../research/lives-gap-and-sourcing.md).

## Source and status

Every figure comes from a published **federal statistical table**: a printed volume, a subject report,
a summary file, or an American Community Survey table. Most are Census Bureau publications, which are
public domain and are the cited source. NHGIS is used to extract and cross-check, and its table code is
kept in provenance.

**Widened from "Census Bureau" to "federal statistical" on 2026-09-15, by owner decision.** The census
is not the only federal agency that counted these people by race and state. The Bureau and Office of
Education published school enrollment and attendance by race and state for decades the census did not,
and those bulletins are public domain, state level, printed counts, and checkable in exactly the way a
census volume is. Refusing them was costing the timeline real figures for no gain in rigor. The bar is
the same one the census clears: an identified federal agency, a published table, a count rather than an
estimate, and a page a reader can open. Cite the issuing agency's own publication, never a later work
that reprints it — a scholarly book may be the finding aid that led to a bulletin, but the bulletin is
the source.

This widens **which publisher** counts. It does not widen what counts as a figure. A scholar's
reconstruction from microdata or interpolation is not a published count, however reputable its author,
and does not become one by being cited. Those remain outside, for the reasons in
[lives-source-authority.md](../research/lives-source-authority.md).

- **`observed`:** a figure transcribed exactly as a table published it, stored at state or national level.
- **`derived`:** a region figure summed or divided from state figures, or an income band estimated
  within published brackets. The formula and every input row are recorded.

The status `tabulated` (a weighted count from licensed microdata) remains in the schema but this
feature does not use it.

## Groups, as each era defined them

The census's categories changed, and the surface never hides that.

| Era | Black | White | Hispanic |
|---|---|---|---|
| 1870–1960 | "Negro" (with "Mulatto" where the census used it), recorded by enumerators | "White," which included people later counted as Hispanic | Not counted as a group. 1930: "Mexican" as a race. 1950–1960: Spanish surname (five states) and Puerto Rican birth or parentage |
| 1970 | "Negro" | "White," which included Hispanic white people | Sample question on Spanish origin, with known misclassification |
| 1980–1990 | "Black," Hispanic Black people included unless a table excludes them | White, non-Hispanic where a table publishes it, otherwise "White" | Spanish or Hispanic origin, asked of everyone |
| 2000–2020 | "Black or African American alone" | "White alone, not Hispanic" | "Hispanic or Latino," of any race |

A figure is labeled with the definition its table used. A change is never computed across two
definitions without saying so.

## Class tiers by era

| Decades | Regime | Measure | Label |
|---|---|---|---|
| 1870s–1930s | `work_based` | Published occupation groups by race (laboring, farm and domestic work; skilled, clerical and sales work; professional, managerial and proprietor work), with farm operators split by tenure where published | Work-based class |
| 1940s | `wage_income` | Wage and salary income by race, where published | Earnings bands |
| 1950s–1980s | `family_income` | Family income brackets by race | Family income bands |
| 1990s–2000s | `household_income` | Household income brackets by race of householder | Household income bands |
| 2010s–2020s | `acs_household_income` | ACS five-year household income brackets by race of householder | Household income bands |

1890 is a regular decade. Its individual schedules burned in 1921, but its published tables survived.

### Income bands (1940s onward)

1. The threshold is the national median of the same measure (wages, family income or household income)
   in the same year, from the same publication.
2. **Lower:** below two-thirds of that median. **Middle:** two-thirds to double. **Upper:** above double.
3. A share is estimated within the published bracket that contains a threshold: linear within a closed
   bracket, and Pareto interpolation within the open top bracket, the Census Bureau's own method for
   medians. Every band is `derived` and says it is estimated.

Bands follow Pew Research Center's cutoffs but are not size-adjusted, because published tables do not
allow it. The surface says so. Thresholds are national, not adjusted for regional prices.

### Work-based class (1870s–1930s)

Before 1940 the census did not ask about income. Class comes from published occupation groups by race.
Tenant farmers are grouped with laboring work, because the census counted sharecroppers as tenant farm
operators, and ranking tenants with skilled workers would overstate the standing of rural Black and
Hispanic families. These are not income classes and are never labeled as income.

## Conditions

Conditions are shown for each group, not within a class tier: published tables do not cross income with
other measures by race. When a reader chooses a tier, the class shares respond and the conditions say
why they do not.

Conditions are shown only where a decade published them by race, for example literacy (1870–1930),
school attendance, educational attainment (1940 on), homeownership, living in a city, employment and
unemployment, farm tenure, and median income.

## What the count could see

Every decade carries sourced notes on how the census counted each group, what it could not see, and
what that meant: the 1921 fire, one-drop and "Mulatto" instructions, the 1930 "Mexican" category and
its removal, Spanish surname and Puerto Rican proxies, the 1970 sample question, and the measured
undercount of Black Americans from 1940 on. Notes follow the claim rules: a Tier-1 or scholarly source,
opened and quoted.

A missing figure links to the note that explains it. A missing number never stands in for missing
people.

## Suppression and coverage

- A published figure is shown as published. Values are never interpolated between decades or borrowed
  from another geography.
- **ACS:** figures carry the published margin of error. Levels with a coefficient of variation above
  30% are withheld, and those between 15% and 30% are flagged.
- **Decennial sample tables:** published without margins. A region figure whose base is below 500
  counted persons or households is withheld.
- **Partial coverage:** when a table covers only some of a region's states (for example 1950 nonwhite
  detail, published only for areas with 50,000+ nonwhite residents), the region figure states the share
  of the region's group population it covers. Below 80% it is withheld.

| Cell state | Surface |
|---|---|
| `published` | Value, with margin or coverage where known |
| `wide_margin` | Value with a wide-margin marker |
| `suppressed` | "Too few counted to say," linked to the reason |
| `not_measured` | "The census did not publish this," linked to the decade's count note |
| `pending` | Evidence appendix only. The guided reader does not publish production-state cells. |

## Build

The data is a static, versioned build, not a live feed. Tables are acquired, validated and loaded into
`bb_reference`, then frozen into one snapshot per region. Pages render from the snapshot. A rebuild
happens only when a source vintage changes or a correction lands.

## Rules in force

Laws and rulings come from the catalog. Their applicability lives in `bb_reference.law_applicability`:
the jurisdiction (the nation or a state), the in-force window taken from cited claims (never from
entity `statusHistory`), the groups the rule named in its own words, the life domains it touched, and
whether its text was exclusionary, protective or facially neutral. Federal rules appear in every region.
A state rule appears in its region with the state's name.

A facially neutral rule whose racial effect is a live scholarly dispute (for example the agricultural and
domestic worker exclusions of the Social Security Act of 1935) renders as a dispute.

## What the surface may say

The surface follows [juxtaposition-not-causation.md](./juxtaposition-not-causation.md). Every rules panel
carries the fixed disclaimer:

> Context indicators are published measurements from named custodians. Showing them with a law or
> place does not establish that the law caused the indicator values. Causal statements require
> separately evidenced claims.

Allowed:
- "In 1960, about N in 100 nonwhite families in the Deep South had incomes below two-thirds of the
  national median."
- "The Fair Housing Act was in force."

Not allowed:
- "Because of redlining, Black families earned less."
- "You would have been poor."

A causal sentence needs a gated claim citing peer-reviewed work. Narrative frames are validated so every
number in them matches a published or derived figure.
