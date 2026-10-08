# Lincoln High School and comparable Black secondary-school sites

Research packet, 7 October 2026. Bead: `repo-b5yma`. This is a bounded research and
catalog-accuracy review, not a publication decision or a national census of schools.

## Question and method

The starting assertion is that the historic campus near 22nd Street and Woodland Avenue
in Kansas City, Missouri, is Lincoln High School, now Lincoln College Preparatory
Academy. The comparison set is five public secondary schools that served Black students
under segregation and have documented historic sites: Sumner in St. Louis, Dunbar in
Little Rock, Booker T. Washington in Atlanta, Howard in Wilmington, and Robert Russa
Moton in Farmville. They differ in whether the original high-school use continues. That
difference is part of the research question, not a reason to flatten them into one story.

Search bounds: exact and variant school names with city and state; National Register and
National Historic Landmark nominations; state preservation offices; current school
districts; the Moton Museum; and local university/library research for Lincoln alumni.
The live public release `rel_20260918_dunbar_media_correction_001` was inspected on
7 October 2026 (artifact generated `2026-10-07T23:47:10.043Z`, 4,210 entities) for
identity and duplicate checks. This is a selected comparison, not exhaustive coverage.
No independent second reviewer or archival visit took place. No unlisted source is
counted as having been read.

The repository's `research-intake` preview was attempted against the official Lincoln
school page. Its DNS-pinned safe fetch returned `dns_resolution_failed`; it made no draft
case or database write. The public sources below were opened through the available web
research service. No source capture, private text retention, publication, graph change,
or schedule was made by that initial Lincoln run. The later entity pass below created
separate draft cases and captures.

## Kansas City: identity, building, and time

