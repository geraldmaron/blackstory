# Held-out evidence retrieval pilot v1

Tracked files:

- `heldout-evidence-retrieval-corpus.v1.json`: blind public-source text and prompts.
- `heldout-evidence-retrieval-gold.v1.json`: provisional curated retrieval and entailment judgments.
- `heldout-entailment-predictions.v1.json`: independently frozen categorical predictions.

Frozen prediction hashes are recorded in two distinct forms:

- File-byte SHA-256: `3c64a1c3ac5587bb8917655a24b21ba510a8bf5942f3aa2dcf94ecb02c4b99bc`.
- Canonical JSON SHA-256: `fff08c8b8c96732bbebbad56b2ccfe5e9af1ada9557a5fe8c3faa18255afc00a`, computed over the UTF-8 bytes of `JSON.stringify(JSON.parse(fileBytes))`. This remains stable when formatting changes whitespace only.

## Reproducing the measurement

The runner uses the existing capture and retrieval implementations in an isolated local database.
It accepts another corpus with the same input schemas, removes its temporary rows, and records
input hashes, query plans and cost receipts. It cannot publish. This is an evaluation utility;
production work uses the durable ledger described in the research operations guide.

After authorizing provider spend and loading credentials privately, run from the repository root:

```sh
node --conditions development --import tsx scripts/gold-corpus/evidence-retrieval-pilot.ts \
  --blind packages/testing/src/gold-corpus/fixtures/heldout-evidence-retrieval-corpus.v1.json \
  --gold packages/testing/src/gold-corpus/fixtures/heldout-evidence-retrieval-gold.v1.json \
  --entailment-predictions packages/testing/src/gold-corpus/fixtures/heldout-entailment-predictions.v1.json \
  --embedding-provider openrouter \
  --embedding-model openai/text-embedding-3-small \
  --max-cost-usd 0.25 \
  --prior-reserved-cost-usd 0 \
  --prior-provider-calls 0 \
  --out /tmp/evidence-retrieval-pilot.json
```

`RESEARCH_TEST_DATABASE_URL` must point to local Postgres and `OPENROUTER_API_KEY` must be set.
Use an unused output path. Replace zero prior spend/calls with the cumulative reservation and call
count for the authorized experiment, including failed calls with unknown charges. The command does
not persist a cross-process budget ledger. Reconfirm the dated provider price before a new paid run;
the fixed model/price configuration is an evaluation constraint, not a production routing policy.
Scores are measurements with `qualityAdmission: not_evaluated`, never assertion approval.

## Provenance and review notes

This is a small pilot corpus, not a human-adjudicated benchmark and not a broad performance claim. The blind file contains six source records, 20 retrieval prompts, and 14 entailment prompts. It intentionally omits relevance labels, forbidden-document labels, expected entailment labels, source URLs for entailment prompts, and rationales. Those curated expectations are recorded below so an evaluator can freeze predictions before opening this file. The frozen blind protocol refers to the original working title `heldout-source-notes.md`; its maintained counterpart is this file and the adjacent gold JSON. Frozen input bytes are retained to preserve pilot hashes.

