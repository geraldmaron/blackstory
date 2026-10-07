---
name: blackstory-publish-preview
description: Prepares a publication preview and names what still blocks release. Use when asking if a record is ready to publish, running geo QA before release, checking promotion eligibility, or reviewing rights and dignity before a human activation.
---

# Publish preview

Requires the BlackStory checkout. See [loading and capabilities](../../../docs/research/README.md#skills-and-harness-portability)
for tool requirements and use from any harness.

Judgment playbook. For a new release, prepare the preview and preserve the separate
publication-role approval boundary. Never manufacture approval or activate on the strength
of the proposing session alone.

Proposer is never approver. `evaluatePromotionGate` refuses when approver id equals proposer
id. There is no `--publish` / `--approve` / `--promote` anywhere on operator-cli
(`packages/operator-cli/src/promotion-boundary.test.ts`). Publication is a distinct
publication-role action with a fresh (≤10 minute) reauth token. A long-running operator
session never holds that token.

## Preview checklist

Walk each applicable item. Cite the code or doc that failed. Unknown place/era is an
enrichment gap if honestly absent; an invented or misleading displayed value is a
blocker. Do not skip a red item with prose. Evidence and final-copy review are
procedural obligations as well as the machine checks; do not claim code enforces both.

```
Task:
- [ ] Identity matched (not a guessed homonym)
- [ ] Any displayed pin is sourced, honestly labeled and passes geo-integrity
- [ ] Any displayed era uses historical evidence, not a substituted designation year
- [ ] Claims have exact reviewed support, with lineage and uncertainty stated honestly
- [ ] Superlatives retain their tested scope and survive counterexample search
- [ ] Every summary/context/caption clause has a final-revision evidence review
- [ ] No open factual or materially misleading prose finding; derivative cards agree
- [ ] Rights clearance on copy and image
- [ ] Dignity: no residential living addresses, no alarm-map encoding
- [ ] Release preview / claim diff inspected
- [ ] A *different* publication-role human still has to activate
```

## Explicitly authorized corrections to an existing release

A human may authorize a bounded correction to already published records without creating a
new release. Reuse that authorization; do not request it again. Use the repository's existing
correction and artifact-publication path. This does not authorize impersonating a reviewer,
creating a reauthentication token, bypassing an enforced gate, or recertifying untouched fields.

Bind authorization to exact proposed content and compare current rows with the reviewed
baseline inside a guarded transaction. Append claim versions and correction dispositions;
retain prior versions, source quotations and superseded drafts as identifiable history. Remove
superseded drafts from active replay inputs. Keep canonical, release, search and applicable
landscape copies consistent, including the reader-visible revision timestamp.

Preserve qualitative passage review as qualitative review. If a persistence contract requires
calibrated probabilities or an established lineage cluster that the review did not produce,
do not invent those values. Record the locator, review method, limits and missing assignment.
A metadata-only capture is not retained source text or an accepted evidence assessment. Report
this limitation separately from a scoped correction; it prevents full-record certification.

Before rebuilding derivatives, compare the existing published graph with the proposed graph.
An audit against already-filtered input can pass after dropping all relationships upstream.
Block unexplained loss; never remove unrelated edges or invent evidence to satisfy the build.
If the correction leaves the actual graph inputs unchanged, record that verified equality and
preserve the existing graph while tracking the separate defect.

After publication, verify public artifact content against the approved revision, then each
affected live page, including redirects and cache layers. A successful write, matching release
ID or one fresh page does not establish that all readers have received the correction. Name
any stale page, failed purge or unapplied code deployment in the result.

## Geo

Fail-closed: `(lat, lng)` must sit in the declared state polygon.
`evaluateGeoIntegrityPublishGate` / `assertGeoIntegrityPublishGate`
(`docs/research/geo-integrity-gate.md`). The audit API returns mismatches only. Do not
auto-correct production coordinates.

Catalog fixtures: `evaluateGeoIntegrityPublishGate` with sourced jurisdiction polygons and
precision checks. Live geocoders are enrichment-only. Publish reads overrides and
`EntityLocation`, never a live geocoder.

Identity + place + era judgment: [`blackstory-entity-verify`](../blackstory-entity-verify/SKILL.md).

## Case and claims

Minimum record vs substantial enrichment:
[`docs/research/research-case-workflow.md`](../../../docs/research/research-case-workflow.md).
Sparse records may be eligible when the five minimum checklist items are complete.
Preview still reports missing geography and era as enrichment gaps, because the public
anatomy shows them.

Citation weight: [`blackstory-claim-corroborate`](../blackstory-claim-corroborate/SKILL.md).
Case assembly: [`blackstory-case-drafting`](../blackstory-case-drafting/SKILL.md).
Blank public fields: [`blackstory-entity-complete`](../blackstory-entity-complete/SKILL.md).

## Dignity and language

- No crime-heat or alarm hues for violence-adjacent records
- Confidence is not color-alone
- Points no sharper than stored precision
- Living residential withheld; unknown living = living
- Juxtaposition by default for context indicators; no automatic causation
  (`docs/methodology/juxtaposition-not-causation.md`)

## Output

A preview packet:

- eligible / blocked
- blocking failures with file-or-gate names
- non-blocking enrichment gaps
- reviewed draft revision and evidence map; distinguish machine checks from editorial review
- the explicit sentence: this session cannot activate the release

**Never:** call `transitionResearchCase` / `markResearchCasePublished` /
`evaluatePromotionGate` expecting to approve it yourself; treat dry-run JSON as live;
silently rewrite a pin so the geo gate passes.