**Supported place identity.** The [National Register nomination, pp. 1, 6, 13–14](https://mostateparks.com/sites/g/files/zuston361/files/media/pdf/2025/02/lincoln-high-school-jackson-county.pdf)
names the historic property Lincoln High School, gives **2111 Woodland Avenue**, and
lists Lincoln College Preparatory Academy as another name. The [current school page](https://lcpa.kcpublicschools.org/o/lcpa/) gives the same street address and current
name. The [Missouri register listing](https://mostateparks.com/basic-page/missouri-national-register-listings/Jackson)
confirms the national listing on **15 January 2014**. That date is a designation date,
not a founding or construction date.

**Dates that must remain separate.** The nomination's property history (pp. 13–14) says
the Kansas City district created Lincoln School for African American pupils in **1867**,
introduced high-school coursework in **1882**, and completed the first such program in
**1885**. A dedicated high-school building followed in **1890** at the earlier 11th and
Campbell site. The school moved to **19th and Tracy in 1906**. The district obtained the
Woodland property in **1931**; construction began in **1935**; the present building opened
for classes in **September 1936**. Its south wing was added in **1966**. The nomination
assigns the *property* a 1935–1966 period of significance. The [school's historical brochure, p. 1](https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5738/Kcps/7b8cd2f8-72a7-41b7-8eb4-a2e00b79ac25/Download-LCPA.pdf?disposition=inline)
also dates the move to 1936 and the 1890 post-elementary building. Its use of **1865**
for the original school's founding conflicts with the nomination's **1867** district
opening; neither opened source establishes whether the brochure means an earlier,
informal school. Hold the 1865 founding year as disputed.

**Place wording.** The nomination gives a geographic point of `39.087127, -94.560049`
(p. 4), but elsewhere calls the 1931 property “21st and Woodland” (p. 14). The
[Kansas City African American Heritage Trail](https://aahtkc.org/lincolnhighschool)
calls it “22nd & Woodland.” The nomination's
site description places the property north of East 22nd Street (p. 6). The school
itself uses 21st and Woodland in its brochure. Use **2111 Woodland Avenue** as the
sourced address. An intersection label alone is approximate; verify the property
boundary before choosing a point.

**Safe proposed short copy, still staged:** “The Lincoln High School building at 2111
Woodland Avenue opened for classes in September 1936. It served a school the Kansas
City district had operated for African American students since at least 1867; today
the institution is Lincoln College Preparatory Academy.” The nomination supports the
opening and district history; the current school page supports the present name. The
phrase “since at least 1867” avoids settling the 1865/1867 dispute by assertion.

## Catalog findings that change a reader's understanding

These observations concern the current public release, not just an old fixture.
“Correction forcing” means the present wording or number should be revised after a
scoped publication review; it does not grant that review.

| Record | Finding and evidence | Disposition |
| --- | --- | --- |
| `nrhp-black-heritage-13001086` (Lincoln) | The summary states an unqualified **1865** founding and says the school “became a high school in 1890.” The [nomination, pp. 13–14](https://mostateparks.com/sites/g/files/zuston361/files/media/pdf/2025/02/lincoln-high-school-jackson-county.pdf) separates 1867 district school, 1882 high-school coursework, and 1890 dedicated building. The school brochure supports 1865 only as a retrospective institutional assertion. | **Correction forcing:** distinguish those events; leave 1865 disputed. |
| Same | The summary lists **Charlie Parker among graduates**. [UMKC's Marr Sound Archives account](https://charlieparkerskc.org/gigging-around-town) says he attended the **19th-and-Tracy** site and left after tenth grade. The present Woodland building opened later. | **Correction forcing:** “former student”; do not imply he studied in the present building. |
| Same | `statusHistory` begins `active` in **1860**, before either attested school date, with no basis claim IDs. The public point (`39.089008862,-94.560302004`) is about **210 m** from the nomination's point. A large campus and differing points make this a location-review issue, not proof that either point is wrong. | **Correction forcing** for invented 1860 start; **needs validation** for the pin against the nomination's site plan and current parcel. |
| Same | The context says citywide Jim Crow laws had not existed before 1900, while the [nomination, p. 21](https://mostateparks.com/sites/g/files/zuston361/files/media/pdf/2025/02/lincoln-high-school-jackson-county.pdf) documents Missouri's 1865 legal requirement for separate Black schools. “Citywide laws” may mean a narrower municipal category, but the copy leaves that qualifier unexplained. | **Revise or substantiate:** specify the law and jurisdiction; do not imply school segregation began after 1900. |
| `gap_sumner_high_school` | The summary says “first Black public high school west of the Mississippi,” with Wikipedia as the only displayed source. The [NPS St. Louis history](https://home.nps.gov/articles/000/black-life-in-st-louis-during-reconstruction.htm) makes that claim and dates the school to 1875; it needs a precise source link and a bounded counterexample check before a superlative remains in public prose. | **Needs validation** of the superlative at the stated scope; replace the Wikipedia-only citation. |
| Same; `nrhp-black-heritage-88000469` | Two live entries describe the same St. Louis institution/building at **4248 Cottage Avenue**. The first has `status: historic`, which [BlackStory defines as no longer active](../../apps/web/src/lib/map-experience/metadata-help.ts), while the [district's current Sumner site](https://sumner.slps.org/) shows an operating high school in 2026. The second is a thin National Register building entry. The first context also says Sumner was “one of only two” Black public high schools *until* Vashon opened in 1927, an internally contradictory count. | **Correction forcing:** resolve status and count wording; reconcile the two entities without losing either the school history or the property designation. |
| `ent_moton_high_school_001` | Context says Moton was built for **200** students. The [NHL nomination, p. 9](https://www.dhr.virginia.gov/wp-content/uploads/2023/03/144-0053_RobertRussaMotonHS_1994_Nomination_NHL.pdf) and [Moton Museum](https://civilrightstour.motonmuseum.org/places/robert-russa-moton-museum.html) state **180**. It also calls the school “affiliated” with Brown v. Board NHP in **2022**; [NPS](https://www.nps.gov/brvb/getinvolved/partners.htm) distinguishes 2022 authorization from formal designation in **2025**. | **Correction forcing:** 180 capacity; distinguish authorization from designation. |

No claim of independent corroboration is made when a district page repeats a nomination
or when multiple sites copy the same institutional history. The Lincoln nomination
uses earlier district records and scholarship; its exact cited works are listed on pp.
27–29. The conflicting 1865 date still requires those underlying records before a
founding-year correction can be final.

## Comparable sites and what each comparison teaches

| School and historic site | Evidence inspected | Catalog handling |
| --- | --- | --- |
| **Sumner High School**, St. Louis, Missouri, 4248 Cottage Avenue | [NPS](https://home.nps.gov/articles/000/black-life-in-st-louis-during-reconstruction.htm) dates the institution to 1875 and describes earlier sites; the [district](https://sumner.slps.org/) shows the school operating at Cottage Avenue in 2026. Institution age and current building age are distinct. | Existing school `gap_sumner_high_school` and National Register place `nrhp-black-heritage-88000469`; reconcile before creating anything. |
| **Paul Laurence Dunbar High School**, Little Rock, Arkansas, 1100 Wright Avenue | [NPS](https://www.nps.gov/places/paul-laurence-dunbar-high-school.htm) dates the building to 1929 and the end of high-school use to 1955. The [district](https://www.lrsd.org/o/dunbar/) identifies the current use as Dunbar Magnet Middle School. NPS documents both community achievement and unequal funding. | Existing `nrhp-black-heritage-80000782`; verify its status display against continued school use at a different grade level. Do not merge with D.C. Dunbar schools. |
| **Booker T. Washington High School**, Atlanta, Georgia, 45 Whitehouse Drive SW | [City preservation record](https://www.atlantaga.gov/government/departments/city-planning/historic-preservation/property-district-information/booker-t-washington-high-school) and [Atlanta Public Schools](https://washington.atlantapublicschools.us/our-school) date opening to 1924. The city supports “first Black public secondary school in Atlanta”; the district makes a wider Georgia claim that needs a separate comparison. | The later identity check found no matching canonical record; a draft case and record proposal appear below. Do not merge with Philadelphia, Mississippi, or Staunton, Virginia schools of the same name. |
| **Howard High School**, Wilmington, Delaware, 401 East 12th Street | [NPS](https://www.nps.gov/brvb/getinvolved/partners.htm) ties travel to the segregated school to *Belton v. Gebhart* and confirms its present use as Howard High School of Technology. The [current school contact page](https://howard.nccvt.k12.de.us/apps/contact/) confirms the address. | The later identity check found no matching canonical record; a draft case and record proposal appear below. The historic building site differs from the modern school's mailing address. |
| **Robert Russa Moton High School**, Farmville, Virginia, 900 Griffin Boulevard | [Virginia DHR](https://www.dhr.virginia.gov/historic-registers/144-0053/) and the [NHL nomination](https://www.dhr.virginia.gov/wp-content/uploads/2023/03/144-0053_RobertRussaMotonHS_1994_Nomination_NHL.pdf) date the building to 1939 and the student strike to 23 April 1951; the site is now a museum. [NPS](https://www.nps.gov/brvb/getinvolved/partners.htm) confirms the 2025 affiliated-area designation. | Existing place `ent_moton_high_school_001` and separate strike event `ent_moton_high_school_student_strike_001`; keep site and event distinct, correct the place context. |

These examples support a repeatable research pattern: record the **institution**, its
**successive campuses**, the **period of the event or educational use**, and the
**current function** separately. A school can continue at a historic campus, change
grade levels, or become a museum. A designation date establishes recognition of a
property, not the date Black education began there. A notable former student's
connection to an institution does not place that student in every later building.

## Adversarial check and handoff

The strongest threat to this packet is an apparently authoritative but conflated
institutional history. The Lincoln district's 1865 statement and the nomination's
1867 account disagree; the nomination itself alternates between 21st and 22nd Street
in describing the Woodland site. Neither conflict is solved by counting domains.
The proposed Lincoln short copy avoids the disputed founding year and uses the
street address; an independent review of contemporaneous district minutes or
Freedmen's Bureau records could change the earliest date.

The strongest threat to a national “first school” claim is an omitted earlier
school or a shift between elementary, secondary, public, and privately supported
education. This selected run did not establish a national priority order. The
comparison is about documented campuses and different institutional paths.

Initial self-review verdict: **revise** the identified catalog errors, **hold** any new
firstness wording and new entity proposals until duplicate and source checks are
complete. The later pass below performed those checks. The packet is suitable for a
scoped correction review. The next
operator pass should use the existing record IDs, inspect the original claim/source
rows and site plans, then run the standard publication preview. The research-intake
DNS failure and absence of durable case IDs must be resolved before claiming an
operator-ledger research run. Follow-up is tracked in `repo-pl8yw` (catalog
corrections and release checks) and `repo-lmlid` (source capture, disputed
founding date, and new-lead identity checks).

## Entity proposal pass, 7 October 2026

A read-only check of the live `canonical.entities` names, aliases, identifiers,
and the active release found no Atlanta Booker T. Washington or Wilmington
Howard school entry. National Register identifiers **86000437** and **85000309**
were also absent. The matching Booker T. Washington High School record in the
release (`nrhp-black-heritage-100006878`) is in **Philadelphia, Mississippi**;
its name must not be used to merge the Atlanta site. The four other schools in
this packet already had records. This is a targeted duplicate check, not proof
that no differently named related entity exists anywhere in the catalog.

Two draft cases now exist in the operator store: Atlanta
`72a89557-945e-4385-90b4-05503de94f61` and Wilmington
`c5a0c071-b48f-4577-8d1a-f7f1fce7f8e3`. The safe-fetch intake captured
the Atlanta district page (`cap_7cc823fa3577555b`) and the NPS Howard partners
page (`cap_a7b55c30f9b74cb7`). Five further source attachments were staged
for review. Their intake status is `pending_review`; the two research cases
remain `candidate`. The [exact proposed canonical records](./historic-black-school-entity-proposals-2026-10-07.json)
pass `validateCanonicalPromotionRecord`, which tests shape and host count, not
historical truth or authorization. No canonical or public entity was inserted.

The Atlanta proposal uses the [1986 National Register nomination](https://npgallery.nps.gov/GetAsset/9814b816-e5bd-4513-8b58-415d397c5297)
for the 1924 building and the [current school page](https://washington.atlantapublicschools.us/our-school)
for present operation and address. The city preservation page repeats the
nomination, so it is not counted as a third independent account. The Census
address match for 45 Whitehouse Drive SW is `33.754226206663,
-84.419939391463`; the proposed precision is `institution`.

For Howard, the [National Historic Landmark nomination](https://npgallery.nps.gov/GetAsset/81caf24c-7dae-4316-8ada-a13a4d8647ce)
places the historic building at the northeast corner of 13th and Poplar
Streets. The [Delaware Public Archives account](https://archives.delaware.gov/2026/02/27/delawares-fight-for-school-desegregation-part-1/)
separately documents the Claymont students' journeys and unequal conditions
in *Belton v. Gebhart*. The nomination describes a **1927** building and a
**February 1929 dedication**; a [state historical marker](https://archives.delaware.gov/delaware-historical-markers/howard-high-school/)
says the new building opened in **1928**. The proposed short copy omits an
opening year until those date types are reconciled. The current school's
**401 East 12th Street** mailing address is different from the nominated
building's street-corner description. Census could not match the intersection;
it matched the state marker's 1301 Clifford Brown Walk address at
`39.746614569487, -75.542095519286`. A marker point is not proof of a point
inside the landmark's 0.7-acre building boundary. The proposed entity therefore
has **no location**. The marker match remains a lead for boundary review, not a
publishable pin.

The strongest failure mode is letting the machine's two-host count certify
independent historical works or letting a geocoded modern school address stand
in for the nominated building. The viable alternative is a sparse record with
only exact, reviewed claims, and a withheld or coarsened pin. Verdict:
**accepted with controls** for the Atlanta draft; **accepted without a pin** for
Howard's draft, with its opening date omitted. The promotion path now allows a
minimum-record case without a location and records unassessed confidence and
lineage honestly. The machine's two-host check is still only a host check;
a reviewer must assess work-level independence. An authenticated review must advance
the cases; an actor with publication permission must promote a final record and
activate a release. The same person may propose and approve, but evidence,
permission, audit and activation checks still apply.

### Publication preview for the two new records

| Check | Atlanta | Wilmington |
| --- | --- | --- |
| Identity and duplicate scan | Atlanta site distinguished by 45 Whitehouse Drive SW and NRIS 86000437; the same-name Mississippi record is separate. | Wilmington school distinguished by 13th and Poplar Streets and NRIS 85000309; Howard University is separate. |
| Summary support | The nomination supports the 1924 opening and Black public secondary use; the operating district page supports the current name and address. Their historical accounts may share an underlying source. | The landmark nomination supports the historic building site and *Belton* connection; Delaware Public Archives supports the Claymont bus journey; NPS supports the current school name and continued use. Work-level source independence still needs review. |
| Place and era | The nomination and district both give 45 Whitehouse Drive SW. Census matched the address at institution precision. The 1920s bucket comes from the school opening, not the 1986 listing. | The 1920s bucket describes the documented historic building; the 1950s bucket describes *Belton*. No coordinate is included until the landmark building boundary is checked. |
| Release status | Draft case, candidate state; no canonical or public entity. | Draft case, candidate state; no canonical or public entity. |

`validateCanonicalPromotionRecord` passes both proposed shapes. It verifies host
count, format and broad coordinate bounds when a point exists; it cannot verify
historical truth, work-level lineage, image/copy rights, or the proposed point's
parcel. The remaining review must attach accepted evidence to each case's
checklist, assess contradictions and rights, inspect the final wording, and
preview the release claim diff. No image is proposed. The nomination's inaccurate
Wilmington ZIP code is not carried into the draft.

The earlier promotion route compared a caller-supplied `proposerId` with the
authenticated approver's UID. That comparison could not prove separate actors.
The revised route removes the caller-supplied proposer field and permits one
authenticated publication actor to complete the final review. The two hosted
cases remain `candidate` with no completed checklist items, so this code change
does not itself make either entity canonical or public.

The Atlanta city page returned an Access Denied document to the CLI safe
fetch while reporting `ok: true`. It was read through the web research service
but was not used as the intake capture or counted as independent from its
underlying nomination. The safe-fetch success semantics need a separate
diagnostic check before relying on that page in a publication packet
(`repo-4plsp`). The catalog lead matcher also has a Booker T. Washington
shortcut to Tuskegee University and a name-only match that could absorb the
Atlanta school into the Mississippi record. This pass used the live catalog
identity check instead; matcher repair is tracked in `repo-tqhwr`.

## Final school-record review, 8 October 2026

The two proposed new records were checked against the original nominations and
current official sites again. This was an assistant self-review, authorized by
the owner, with no independent second reviewer or archival visit.

| Exact assertion in the final proposal | Evidence inspected and locator | Decision and limit |
| --- | --- | --- |
| Atlanta school opened in September 1924 | Georgia DNR nomination, PDF p. 6, historic narrative; Atlanta Public Schools, Our School, About Us | Supported. The nomination distinguishes January building completion from September school opening. No statewide firstness claim is included. |
| Atlanta school was a public secondary school for Black students at 45 Whitehouse Drive SW | Nomination, PDF pp. 1, 3 and 6 | Supported at the stated institutional and street-address scope. Census coordinates identify the institution approximately; they do not establish an exact historic entrance or parcel survey. |
| Atlanta school still operates at that address | Current district school page, About Us, school services and footer address, checked 8 October 2026 | Supported as current school operation. No public-access or visiting-hours claim is made. |
| Howard historic building is at 13th and Poplar Streets | Howard NHL nomination, printed p. 4, site description | Supported. The nomination distinguishes the historic building and annex from the adjacent 1970s vocational building. The current school's 401 East 12th Street mailing address is not substituted for the historic building's location. |
| Black students from Claymont had to travel to Howard instead of attending the local white high school; their families challenged segregation in Belton v. Gebhart, considered in Brown | Delaware Public Archives, 27 February 2026 account, paragraphs on Claymont parents and Belton; NPS Brown park Partners, Delaware sites section | Supported. The record does not extend this connection to every student or imply Howard was the school the families sought to enter. |
| The school now operates as Howard High School of Technology | NPS Partners, Howard entry; current Howard official homepage, principal's message, current school calendar and contact address, checked 8 October 2026 | Supported at institution level. Revised from a stronger assertion about continuing use of the specific historic building. |

The Howard state marker says the new building opened in 1928. The NHL nomination's
interior description refers to opening photographs from 1927 and its historical
narrative describes a February 1929 dedication. Those may describe different events;
this review does not resolve a precise opening year. The final proposal therefore
asserts no opening year, founding year or exact pin. The 1920s era is a broad historical
bucket, not a hidden assertion of a particular opening date. The marker's Clifford
Brown Walk address and Census match do not prove a point inside the nominated boundary.
The nomination's inconsistent ZIP is not ingested.

A fresh live check found the exact proposed canonical IDs absent. Similarly named
canonical entries have coordinates in Missouri (Howard and Howardville), South Carolina
(Washington auditorium), Mississippi (Booker T. Washington) and Virginia (Washington
High School); none identifies the Atlanta or Wilmington site. This supplements the
previous name, alias and National Register identifier check. No unrelated entity is
merged or rewritten.

The proposed copy contains no superlatives, invented causal relationship, unsupported
alumni connection, image, or reconstructed historical quotation. Source hosts are not
counted as independent works: the district and NPS accounts may share earlier institutional
histories. Each clause has direct passage support at its stated scope, but this does not
establish calibrated confidence or research completeness. The proposal JSON is the exact
proposed input for canonical promotion; draft hashes and authenticated audit IDs are
recorded in the case history when that operation succeeds.

### Publication limitation

The two prior capture IDs, `cap_7cc823fa3577555b` (Atlanta district) and
`cap_a7b55c30f9b74cb7` (NPS Partners), were inspected through `capture_origins`.
Both contain `stored: metadata-only`; neither retains the source text. Citation
excerpts and this passage review do not turn them into preserved sources or accepted
selector assignments. The numerical confidence fields required by the current
publication ledger cannot be truthfully filled from this qualitative review.
The existing issue `repo-c08gr` tracks an honest qualitative-assessment representation.
Canonical promotion can preserve the reviewed sparse records while public publication
remains held. No release activation, search projection or public artifact write is
justified by a successful canonical insert alone.
