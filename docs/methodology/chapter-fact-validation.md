# Prose fact validation

Applies to public entity summaries, historical context, inclusion explanations, stories,
chapters, captions and excerpts. The filename is retained for existing references.
Article-specific machine gates apply only to their article formats. This protocol
supplies the editorial judgment that citation attachment and schema checks cannot prove.

## 1. Record the exact assertion

Build a compact evidence map alongside the existing case or draft, not a second database.
For each factual clause record:

- The exact proposed words and destination field; stable claim/reference ID where available.
- Subject, predicate, object, date kind, place, population and decisive qualifiers.
- Source work, author/custodian, source date, retrieval outcome, exact locator and a
  supporting excerpt only within the source's applicable quotation/retention limits.
- Why the document is fit for this question; independent work lineage and dependencies.
- Strongest contrary evidence, search bounds, resolution or unresolved need.
- Verdict (supported, qualified/attributed, contradicted, insufficient), allowed wording,
  reviewer and the exact draft revision reviewed.

Use fetched evidence, not model memory or snippets as substitutes for a document.
Do not infer a fact's truth merely because a matching quote exists. Check its context,
source fallibility, later corrections, and competing evidence. Inaccessible sources are
unverified; retain the access limitation rather than filling the gap.

## 2. Source criticism and corroboration

Prefer the records closest and best suited to the question, read with relevant scholarship
and context. A primary record can misstate, omit or misclassify; secondary scholarship can
provide the necessary synthesis. Community archives, Black press and oral testimony may
be the best available evidence. Evaluate purpose, knowledge, perspective and limitations.

For consequential or contested assertions, seek independently derived support and actively
look for disconfirmation. Trace works, not domains: syndication and biographies copying
the same error are one evidentiary root. Two citations are neither necessary nor sufficient
for every ordinary fact. A well-suited single record can support a narrowly stated fact;
name the source in prose when its testimony, estimate or unusual exclusivity matters.
A single witness's account must remain attributed. Do not use attribution to retain a
known falsehood or a confidence grade to license a contradiction.

A firstness claim needs the comparison class, credential/role, geography and period made
explicit, an explicit fit source, and a search for earlier or competing candidates.
Differentiate event, election, appointment, swearing-in, visiting/full appointment,
designation, completion and conferral dates. Verify counts and overlapping roles.
“Not found” becomes evidence of absence only when collection coverage and the expectation
of a record make that inference defensible. Document those conditions.

## 3. Refutation and integration

A verifier checks the exact draft against the evidence and the strongest alternative.
Prefer a researcher who did not draft it for consequential claims. If only self-review
ran, say so and carry unresolved high-risk claims to separate review; a fresh prompt
alone is not an independent check. Delegation is not automatic authorization for a fan-out.

Do not merely check that each reference exists. Read every factual clause, including
numbers and context not present in structured claims. Check each title, summary, caption,
card and mobile excerpt independently. Preserve essential qualifiers where users see the
claim. Method notes may expand limitations but cannot hide a qualification that changes truth.

A source conflict is resolved by evidence and scope, not a vote. State a supported conclusion
when the record permits one; otherwise attribute the disagreement at its actual size.
Missing support is **insufficient**, not **false**. A confirmed counterexample may refute a
universal claim without settling every alternative formulation.

After integration, compare the final draft to the reviewed version. Any factual alteration
invalidates the affected assessment until rechecked. Keep the evidence map and findings
outside public prose; don't publish editing instructions or session history.

## 4. What the machine checks do and do not prove

`assessPublicationClaims` in `packages/ops-data/scripts/lib/confidence.ts` matches structured
claims to exact reviewed assessments. Its input has `id` and `claims`, not summary or
historical context. It does **not** certify all public prose. Record prose review separately
with the exact revision; runtime enforcement of that binding remains a distinct engineering
control, not a capability this document pretends to add.

Article validation checks schema, references, source tiers, packet binding and other
format-specific gates in `packages/ops-data/scripts/articles.ts`. Numerical reference
integrity is not proof that a sentence uses a number correctly or that the underlying
measurement is true. Narrative entailment still needs review.

Chapter-kind content currently has a 2,000-word floor. Do not manufacture scenes, detail
or conclusions to meet it. Use an appropriate shorter format or review the format constraint.
Run current gates without bypasses, then prepare the preview for the separate publication role.

## 5. Correction after publication

Retain the false wording, field, entity/release ID, counterevidence and proposed correction
in the review record. Find derivatives: summary/context, claims, inclusion basis, era/place
provenance, search cards, article references and cached release artifacts. Correct through
the authorized review/publication path; do not silently rewrite only the visible sentence.
Use `blackstory-surface-triage` to verify database, artifact and actual rendered output after
publication. Until then report “correction proposed,” not “fixed.”

## Method foundations

Sources inspected 2026-10-07; these support the method, not a claim that BlackStory has
been externally certified:

- [American Historical Association, Standards of Professional Conduct](https://www.historians.org/resource/statement-on-standards-of-professional-conduct/): critical scrutiny of primary and secondary evidence, transparent citation and honest limits.
- [Digital Inquiry Group, lateral-reading research](https://misinforeview.hks.harvard.edu/article/lateral-reading-college-students-learn-to-critically-evaluate-internet-sources-in-an-online-course/): investigate the source and trace information outside the page being evaluated. Its findings do not calibrate this model's accuracy.
- [Oral History Association, Principles and Best Practices](https://oralhistory.org/principles-and-best-practices-revised-2018/): attend to narrators, communities, power and the conditions in which testimony is produced and used.

Related: [research framework](../research/README.md), [citation standard](../research/citation-standard.md),
[voice](../content/neo-voice.md), [juxtaposition and causation](./juxtaposition-not-causation.md),
[scholarship principles](./scholarship-principles.md), and
[evaluation limits](../research/gold-corpus.md).
