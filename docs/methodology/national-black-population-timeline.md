# National Black population timeline, 1790–2020

What this timeline shows: the number of Black persons counted in each U.S. Census from 1790 through 2020, organized by decade. The figures are enumerated totals, never modeled or imputed. Geography reflects the contemporaneous U.S. extent at each census (territorial expansion is recorded as per-decade boundary metadata).

## Sources and lanes

The timeline merges two canonical, non-overlapping data lanes:

- **1790–1990 historical lane**: U.S. Census Bureau Working Paper 56 (Gibson & Jung, 2002), Table 1. National population by race, 1790–1990. Public domain (17 U.S.C. §105). [Landing page](https://www.census.gov/library/working-papers/2002/demo/POP-twps0056.html); [machine artifact](https://www2.census.gov/library/working-papers/2002/demo/pop-twps0056/table01.xlsx).
- **2000–2020 modern lane**: U.S. Census Bureau decennial SF1/PL (2000, 2010, 2020) via api.census.gov, "Black or African American alone" one-race table. National totals are computed by summing all county observations in the ingested dataset for each decade.

The two lanes cover disjoint years (no overlap, no double-count). Every figure published here originates in a government statistical artifact—nothing is modeled or LLM-generated.

## Race categories and historical labels

Census decades use different race-category labels. The timeline presents all figures under a single "Black" label for navigability, but the underlying category definitions shifted:

- **1790–1840**: "Enslaved persons and free colored persons" (separate counts; definitions vary by decade). Historical records of what was asked and tabulated.
- **1850–1890**: "Colored" / "Negro" (Census terminology of the era). Mid-nineteenth-century race categories reflect Reconstruction-era and Gilded Age Census schedules; category boundaries shifted across decades.
- **1900–1990**: "Negro" / "Black" (Census terminology until revised OMB standards). Twentieth-century decennial tables used these terms before the 1997 OMB standards and 2000 revision.
- **2000–2020**: "Black or African American alone" (modern one-race category). The 2000 Census introduced the multiple-race methodology and a revised race taxonomy; this represents a measurement-regime boundary (see below).

These figures are historical records of enumeration. They are not comparable to post-2000 "Black or African American alone" without explicit NHGIS harmonized tables and published methodology notes.

## Free and enslaved split, 1790–1860

The twps0056 historical lane records the Black population for decades 1790–1860 as a split:

- **Free persons**: the count of free Black persons
- **Enslaved persons**: the count of enslaved Black persons  
- **Total**: free + enslaved = the combined Black population for that decade

For every decade 1790–1860, the split is exact and verified by the ingestion process. From 1870 onward, the split column is blank: emancipation (the Thirteenth Amendment, ratified December 1865) ended the legal category, and Census enumerations no longer collected a separate enslaved count. The Black population 1870 onward is reported as a single total.

## Measurement-regime boundary: 2000

The 2000 Census introduced a major change in race-collection methodology. Prior to 2000, respondents selected one race; starting in 2000, the Census permitted selection of multiple races. The race categories were also revised under new OMB standards.

The result: **2000 opens a measurement-regime boundary.** The "Black or African American alone" one-race category introduced in 2000 is not directly comparable to the historical single-race "Negro" or "Black" categories collected 1900–1990, even though they share a label. The timeline marks 2000 as a boundary and does not present pre-2000 and post-2000 figures as perfectly comparable without historical context. Adjacent-decade comparisons that cross 2000 are flagged in the UI.

The timeline does NOT include figures for "Black or African American alone-or-in-combination" (which would capture respondents reporting Black as any part of their racial identity, introduced in 2000). Only the "alone" one-race figures are shown, and they represent a different concept than the historical enumerations.

## Census vs. ACS; boundary changes and territorial expansion

- **Census vs. ACS**: The timeline includes only Census Bureau decennial enumerations (every 10 years). American Community Survey (ACS) estimates, which are annual-rolling samples with different methodology, are not part of this timeline.
- **County boundary changes**: National totals are sums of contemporary county-level counts. Counties merged, split, or renamed across decades. These figures reflect the FIPS boundaries at each enumeration, not boundary-stable geographic units. To compute true county-level deltas across decades, use NHGIS-published geographic crosswalks.
- **Territorial expansion**: Early censuses did not cover the full modern United States. The figures for 1790–1890 reflect the geographic extent of the United States at each census, including territories and frontier regions as enumerated. Metadata per decade records this.

## 1870 Southern undercount caveat

The original 1870 Census enumeration is documented by the Census Bureau to have undercounted the Black population, particularly in the South. A partial re-enumeration was conducted. The published figure reflects the final 1870 total, but operators and analysts should be aware of the historical undercount and its regional concentration when interpreting 1870–1880 deltas.

## What is NOT in this timeline

- **Pre-1790 Black resident population**: No 1619 figure, no colonial-era estimates, no pre-enumeration series are published. The timeline begins with the first decennial Census in 1790.
- **Forced arrivals and transatlantic slave trade flow series**: The timeline documents resident population counts at enumeration points (1790, 1800, …, 2020). Import flows from the transatlantic slave trade are a separate historical series capturing movement/acquisition events, not resident population. These flows are not part of this timeline. (Slave-trade flow research is tracked in a separate beads item, repo-lcl9.3.)
- **Modeled or synthetic figures**: Every number here is enumerated. No Census imputation, no statistical model, no LLM generation appears in this timeline.

## Sources

**Gibson, Campbell, and Kay Jung. 2002. "Historical Census Statistics on Population Totals by Race: 1790 to 1990, and by Hispanic Origin: 1970 to 1990 for the United States, Regions, Divisions, and States."** Working Paper No. 56, U.S. Census Bureau, Population Division. [https://www.census.gov/library/working-papers/2002/demo/POP-twps0056.html](https://www.census.gov/library/working-papers/2002/demo/POP-twps0056.html). September 2002. Public domain (17 U.S.C. §105).

**U.S. Census Bureau. 2000, 2010, 2020. "Decennial Census of Population and Housing."** Via Census Data API (api.census.gov). Public domain.
