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
or schedule was made by this run.

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
| **Booker T. Washington High School**, Atlanta, Georgia, 45 Whitehouse Drive SW | [City preservation record](https://www.atlantaga.gov/government/departments/city-planning/historic-preservation/property-district-information/booker-t-washington-high-school) and [Atlanta Public Schools](https://washington.atlantapublicschools.us/our-school) date opening to 1924. The city supports “first Black public secondary school in Atlanta”; the district makes a wider Georgia claim that needs a separate comparison. | No exact Atlanta school name appeared in the inspected live catalog name scan. Search aliases and location before drafting a new entity. Do not merge with Philadelphia, Mississippi, or Staunton, Virginia schools of the same name. |
| **Howard High School**, Wilmington, Delaware, 401 East 12th Street | [NPS](https://www.nps.gov/brvb/getinvolved/partners.htm) ties travel to the segregated school to *Belton v. Gebhart* and confirms its present use as Howard High School of Technology. The [current school contact page](https://howard.nccvt.k12.de.us/apps/contact/) confirms the address. | No exact Howard High name appeared in the inspected live name scan; search aliases and NRHP ID before a new record. Keep the school distinct from Howard University. |
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

Self-review verdict: **revise** the identified catalog errors, **hold** any new
firstness wording and new entity proposals until duplicate and source checks are
complete. The current packet is suitable for a scoped correction review. The next
operator pass should use the existing record IDs, inspect the original claim/source
rows and site plans, then run the standard publication preview. The research-intake
DNS failure and absence of durable case IDs must be resolved before claiming an
operator-ledger research run. Follow-up is tracked in `repo-pl8yw` (catalog
corrections and release checks) and `repo-lmlid` (source capture, disputed
founding date, and new-lead identity checks).
