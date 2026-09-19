# Lives: reading historical objects

Working research and implementation record, 18 September 2026. This is a bounded addition, not certification of complete Life Worlds coverage.

## Execution brief

Build a reader that helps a visitor encounter a particular historical world through original material, an attributed account, a documented mechanism, and a route into further reading. Make years prominent, remove repeated measure headings, use meaningful destination icons, and retain responsive, accessible layouts. Add only what has substantive evidence. Never convert a local example into a national experience, assign thoughts to photographed people, or infer causation from adjacent rates and laws.

Casual readers get an object and a short close reading. Educators get a question, image description, and original source. Researchers get dates, scope, provenance, definitions, and record/chapter links. These are design hypotheses, not findings from user interviews.

## Inspected sources

All records below were opened on 18 September 2026. Embedded images were also opened and visually inspected. No generated historical imagery is used.

| Item | Use and exact locator | Reproduction decision |
| --- | --- | --- |
| [Du Bois, City and rural population. 1890](https://www.loc.gov/item/2013650430/) | LOC item notes identify preparation for the 1900 Paris Exposition. Image labels give 78,139; 8,025; 37,699; 734,952. Georgia only; creation and data years remain separate. | LOC: no known restrictions on publication. Full frame; verbal description and transcription. |
| [Du Bois, Value of land owned by Georgia Negroes](https://www.loc.gov/item/2013650437/) | Item notes and six labeled money bags. 1875 $1,263,902; 1880 $1,522,173; 1885 $2,362,889; 1890 $3,425,176; 1895 $4,158,960; 1899 $4,220,120. Values are historical dollars, not ownership rates. | LOC: no known restrictions. Visual inspection corrected the initial description from bars to money bags before release. |
| [Johnston, History class, Tuskegee Institute](https://www.loc.gov/pictures/item/98503043/) | LOC date 1902, photographer Frances Benjamin Johnston, Tuskegee, Alabama. Class and institution identified; individual names absent. | LOC: no known restrictions. People shown as students in the documented classroom, never anonymous decoration or representatives of every school. |
| [Executive Order 8802](https://www.archives.gov/milestone-documents/executive-order-8802) | 25 June 1941. Second WHEREAS clause; provisions 1–3; NARA historical introduction on Randolph and the threatened march. | Federal government order, RG 11. First-page scan; full transcript linked. Policy intent distinguished from enforcement and measured effects. |
| [Brown v. Board of Education](https://www.archives.gov/milestone-documents/brown-v-board-of-education) | 17 May 1954. Opinion's conclusion and NARA introduction on Brown II and resistance. | Federal judicial opinion, RG 267. First page only, clearly captioned; accessible full transcript linked. |
| [Washington, Up from Slavery](https://docsouth.unc.edu/fpn/washington/washing.html) | 1901 autobiography, chapter II, pp. 26–32. Furnace work, family income, community-paid teacher, evening lessons, and work before/after school. | Short attributed textual quotation; no reproduction of UNC scans. Retrospective first-person account, not a representative sample. Apostrophe modernized only. |
| [NPS, Nicodemus cultural landscape history](https://www.nps.gov/articles/nicodemus_nhs_landscape_equality.htm) | Settlement paragraphs, 1887 institutions, railroad bypass and annual celebration. Article last updated 10 May 2022. | Paraphrase with citation, no embedded photos with third-party credits. Specific local causal statement is attributed to NPS. |

### Rejected and unresolved candidates

- [Ho for Kansas broadside copy, LOC 98501335](https://www.loc.gov/item/98501335/): the original text is 1878 but the copy photograph is cataloged c. 1980–1990. Item says publication may be restricted and original source/rights documentation is insufficient. **Not embedded.** Do not infer clearance from the broadside's age.
- [Du Bois taxable property chart, LOC 2013650442](https://www.loc.gov/item/2013650442/): inspected, no known restrictions, but duplicates the chosen land object without improving this bounded reading. Not used.
- Several NPS school/labor and LOC collection URLs did not return usable bodies. They are not evidence for shipped claims. The older LOC Pictures endpoint supplied the complete Tuskegee item record when the newer endpoint failed.

## Adversarial decisions

| Challenge | Best alternative | Decision |
| --- | --- | --- |
| Attractive artifact creates false representativeness | Present only aggregate tables | Accepted with controls: local dates/places, explicit scope, original source and full-frame image, no synthetic voice. |
| Famous autobiography erases ordinary variation | Delay until a broad oral-history corpus exists | Accepted as one named retrospective account, not the class/race norm. Wider community-reviewed accounts remain necessary. |
| Law next to unemployment implies it caused the rate | Hide policy context | Accepted with controls: primary-source mechanism explained; enforcement and national effect explicitly unclaimed. No unsourced drugs/crime explanation added. |
| An impressive picture is unreadable to screen-reader users | Text-only narrative | Accepted with controls: descriptive alt, verbal reading/transcript, source and captions available independently of image loading. |
| Remote documentary images are blocked or unavailable | Copy every archive image into the repository | Accepted with controls: image-only CSP allowances for two exact hosts, no script/connect permissions, no-referrer on documentary images, lazy loading, caption and source remain. Remote availability and IP disclosure to the host remain tradeoffs. |
| Blanket rejection of all testimony reduces depth | Match any testimony to every milestone | Reject indiscriminate matching. Existing generic testimony domain is excluded from automatic selection until explicit topic matching exists; newly inspected accounts are assigned deliberately. |
| A site-wide redesign risks unrelated surfaces and Memorial | Rewrite every page now | Shared-pattern repair: archive figure, primary-document visibility, catalog metadata and Stories cards. Memorial opening and map remain untouched. Broader migration stays in its existing workstream. |

## Low-cost additive lane

Reuse the existing accounts/media lane and Life World packet workstreams in Beads. Do not create a competing publication system. The curated file is a small web editorial layer; it does not mutate canonical entities, observations, or research-case state.

1. Choose one life question, one place/time, and one missing evidence role (account, mechanism, visual object). Search the existing catalog and source captures first.
2. Inspect at most three promising collection/item candidates before selecting a deep read. Prefer LOC, NARA, NPS, and scholarly edited primary collections. A metadata query is discovery, never final evidence.
3. Open the item record, rights statement, relevant text, and the visual. Record exact page/section, production date versus depicted date, mediation, and what the item cannot establish.
4. Reuse the original remote reproduction only when rights support it. Stop after two failed endpoint attempts; try the institution's documented alternate record or select another item. Never silently broaden fetch policy.
5. Write a short claim-to-source reading and two useful connections. Prefer a verified published record or chapter; a search link must say it is a search.
6. Review the strongest counter-reading, check the real rendered image/alt/caption together, and test at phone and desktop in both themes. Add evidence only after these gates.

No paid research API or additional model agents were used in this pass. Execution stayed on the configured session model; deterministic lookup, source reading, tests, and browser checks did the rest. Dollar cost per finished packet is not measured and must not be invented. The practical budget is bounded candidates and reads, not a promise that historical interpretation is free. Escalate only an unresolved causal interpretation or identity conflict; routine transcription and validation should remain deterministic or on the configured model.

The Alabama pilot, full life-stage/class coverage, additional regional and Hispanic accounts, and deeper employment-policy chapters remain separate research work. This increment must not be described as completing them.