All six pages were read on 2026-09-18. Retrieval time recorded in the blind file is 2026-09-18T15:21:59Z. Four pages are official National Park Service biographical pages. Two portability pages are official U.S. EPA wetlands pages. The text fields are selected passages transcribed from the rendered pages; [P#] markers are local passage labels, not source-native anchors. The original URL is preserved for each document.

## Source ledger

| id | title | primary URL | focus |
| --- | --- | --- | --- |
| nps-mary-fields | Mary Fields (U.S. National Park Service) | https://www.nps.gov/people/mary-fields.htm | alias, route, uncertainty, internal burial conflict |
| nps-will-garvin | Will Garvin (U.S. National Park Service) | https://www.nps.gov/people/will-garvin.htm | namesake ambiguity, service, marriage, cave work |
| nps-nick-bransford | Nick Bransford (U.S. National Park Service) | https://www.nps.gov/people/nick-bransford.htm | Nicholas alias, same-surname nonrelation, family edges |
| nps-mat-bransford | Mat Bransford (U.S. National Park Service) | https://www.nps.gov/people/mat-bransford.htm | Materson alias, cave-guide edges, marriage |
| epa-wetland-definition | What is a Wetland? | https://www.epa.gov/wetlands/what-wetland | definition, seasonal wetlands, geographic portability |
| epa-wetland-functions | How do Wetlands Function and Why are they Valuable? | https://www.epa.gov/wetlands/how-do-wetlands-function-and-why-are-they-valuable | watershed relationships, habitat, carbon storage |

## Gold retrieval expectations

relevantIds are document IDs, not entity IDs. forbiddenDocumentIds names an adjudicated confusable document that must not appear in the top-k result for the query. This is a retrieval false positive label, not evidence that an identity resolver performed a merge. A path query may require returning endpoint documents while still refusing to invent a direct edge.

    {"id":"r01","relevantIds":["nps-mary-fields"],"forbiddenDocumentIds":[],"rationale":"Exact page heading and body match Mary Fields."}
    {"id":"r02","relevantIds":["nps-will-garvin"],"forbiddenDocumentIds":[],"rationale":"Exact page heading and body match Will Garvin."}
    {"id":"r03","relevantIds":["nps-nick-bransford"],"forbiddenDocumentIds":["nps-mat-bransford"],"rationale":"Exact Nick page; same surname is explicitly not blood relation to Mat."}
    {"id":"r04","relevantIds":["nps-mat-bransford"],"forbiddenDocumentIds":["nps-nick-bransford"],"rationale":"Exact Mat page; same surname must not collapse Nick and Mat."}
    {"id":"r05","relevantIds":["nps-nick-bransford"],"forbiddenDocumentIds":["nps-mat-bransford"],"rationale":"Nicholas is the page's full-name variant for Nick."}
    {"id":"r06","relevantIds":["nps-mat-bransford"],"forbiddenDocumentIds":["nps-nick-bransford"],"rationale":"Materson (Mat) is the page's full-name variant for Mat."}
    {"id":"r07","relevantIds":["nps-will-garvin"],"forbiddenDocumentIds":[],"rationale":"The page itself writes William “Will” Garvin."}
    {"id":"r08","relevantIds":["nps-mary-fields"],"forbiddenDocumentIds":[],"rationale":"Stagecoach Mary appears in the page bibliography title; this is a weaker alias signal than the heading."}
    {"id":"r09","relevantIds":["nps-mat-bransford"],"forbiddenDocumentIds":["nps-nick-bransford"],"rationale":"Synthetic OCR perturbation of Materson Bransford. This is a query perturbation, not a claimed source OCR defect."}
    {"id":"r10","relevantIds":["nps-nick-bransford"],"forbiddenDocumentIds":["nps-mat-bransford"],"rationale":"Synthetic OCR perturbation of Nick Bransford. This is a query perturbation, not a claimed source OCR defect."}
    {"id":"r11","relevantIds":["nps-will-garvin","nps-nick-bransford"],"forbiddenDocumentIds":["nps-mat-bransford"],"rationale":"Will married Hannah; the pages identify Hannah as Nick's daughter. Return both endpoint records and preserve the two edges."}
    {"id":"r12","relevantIds":["nps-mary-fields"],"forbiddenDocumentIds":[],"rationale":"The route, Star Route contract, Montana setting, and identity are all in Mary P5-P6."}
    {"id":"r13","relevantIds":["nps-nick-bransford"],"forbiddenDocumentIds":["nps-mat-bransford"],"rationale":"Nick is father of Hannah and Annie and married Charlotte; Mat is a same-surname, explicitly unrelated cave guide."}
    {"id":"r14","relevantIds":["nps-mat-bransford"],"forbiddenDocumentIds":[],"rationale":"Mat P4 directly states that Mat married Parthena."}
    {"id":"r15","relevantIds":["nps-will-garvin","nps-nick-bransford"],"forbiddenDocumentIds":[],"rationale":"Will P4 gives the date and marriage; Nick P5 independently names Hannah's marriage to Will."}
    {"id":"r16","relevantIds":["nps-mary-fields"],"forbiddenDocumentIds":[],"rationale":"Mary P5 states that Mary moved to Montana in 1885 and identifies St. Peter's Mission."}
    {"id":"r17","relevantIds":["nps-will-garvin","nps-nick-bransford"],"forbiddenDocumentIds":["nps-mat-bransford"],"rationale":"The endpoints are relevant, but the sources state Will married Nick's daughter Hannah. They do not state a direct Will-to-Nick edge with a named predicate; do not infer a son-in-law relation from the two-hop path."}
    {"id":"r18","relevantIds":["epa-wetland-definition"],"forbiddenDocumentIds":[],"rationale":"EPA definition page directly describes seasonal or periodically wet wetlands that remain critical habitat."}
    {"id":"r19","relevantIds":["epa-wetland-functions"],"forbiddenDocumentIds":["epa-wetland-definition"],"rationale":"EPA functions page directly connects wetland value to relationships with other watershed ecosystems."}
    {"id":"r20","relevantIds":["epa-wetland-definition"],"forbiddenDocumentIds":["epa-wetland-functions"],"rationale":"The exact swamps, marshes, bogs, and similar areas wording is on the EPA definition page."}

## Gold entailment expectations

The expected labels are claim-relative. insufficient means the quoted evidence is too hedged, internally conflicting, or requires a relation that the source does not explicitly state. contradicted is reserved for evidence that conflicts with the claim. The path case intentionally does not license an inferred direct A-to-C edge.

    {"id":"e01","expected":"supported","sourceUrls":["https://www.nps.gov/people/mary-fields.htm"],"rationale":"Mary P1 and P6 explicitly call her the first African American woman to receive a Star Route contract."}
    {"id":"e02","expected":"supported","sourceUrls":["https://www.nps.gov/people/mary-fields.htm"],"rationale":"Mary P6 explicitly states that her route ran between St. Peter's Mission and Cascade."}
    {"id":"e03","expected":"insufficient","sourceUrls":["https://www.nps.gov/people/mary-fields.htm"],"rationale":"P5 attributes the care-for-Amadeus account to some secondary sources and then gives a different likely explanation; it does not establish sole cause as fact."}
    {"id":"e04","expected":"supported","sourceUrls":["https://www.nps.gov/people/will-garvin.htm"],"rationale":"Will P3 explicitly names Company M, 12th Heavy Artillery, U.S. Colored Troops."}
    {"id":"e05","expected":"contradicted","sourceUrls":["https://www.nps.gov/people/will-garvin.htm"],"rationale":"Will P2 says relationships with the many African American and European American Garvin records remain unknown."}
    {"id":"e06","expected":"supported","sourceUrls":["https://www.nps.gov/people/nick-bransford.htm"],"rationale":"Nick P2 explicitly says Nick and Mat share a last name but have no blood relation."}
    {"id":"e07","expected":"supported","sourceUrls":["https://www.nps.gov/people/nick-bransford.htm"],"rationale":"Nick P5 explicitly identifies Hannah and Annie as his two daughters."}
    {"id":"e08","expected":"contradicted","sourceUrls":["https://www.nps.gov/people/nick-bransford.htm"],"rationale":"Nick P2 explicitly denies a blood relation, which conflicts with a brothers claim."}
    {"id":"e09","expected":"supported","sourceUrls":["https://www.nps.gov/people/mat-bransford.htm"],"rationale":"Mat P4 explicitly states the marriage to Parthena and that three of their four children were sold away."}
    {"id":"e10","expected":"insufficient","sourceUrls":["https://www.nps.gov/people/nick-bransford.htm","https://www.nps.gov/people/will-garvin.htm"],"rationale":"The evidence supplies Nick-to-Hannah and Hannah-to-Will edges. It never states the direct predicate son-in-law; inferring A-to-C from A-to-B-to-C is disallowed."}
    {"id":"e11","expected":"supported","sourceUrls":["https://www.epa.gov/wetlands/what-wetland"],"rationale":"EPA P4 explicitly says seasonal or periodically wet areas can remain critical wildlife habitat."}
    {"id":"e12","expected":"contradicted","sourceUrls":["https://www.epa.gov/wetlands/what-wetland"],"rationale":"EPA P3 says wetlands occur on every continent except Antarctica."}
    {"id":"e13","expected":"supported","sourceUrls":["https://www.epa.gov/wetlands/how-do-wetlands-function-and-why-are-they-valuable"],"rationale":"EPA functions P3 explicitly states that wetlands store carbon in plant communities and soil and help moderate global climate conditions."}
    {"id":"e14","expected":"insufficient","sourceUrls":["https://www.nps.gov/people/mary-fields.htm"],"rationale":"Mary's quick facts list St. Peter's Mission, while the later prose says she is buried in Cascade. The page is internally inconsistent; the claim cannot be called consistently established."}

## Uncertainty and boundaries

- Stagecoach Mary is preserved because it appears in the NPS page's bibliography title. The page heading itself is Mary Fields, so this alias should be treated as lower-strength than Nicholas (Nick) or Materson (Mat).
- The NPS Mary Fields page has an internal burial conflict: quick facts say St. Peter's Mission, while the closing prose says Cascade. This was retained as source uncertainty and not reconciled.
- The Mary Fields relocation account is explicitly hedged: one explanation is attributed to “some secondary sources,” and another is described as “likely.” The corpus does not turn either into a certain causal claim.
- The NPS Will Garvin page explicitly leaves relationships among other Garvin records unknown. Same surname, shared geography, and shared occupation are not identity proof.
- The Nick/Will family material is deliberately a two-hop chain. The source supports Nick to Hannah and Hannah to Will, but no direct son-in-law edge is staged.
- r09 and r10 are synthetic query OCR perturbations. They are not observations that either source page has OCR defects.
- The EPA pages are a small second-domain portability slice, not evidence that the full research profile generalizes to environmental history.
- No measured model output, human adjudication, calibrated probability, or broad recall/precision claim is included in this artifact.
