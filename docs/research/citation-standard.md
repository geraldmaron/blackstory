# Evidence acceptance

Evaluate the document against the exact assertion. A publisher profile establishes provenance and helps choose a collection; host reputation, `.gov`/`.edu`, citation volume and a model score cannot establish historical truth.

## Evidence needs and document fitness

Use the maintained qualitative policy in `packages/domain-core/src/claims/source-fitness.ts`. The kernel profile is generated from that policy; do not add a competing table. Collection guidance describes likely coverage and limitations. It does not certify an item or override an evidence assignment.

- Legal status: inspect applicable enacted text, decisions and administrative records. Separate allegations, findings, amendments and event dates.
- Identity, chronology and place: inspect period records, institutional records, maps/directories and researched biographies. Distinguish namesakes, successive buildings and date meanings.
- Explanation and significance: inspect scholarship's argument, scope, evidence, corrections and alternatives.
- Lived experience: preserve attributed testimony, interview context, consent and access conditions. A suitable interview can support a narrow account of the speaker's experience. Chronology and broad historical claims need separate assessment.
- Firstness, exclusivity and causation: define the comparison or causal question; seek explicit evidence, counterexamples and competing explanations.
- Discovery: use catalogs, finding aids, markers, search results and encyclopedias to locate the underlying work. A catalog describes a work; it does not establish that work's historical assertions.

A single suitable record can support an ordinary narrow fact. Consequential or disputed claims need further investigation and independently derived support where available. Do not enforce an institutional-source quota that excludes community evidence. Hold unresolved central contradictions; retain sparse supported records and attributed testimony.

## Wikipedia and document mirrors

Wikipedia articles and Wikidata statements are discovery leads. New public historical assertions require inspected underlying sources that themselves support the exact words. Chase references and inspect the works; links and repeated claims are insufficient. Existing citations are preserved and remediation is queued by exact assertion, starting with superlatives and consequential claims. A citation host alone does not prove a legacy claim is false.

Wikisource and Commons scans/transcriptions can represent underlying documents. Establish edition, author/creator, provenance, faithful transcription or image comparison, exact locator and work lineage. Evaluate the underlying document. An arbitrary upload or unverified transcription is not evidence merely because it is hosted in an archive.

## Acceptance and publication

Preserve atomic assertions, exact passages and locators, source identity, capture revision, fitness reasons, dependencies, contradictions and missing needs. Trace copied or syndicated works across domains; independently produced works in one archive can remain independent. Unknown lineage is unknown.

Management proposals map each public sentence to supported assertions and acquired evidence. Self-review must be labeled; another model family is not proof of independence. Owner approval binds exact proposed changes and grants only the scoped publication authority.

Article statistics, figures and theme observations cannot opt out by omitting anchors or setting `replicationVerified`. Publication loads current accepted canonical claim versions, evidence selectors/captures, review decisions and assessed lineage from the database. Anchors carry `claimId`, `claimVersionId`, `selectorId` and URL. A `publication_assertion_sha256` claim binds the review to the assertion-bearing content digest produced by `publicationAssertionDigest`; both the semantic passage review and immutable binding are required. Consequential figures require independent work support; a narrow direct quotation may use one suitable reviewed source. Offline shape validation and host discovery tallies do not grant publication authority.

Numerical legacy priors remain historical heuristics. Qualitative policy assessments require no invented priors or probabilities. An exact quote match proves provenance, not entailment or truth. Revised facts or qualifiers reopen affected review; public readback must establish delivery.

Methodological references: [ACRL](https://www.ala.org/acrl/standards/ilframework), [Wikipedia research guidance](https://en.wikipedia.org/wiki/Wikipedia:Researching_with_Wikipedia), [OHA principles](https://oralhistory.org/oha-core-principles/). Provenance concepts follow [W3C PROV](https://www.w3.org/TR/prov-overview/) and locators/selectors follow [Web Annotation](https://www.w3.org/TR/annotation-model/); no RDF infrastructure is required.
