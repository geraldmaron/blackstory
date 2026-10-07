---
name: blackstory-claim-corroborate
description: Test whether evidence supports an exact historical claim, including entity summaries and context. Use for source sufficiency, disputed dates, firstness, independent lineage, or confidence review. Finding a page about the subject is only discovery.
---

# Claim corroborate

Use the [research method](../../../../docs/research/README.md),
[citation contract](../../../../docs/research/citation-standard.md), and
[prose fact protocol](../../../../docs/methodology/chapter-fact-validation.md).
Old archival documents are not stale merely because they are old. Check later
corrections and document versions when they could change the answer.

## Decision order

1. Write the exact assertion: subject, action or status, object, date kind,
   place, population and qualifiers. Split compound sentences. Include the
   summary, historical context, inclusion basis, captions and share text, not
   only the structured claims.
2. Open the underlying work and read the passage in context. Record its author,
   purpose, date, locator, access outcome and allowed excerpt. Distinguish what
   the source says from what actually happened; a source can be wrong.
3. Assess fitness for this assertion. A patent can establish a grant and date;
   it cannot establish the inventor's race or priority across all inventors.
   Official records, scholarship, community archives, Black press and oral
   histories have different strengths and omissions. No host settles truth.
4. Trace independent works. Follow citations, reprints and shared archival roots;
   copied biographies on different domains remain dependent. Unknown lineage
   stays unknown. Use `lineageRootId` for the underlying work, not its hostname.
5. Try to defeat the assertion. Search earlier candidates, corrections, alternative
   date meanings, namesakes and the strongest contrary account. Resolve a conflict
   by evidence and scope, never majority vote or averaging. Record the search
   bounds and any unresolved contradiction.
6. Decide: supported at stated scope / supported only with qualification or
   attribution / contradicted / insufficient evidence. Explain what would change
   the decision. Missing evidence alone is not a falsehood.
7. Check the final wording again after editing. Any new fact or expanded qualifier
   reopens review. Stage the assessment; this skill does not publish.

## Firstness, dates and counts

For “first,” “only,” “oldest” or “largest,” define the comparison population,
geography, credential, measurement and time window. Find an explicit, fit source
for that exact scope and search for counterexamples. An institution's agreement
alone is insufficient. If a broader claim fails, retain only the verified narrower
one; attribution must not launder a known error.

Distinguish election, swearing-in, arrival, visiting appointment, tenure, degree
completion and conferral. Distinguish people trained, graduated, commissioned or
appointed. Check totals against components without counting overlapping roles twice.

## Retrieval is not verification

`packages/ops-data/scripts/lib/corroborate-source.ts` retrieves candidate pages
using citation trails, a Wikipedia bridge and ranked host searches. Its subject-name
match does not test claim entailment. Read the returned passage before treating it
as support. Host filters in `tier1-sources.ts` are discovery heuristics; work-level
lineage and `assessSourceFitness` are separate assessments. Reuse these capabilities,
not a second host list. Use the project's safe-fetch path for acquisition.

Wikipedia may carry a low-confidence claim under the existing contract, but supplies
zero corroborating lineages and cannot alone support a summary superlative. Another
source must itself support the exact words. A low label never licenses a known false
claim. Numerical model scores are not calibrated probabilities or publication authority.

## Output

For each consequential assertion: exact proposed text; evidence and locator;
fitness and lineage rationale; strongest contrary evidence; verdict and reason;
allowed wording; unresolved needs. Persist with the case/draft. Reuse the
[evaluation families](../../../../docs/research/gold-corpus.md); do not describe a
synthetic policy-label test as a historical accuracy test.
