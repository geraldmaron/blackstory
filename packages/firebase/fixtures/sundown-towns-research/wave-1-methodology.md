# Sundown towns research — wave 1 methodology note

Bead: `the related workstream` (research component of `the related workstream`). Produced 2026-07-18.

## What this is

A citation-backed candidate list of individually documented sundown towns, staged at
`packages/firebase/fixtures/sundown-towns-research/wave-1-candidates.json`. It is **not** a
`SundownTownDesignationRecord` and cannot become one without further work — see "What's still
needed" below.

## Sources used

1. **Primary source: the Tougaloo College Historical Database of Sundown Towns**
   (https://justice.tougaloo.edu/sundown-towns/), the successor to James W. Loewen's original
   research database. The site's rendered HTML list pages (e.g. `/location/illinois/`) turned out
   to expose only bare town-name lists with no visible per-town confidence label or narrative —
   the confidence label and narrative live on each town's own page
   (`https://justice.tougaloo.edu/sundowntown/{slug}/`), which renders a structured "Basic
   Information / Sundown Town Status / Census Information / Method of Exclusion / Comments"
   record per town, including the site's own possible/probable/surely ("Sundown Town in the
   Past?") field. Every `primaryCitation.href` in the candidate list is a link to one of these
   individual town pages — the same link+attribute citation pattern
   `packages/domain/src/historic-safety/source-registry.ts` already requires for
   `tougaloo-sundown-towns`, not the gated bulk OSF dataset.
   - To find well-documented candidates efficiently across a nationwide, ~50-state scope, I used
     the site's own public GeoJSON endpoint (`https://justice.tougaloo.edu/wp-json/sundowntowns/geojson`)
     that powers its public interactive map at `https://justice.tougaloo.edu/map/` — the same data
     any visitor sees by panning the live map, returning only `{name, state, confirmed (0-4/8/9),
     permalink}` per point, no bulk geometry or academic dataset fields. This was used purely for
     *discovery* (which towns exist, at what confidence, with a link to their real page); every
     included entry's actual notes and citation come from reading that town's individual page and
     independent secondary sources, never from the discovery data itself. This is explicitly not
     the OSF-hosted Nature Scientific Data companion dataset (`sundown-towns-osf` in
     `packages/domain/src/external-data-sources.ts`) — that dataset was not accessed, downloaded,
     or referenced anywhere in this pass.
2. **Independent secondary sources** for corroboration on ~20 of the best-known cases: NPR,
   ProPublica Illinois, Texas Monthly, Smithsonian Magazine, Wikipedia, the Encyclopedia of
   Arkansas, Chicago History Museum, History News Network, WDET, the Goshen News, and similar.
   These are recorded in each entry's `corroboratingCitations` array where found. Most entries
   (especially "possible" and many "probable" ones) rely on the Tougaloo entry alone — this is
   flagged explicitly in `confidenceCaveat` for each such entry.

## Coverage

- **111 candidate entries across 45 states.** Confidence breakdown: 63 "surely", 39 "probable",
  9 "possible" (all confidence labels are the database's own verbatim terms — none were inferred
  or upgraded/downgraded by this research pass).
- Richest documentation: **Illinois** (Loewen's home state and the most heavily studied — Anna,
  Cicero, Carterville, Pekin, Effingham, Kenilworth here), **Indiana** (Martinsville, Elwood,
  Goshen — Goshen notably has a 2015 city-council resolution acknowledging its history), and
  **California** (multiple Chinese-exclusion cases from the 1880s-90s alongside Black-exclusion
  cases like Torrance, Hawthorne, Oildale).
- **States/territories where this pass found nothing verifiable at the individual-town level:**
  Alaska and Hawaii (zero entries of any confidence level exist in the Tougaloo database — plausibly
  reflecting each territory's very different demographic and racial history rather than an
  absence of the underlying phenomenon), North Dakota (several county-level "possible" entries
  exist but none had substantive supporting narrative beyond bare demographic statements — a
  Fargo entry was reviewed and excluded as too tangential to support even a cautious claim),
  Rhode Island and Vermont (Tougaloo lists a handful of towns in each state but every one had an
  empty "Comments" field in the individual page — general regional secondary-source commentary on
  New England sundown towns exists, but names no specific, individually verifiable town in either
  state), and the District of Columbia (its only Tougaloo entry, Washington itself, is rated only
  "Unlikely," below the possible/probable/surely bar this task requires). Absence of documentation
  in this pass is not proof of absence of the practice in any of these places — it means this
  research pass did not find an individually verifiable, citable case.
- Entries with thin or single-source support were still included where the underlying Tougaloo
  page had *some* concrete, checkable content (a quoted period newspaper, a specific named
  incident, a dated resident account), but every such entry carries an explicit
  `confidenceCaveat` describing the limitation (secondhand oral history, single email submission,
  disputed characterization, etc.). A small number of reviewed towns (e.g. La Crosse, WI, whose
  own Tougaloo page states "not a confirmed sundown town, more information needed"; Keya Paha
  County, NE, whose page states only "we currently only have census information") were excluded
  outright as not meeting even a cautious bar.

## What's still needed before this becomes a real layer signal (a later session's job)

Per `packages/domain/src/historic-safety/layer-record.ts`, a real `SundownTownDesignationRecord`
requires:

1. A resolved `placeEntityId` for each town/county, linked against this product's actual place
   entity graph (not fabricated here).
2. Real area geometry (`Polygon`/`BBox`) at the documentation's actual precision — most of these
   sources document a town or county, not a precise boundary; geometry must be sourced separately
   at the correct precision, not approximated or invented.
3. A Firestore loader/ingest script wiring the above together, subject to the same citation and
   confidence-label-preservation requirements documented in `source-registry.ts`.

This candidate list intentionally stops short of all three — it is research output only.
