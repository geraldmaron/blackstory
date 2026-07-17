---
name: black-book-triage-graylist
description: Use when the owner wants to walk parked, weak-signal candidates (quarantined submissions or low-confidence discovery candidates) and decide what to do with each — strengthen with corroboration, or recommend rejection. Triggers on "triage the graylist", "what's stuck in quarantine", "review flagged submissions".
---

# Triage graylist (BB-085)

Walks weak-signal, parked candidates and prepares — never executes — accept/reject
recommendations, plus proposes corroborating evidence where you find it.

## Invoke

**Reading the graylist is a genuine, documented gap in this proposer lane.**
`packages/operator-cli` (BB-085) only implements the *write/propose* side of the pipeline —
there is no CLI command that lists or queries `submissionInbox` or quarantined discovery
candidates yet. To see what's parked, use one of these existing read paths:

- The admin console's fixture-backed `/console/submissions` and `/console/candidate-queue`
  surfaces (`apps/admin/src/console/fixtures.ts` — currently fixture data only, not a live
  query; see `apps/admin/src/app/console/`).
- A direct Firestore read (`firebase firestore:get`, or the Firebase console) against
  `submissionInbox` where `moderationState` is `flagged`, `pending_review`,
  `duplicate`, or `coordinated_campaign` (`SubmissionModerationState`,
  `packages/security/src/submissions/quarantine.ts`), or `discoveryCandidates` where
  `status === 'quarantined'` (`DiscoveryCandidateStatus`, `packages/domain/src/discovery/types.ts`).

Once you have a candidate in front of you, use these real, tested functions for the two things
this lane *can* do:

**Propose corroborating evidence** (strengthens a weak-signal item tied to a research case):

```bash
OPERATOR_CLI_PRIVACY_PEPPER=<pepper> node --conditions development --import tsx \
  packages/operator-cli/src/bin.ts attach-evidence \
  --case-id "<research case id>" \
  --description "What this new source corroborates and why" \
  --source-url "https://..." \
  --operator-id "<your operator id>" --session-id "<this session's id>"
```

This calls `prepareEvidenceAttachmentIntake` (`packages/operator-cli/src/intake.ts`), which
queues the evidence into the real BB-029 quarantine tagged with the case id — it does not
touch the case's checklist directly (that stays behind BB-044's `record_evidence` gate).

**Prepare a recommendation** (accept, reject, or needs-more-evidence): write it as a lead or
evidence attachment whose `--description` states your recommendation and reasoning plainly,
e.g. `--description "Recommend accept: two independent 1962 newspaper sources corroborate the
plaque date; no contradicting evidence found."` A human reviewer with `research:write`
executes the actual moderation-state change or case transition — this lane only records your
reasoning where a reviewer will see it.

## Do

- Read the full existing submission/candidate before recommending anything — cite what you
  actually found, not a guess.
- Prefer `attach-evidence` over a fresh `submit-lead` when the item already has a research
  case id; it keeps the corroboration attached to the right case.
- State your recommendation (accept/reject/needs-more-evidence) explicitly in plain language in
  the description so a reviewer doesn't have to reconstruct your reasoning.

## Never

- Never write directly to `submissionInbox` or `discoveryCandidates` to change a
  `moderationState`/`status` field — there is no sanctioned write path for that in this
  package, and doing it by hand bypasses BB-029/039's real quarantine logic entirely.
- Never call this "resolving" or "closing" a graylist item — nothing here transitions a
  submission out of quarantine. Only propose; a reviewer with `research:write` decides.
- Never fabricate corroboration. If you can't find a second independent source, say so in the
  recommendation instead of inventing one.
