# Live data landscape audit

Date: 2026-07-23

Database: Supabase Postgres 17.6

Scope: BlackStory product schemas, active release, research operations, evidence lineage, and
historical-coverage signals

## Finding

Before this audit, `bb_public.release_entities` was the effective source of record. The active
release held 1,367 entities and 3,625 embedded claims, while the normalized canonical ledger held
666 placeholder entities, no claims, no claim versions, no evidence links, and no locations.
Seven hundred one published entities did not exist canonically.

That divergence has been reconciled. The live canonical ledger now contains:

| Record class | Live count |
|---|---:|
| Canonical entities | 1,367 |
| Canonical locations | 1,367 |
| Canonical claims | 3,634 |
| Immutable claim versions | 3,634 |
| Claim-evidence links | 3,634 |
| Evidence source organizations | 581 added by convergence |
| Evidence sources | 679 added by convergence |
| Source items and evidence records | 2,017 each |
| Canonical relationships | 543 |

The additional nine claims recover cited source material for four original seed records whose
hosted `claims` values were malformed empty objects. The recovery uses already-authored repository
citations for Fifteenth Street Presbyterian Church, Paul Laurence Dunbar High School, the 1975
D.C. historic-sites listing, and the Dunbar Alumni Federation. It does not infer claims from
summaries.

The backfill records an important limitation honestly: the public projection retained citation
names and URLs, but not archived source captures or supporting excerpts. Those references are now
normalized and linked, but they are marked uncaptured and excerpt-unavailable rather than being
treated as complete archival evidence.

## Authority model

The enforced data direction is:

`research discovery → review → bb_canonical + bb_evidence → bb_public release projection`

`bb_canonical.entities`, `bb_canonical.claims`, immutable `claim_versions`, canonical locations
and relationships, and `bb_evidence.*` are authoritative. `bb_public.release_entities` is a
read-optimized release artifact.

The Firestore-to-Postgres release writer now fails closed unless:

- The canonical entity already exists and its name and kind match.
- The public summary, taxonomy, media reference, and coordinates match canonical data.
- Every public claim resolves to the entity’s current immutable canonical claim version.
- Claim predicate, object, confidence, and citation reference match canonical data.
- Claims are a non-empty array; malformed legacy objects cannot be republished.

This prevents another public-only entity or silently divergent assertion from entering Supabase.

## Plantation diagnosis

The active release contains 19 explicitly named plantation entities and 33 records whose
historical text mentions plantations. All 19 named sites have map coordinates:

- Callaway Plantation
- Destrehan Plantation
- Evergreen Plantation
- Frogmore Plantation
- Hampton Plantation
- Kingsley Plantation
- Laura Plantation
- Magnolia Plantation
- Magnolia Plantation and Gardens
- McLeod Plantation
- Myrtles Plantation
- Nottoway Plantation
- Oakland Plantation
- Ormond Plantation House
- Pomfret Plantation
- Salisbury Plantation
- St. Joseph Plantation
- Whitney Plantation Historic District
- Whitney Plantation

Loading the active Supabase projections through the application’s current map-tone resolver
produces 19 plantation-toned map features. Seeing only four is therefore more consistent with a
stale deployment, cached release, or runtime data-plane mismatch than with the live database.

Classification remains too dependent on text matching. No named plantation currently resolves
through a controlled `plantation` topic, and only 200 of 1,367 public records have a populated
top-level taxonomy object. A plantation class must supplement—not replace—claim-level descriptions
of enslaved labor, ownership, resistance, emancipation, descendant communities, archaeology, and
memorial interpretation.

## Coverage gaps and realistic source programs

The following are high-value, realistically obtainable source programs. Inclusion in this list is
not permission for indiscriminate publication; each record still requires relevance, identity,
location, evidence, and dignity review.

### National structured sources

