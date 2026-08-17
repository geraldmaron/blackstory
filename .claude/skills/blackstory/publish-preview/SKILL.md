---
name: blackstory-publish-preview
description: Prepares a publication preview and names what still blocks release. Use when asking if a record is ready to publish, running geo QA before release, checking promotion eligibility, or reviewing rights and dignity before a human activation.
---

# Publish preview

Judgment playbook. Agents prepare a preview. They never promote, approve, or activate a
release.

Proposer is never approver. `evaluatePromotionGate` refuses when approver id equals proposer
id. There is no `--publish` / `--approve` / `--promote` anywhere on operator-cli
(`packages/operator-cli/src/promotion-boundary.test.ts`). Publication is a distinct
publication-role action with a fresh (≤10 minute) reauth token. A long-running operator
session never holds that token.

## Preview checklist

Walk each item. Cite the code or doc that failed. Do not skip a red item with prose.

```
Task:
- [ ] Identity matched (not a guessed homonym)
- [ ] Pin sourced, precision honest, geo-integrity pass
- [ ] Era is historical evidence, not a designation year
- [ ] Claims have independent lineage at the stated confidence
- [ ] Superlatives have an institutional source
- [ ] Rights clearance on copy and image
- [ ] Dignity: no residential living addresses, no alarm-map encoding
- [ ] Release preview / claim diff inspected
- [ ] A *different* publication-role human still has to activate
```

## Geo

Fail-closed: `(lat, lng)` must sit in the declared state polygon.
`evaluateGeoIntegrityPublishGate` / `assertGeoIntegrityPublishGate`
(`docs/research/geo-integrity-gate.md`). The audit API returns mismatches only. Do not
auto-correct production coordinates.

Catalog fixtures: `packages/firebase/scripts/qa-catalog-fixtures.ts` (state-bbox,
precision decimals). Live geocoders are enrichment-only. Publish reads overrides and
`EntityLocation`, never a live geocoder.

Identity + place + era judgment: [`blackstory-entity-verify`](../entity-verify/SKILL.md).

## Case and claims

Minimum record vs substantial enrichment:
[`docs/research/research-case-workflow.md`](../../../../docs/research/research-case-workflow.md).
Sparse records may be eligible when the five minimum checklist items are complete.
Preview still reports missing geography and era as enrichment gaps, because the public
anatomy shows them.

Citation weight: [`blackstory-claim-corroborate`](../claim-corroborate/SKILL.md).
Case assembly: [`blackstory-case-drafting`](../case-drafting/SKILL.md).
Blank public fields: [`blackstory-entity-complete`](../entity-complete/SKILL.md).

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
- the explicit sentence: this session cannot activate the release

**Never:** call `transitionResearchCase` / `markResearchCasePublished` /
`evaluatePromotionGate` expecting to approve it yourself; treat dry-run JSON as live;
silently rewrite a pin so the geo gate passes.
