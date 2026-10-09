---
name: blackstory-publish-preview
description: Prepares a publication preview and names what still blocks release. Use when asking if a record is ready to publish, running geo QA before release, checking promotion eligibility, or reviewing rights and dignity before a human activation.
---

# Publish preview

Repository workflows require the BlackStory checkout; configured remote management clients do not. See [loading and capabilities](../../../docs/research/README.md#skills-and-harness-portability)
for tool requirements and use from any harness.

Judgment playbook. For a new release, prepare the preview and preserve the
publication-role permission and evidence checks. A canonical-case proposer with the
publication role may also promote the reviewed record; record the authenticated actor
and reason. The separate research-artifact release SQL path still requires its
reviewer and publisher each to differ from the producer; they may be the same person
as each other. Do not apply the canonical-case rule to it.

There is no `--publish` / `--approve` / `--promote` anywhere on operator-cli
(`packages/operator-cli/src/promotion-boundary.test.ts`). The web release route only
stages a decision (`executionAllowed: false`); it does not activate a release.
Fresh reauthentication within 10 minutes is a required operating control for activation,
but the current admin route authorizer does not enforce it. Do not describe it as an
implemented gate or activate through an unreviewed direct database call.

## Approved management proposals

The shared management flow has an authenticated session publisher: `pnpm work:publish <work-id>`
through the existing secret launcher. It consumes the saved exact approval and verifies the live
result. It is separate from the research-only operator CLI and requires owner authentication,
publication database, Storage and signing credentials. It needs no Brave, hosted model or GitHub
Actions setup. Reuse the owner's approval of the exact proposal; do not ask for another publication
approval. A missing publication executor is a delivery limitation, not permission to use direct SQL.

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
- [ ] An authenticated publication-role actor activates after final review
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
- whether an authorized publication-role actor activated the release

**Never:** call `transitionResearchCase` / `markResearchCasePublished` without the
authenticated workflow; treat dry-run JSON as live;
silently rewrite a pin so the geo gate passes.

## End-to-end owner requests

For requests spanning research through publication, follow the
[shared management workflow](../../../docs/research/research-operations.md#account-owned-management-work).
Infer scope, carry existing authorization forward, and present one concise review. Use the
remote service only when deployed and verified; its current limits are part of that contract.

## Working contract

**Input:** The saved exact proposal, applicable evidence decisions and existing authorization.

**Output:** A reviewable preview or blockers, followed by verified public receipts only when authorized execution actually succeeds.

**Boundary and handoff:** Owner approval, independent factual review and publication credentials are separate. Reuse existing authorization for its exact scope; do not invent a second approval ceremony.

**Capabilities:** Follow [capability and permission limits](../../../docs/research/README.md#capabilities-and-permissions).
Use the active harness’s available tools and report unsupported steps. Operational flags stay
in the linked operations contract; no proprietary client or model family is required.
