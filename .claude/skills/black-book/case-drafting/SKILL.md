---
name: black-book-case-drafting
description: Use when the owner wants to know whether a research case is review-ready, or wants help assembling its claims/evidence/confidence toward the minimum publishable record. Triggers on "is this case ready", "what's missing on this case", "help me draft this case for review".
---

# Case drafting (BB-085)

Evaluates a research case's evidence checklist against BB-044's real, deterministic
publication-readiness rules, and proposes whatever's missing through the same quarantine lane
every other proposal uses.

## Invoke

**Evaluation is read-only and pure** — call the real BB-044 functions directly from
`@black-book/domain` against the case record you're looking at (fetched via the admin console
or a direct Firestore read of `researchCases/{caseId}` — this package doesn't wrap that read):

```ts
import { evaluateEvidenceChecklist, buildResearchCasePreview } from '@black-book/domain';

const evaluation = evaluateEvidenceChecklist(caseRecord.checklist);
// evaluation.meetsMinimumRecord, evaluation.missingMinimum, evaluation.level
```

`evaluateEvidenceChecklist` and `buildResearchCasePreview`
(`packages/domain/src/research-case/workflow.ts`) are the exact functions BB-044's own
transitions and the promotion pipeline use to decide `minimum_record` / `partial_enrichment` /
`substantial_enrichment` — do not hand-roll a "is this ready" check by inspecting fields
yourself.

**Filling a gap** the evaluation surfaced (e.g. missing `source_citation` or `corroboration`):

```bash
OPERATOR_CLI_PRIVACY_PEPPER=<pepper> node --conditions development --import tsx \
  packages/operator-cli/src/bin.ts attach-evidence \
  --case-id "<research case id>" \
  --description "Fills the missing 'source_citation' checklist item: ..." \
  --source-url "https://..." \
  --operator-id "<your operator id>" --session-id "<this session's id>"
```

This is the same `prepareEvidenceAttachmentIntake` call `research-intake` and
`triage-graylist` use — evidence lands in quarantine tagged with the case id; a reviewer with
`research:write` applies it to the checklist through BB-044's own `record_evidence` gate.

## Do

- Quote `evaluation.missingMinimum` / `evaluation.completedEnrichment` back to the owner
  verbatim (the ten checklist keys are `EVIDENCE_CHECKLIST_KEYS`,
  `packages/domain/src/research-case/model.ts`) rather than paraphrasing what's missing.
- When proposing evidence to fill a gap, name which checklist key it's meant to satisfy in the
  `--description`, so the reviewer applying it later doesn't have to guess.
- Check `buildResearchCasePreview(...).publishable` before telling the owner a case is "ready"
  — `meetsMinimumRecord` alone isn't sufficient; state also has to be
  `minimum_record`/`partial_enrichment`/`substantial_enrichment`.

## Never

- Never call `transitionResearchCase`, `markResearchCasePublished`, or any other BB-044 state
  mutator yourself — those require a `research:write`-authorized `VerifiedAdminToken`
  (`assertResearchCaseActionAuthorized`, `packages/firebase/src/firestore/research-case.ts`)
  this proposer lane does not hold. Draft and propose; a reviewer transitions the case.
- Never assemble a claim's evidence list and call `evaluatePromotionGate` yourself expecting to
  approve it — `approverId` must differ from `proposerId` or the gate refuses with
  `proposer_approver_conflict` (`packages/domain/src/promotion/controls.ts`), and this
  package's own identity is always a proposer, never an approver
  (`promotion-boundary.test.ts` in `packages/operator-cli` proves this).
- Never mark a case "review-ready" based on your own read of the evidence — only
  `evaluateEvidenceChecklist`/`buildResearchCasePreview`'s output counts.