1. **National Underground Railroad Network to Freedom**

   The [National Park Service listings](https://www.nps.gov/subjects/undergroundrailroad/ntf-listings.htm)
   expose a structured national CSV with approximately 1,335 listings, addresses, counties,
   freedom seekers, Underground Railroad operators, and abstracts. It is the strongest immediate
   candidate for a bounded national research lane. Coordinates should be geocoded later at the
   precision supported by the listing.

2. **African American Civil Rights Network**

   The [National Park Service member list](https://www.nps.gov/subjects/civilrights/network-members.htm)
   provides an authoritative national roster of sites, programs, and organizations. An adapter
   should preserve membership status and the NPS record URL rather than treating membership as a
   complete historical interpretation.

3. **National Register of Historic Places**

   The [National Register data and research portal](https://www.nps.gov/subjects/nationalregister/database-research.htm)
   publishes a current national CSV with more than 100,000 listings. Targeted African American
   history filters, Multiple Property Listings, and state nomination documents are higher value
   than importing the complete register.

4. **Civil War Soldiers and Sailors System**

   The [NPS Civil War database](https://www.nps.gov/subjects/civilwar/soldiers-and-sailors-database.htm)
   covers people, military units, cemeteries, battles, prisoners, medals, and monuments, including
   United States Colored Troops. This requires new first-class entity types for military units and
   cemeteries.

5. **Enslaved.org**

   [Enslaved.org linked-open-data documentation](https://docs.enslaved.org/lod/) describes a
   machine-readable graph of people, events, places, and source records. It is best used for
   targeted identity resolution and relationship enrichment, not mass publication.

6. **Library of Congress**

   [Library of Congress APIs](https://www.loc.gov/apis/) and Chronicling America support
   newspapers, publications, photographs, maps, and place-time research. Newspaper assertions
   must preserve issue, page, date, and OCR uncertainty.

7. **Smithsonian Open Access and SOVA**

   [Smithsonian Open Access](https://www.si.edu/openaccess) and the
   [Smithsonian Online Virtual Archives](https://sova.si.edu/) provide artifacts, archival
   collections, finding aids, oral histories, and media. Place associations must come from
   documented collection metadata rather than inferred subject proximity.

### Federated source families

- State Historic Preservation Office GIS and survey inventories, beginning with states that
  publish downloadable ArcGIS services such as the
  [North Carolina Historic Preservation Office](https://www.hpo.nc.gov/survey-and-national-register/gis-maps-and-data).
- African American cemeteries and burial grounds, assembled from state, county, municipal,
  university, church, descendant-community, and preservation datasets rather than a presumed
  complete national list.
- Black hospitals, nursing schools, clinics, and medical associations.
- Mutual-aid societies, benevolent societies, fraternal orders, women’s clubs, and labor unions.
- Historic Black towns, freedpeople’s settlements, neighborhoods, and displacement sites.
- Black-owned banks, insurers, newspapers, hotels, restaurants, and Green Book businesses.
- Maritime, port, canal, railroad, and industrial sites tied to Black labor and migration.
- Plantation archaeology, enslaved-community landscapes, descendant communities, and
  interpretation sites, with explicit care around precision and stewardship.

## Missing entity vocabulary

The current broad classes—person, place, organization, event, legal, work, and movement—are useful
top-level groupings but insufficient as the sole vocabulary. Controlled subtypes should include:

- cemetery, burial ground, plantation, farm, historic district, neighborhood, town, settlement,
  residence, church, museum, archive, library, hospital, school, college, and university;
- bank, insurer, business, mutual-aid society, fraternal order, women’s club, labor union,
  military unit, regiment, and government agency;
- newspaper, periodical, book, archival collection, oral history, photograph, map, monument, and
  artifact;
- strike, boycott, uprising, migration, court case, legislation, election, massacre, landmark
  designation, and preservation campaign.

Subtype vocabulary should be multi-valued where history requires it. A church can also be a school
site, organizing venue, refuge, and landmark. A plantation is not adequately described by an
architectural label alone.

## Research-operation gap

Corsair’s overnight enrichment service is active and productive, but its run lineage is not
persisted to Supabase. The most recent observed run executed 134 discovery queries, returned 5,320
hits, added 555 candidates, and produced 427 keep decisions, yet `bb_research.runs` and
`bb_research.frontier_tasks` remain empty.

The runtime currently writes local cache artifacts and research cases without creating the
documented run/activity/model-invocation chain. Synthetic runs should not be invented after the
fact. Discovery source-program runs and candidate references should be persisted first; per-case
runs should begin only after a case exists, or a reviewed schema change should introduce an
explicit batch-run concept.

## Evidence and publication cautions

- The 2,017 recovered citation URLs are references, not source captures.
- Citation availability, archival snapshots, excerpts, rights, and source independence still
  require dedicated evidence work.
- Public release rows should never be edited as a second canonical store.
- Research automation may propose candidates and claims but must not publish them.
- Coordinates must remain no more precise than the supporting record.
- Coverage counts and regex probes are discovery signals, not completeness claims or controlled
  taxonomy.
