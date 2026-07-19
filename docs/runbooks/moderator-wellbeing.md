# Runbook: Moderator wellbeing for community-lead review

**Scope:** the human review queue behind the public "Submit a lead" form — reviewing
quarantined community submissions (`packages/domain/src/consensus-review/`), the moderator
rotation, exposure limits, and escalation paths for what that content can contain.
**Not in scope:** the technical quarantine and consensus mechanics themselves (see
`packages/domain/src/consensus-review/` and its tests), which are covered by 's
acceptance tests, not this document.

## Why this runbook exists

BlackStory documents racially charged, and sometimes violent, history. A public, unauthenticated
"submit a lead" form is — by the Queering the Map lesson named in 's design brief — a
predictable target for two very different kinds of hostile submission:

1. **Coordinated abuse aimed at the product**: spam, SEO poisoning, brigading, attempts to get
   false claims into the research pipeline (/032 quarantine and the consensus-review
   agreement threshold exist to blunt this — see `packages/domain/src/consensus-review/`).
2. **Content that is genuinely disturbing to read**: racist language quoted or reenacted,
   descriptions or images of violence, harassment directed at the reviewer personally, and
   material that is simply heavy — grief, loss, injustice — even when it is not an attack at
   all, just a hard true thing someone is trying to get documented.

The first kind is a systems problem with systems mitigations. The second kind is not something
software can fully absorb. Reviewing it is real emotional labor, done by real people, on a
recurring basis, for a project whose entire subject matter is racial history. This runbook
treats that labor as a first-class operational cost to plan for — not a footnote.

## Queue design: batching and warnings

The moderator queue (the human side of `expert_review` and `pending_review` routing) must never
present raw, unwarned content as the first thing a reviewer sees.

1. **Content warnings are structural, not optional.** Every quarantined lead entering the
   moderator queue carries a coarse pre-screen — the deterministic spam/campaign signals
   already computes (`SpamAssessment`, `SubmissionCampaignAssessment` in
   `packages/security/src/submissions/quarantine.ts`) plus a keyword-pattern heuristic for slurs,
   graphic-violence terms, and self-harm/crisis language. A lead that trips the heuristic is
   shown behind a one-click reveal ("This submission may contain racist language or graphic
   description — show content") rather than rendered inline. False positives are cheap (an extra
   click); false negatives are not.
2. **Batch by severity, not just by arrival time.** The queue groups leads into three lanes:
   - *Routine* — no content-warning trip; review at a normal, steady pace.
   - *Heavy* — content-warning trip without a personal-safety signal (e.g., quoted historical
     racist language, description of violence against third parties). Reviewed in short batches
     (recommend 5–8 items) with a mandatory break prompt between batches.
   - *Acute* — content aimed at the reviewer or platform itself (threats, harassment, doxxing
     attempts, self-harm content) or CSAM/imminent-harm indicators. These never sit in a normal
     queue: they are pulled immediately into the escalation path below and are not left for the
     next reviewer to discover cold.
3. **No infinite scroll.** The queue paginates in small batches (default 10) so a reviewer always
   has a natural, visible stopping point instead of an undifferentiated stream.
4. **Context before content.** Each queue item leads with the *consensus-review* metadata first
   (how many independent reviewers have looked at it, current agreement state, why it's in this
   lane) and the submitter-supplied prose second, so a reviewer opens knowing what decision is
   being asked of them before they read the material itself.

## Rotation guidance

- **Cap on sustained exposure.** No moderator reviews more than one *Heavy*-lane batch (5–8
  items) without a break of at least 10 minutes away from the queue. No moderator works more than
  two hours of active moderation review in a single sitting, regardless of lane mix.
- **Weekly rotation, not standing duty.** Moderation is a rotating assignment across the trust &
  safety / research-operator pool, not a fixed role for one person. Nobody should be the
  "default" moderator indefinitely — sustained, uninterrupted exposure to this material is the
  specific harm this rotation exists to prevent.
- **Acute-lane review is opt-in per session.** A moderator explicitly signs in to handle the
  *Acute* lane for a session; it is never silently assigned as an overflow from the routine
  queue. Being asked to review threats or self-harm content should never surprise someone who
  logged on expecting routine correction triage.
- **Track load, not just throughput.** The weekly rotation owner monitors item counts *by lane*
  per moderator, not just total items closed — two people who closed the same number of tickets
  may have had very different weeks.
- **Peer check-in is part of the rotation, not an add-on.** Each rotation includes a scheduled
  ten-minute check-in with another moderator or the rotation owner, explicitly to ask "how was
  the queue," before the next person takes over.

## Escalation path

| Situation | Action | Who |
|---|---|---|
| Routine disagreement between reviewers (consensus `expert_review`, no personal-safety signal) | Resolve through normal expert review; no escalation needed | On-duty moderator |
| Content is *Heavy* and a moderator finds it distressing beyond the routine cost of the work | Hand the batch to the rotation owner; no requirement to explain why or finish the batch | Any moderator, no approval needed |
| *Acute* lane: content threatens a specific person, including a moderator or contributor | Stop reviewing that item immediately; escalate to the security on-call via the incident path in [`incident-response.md`](./incident-response.md); do not reply to or engage the submitter | On-duty moderator → security on-call |
| *Acute* lane: apparent CSAM or imminent self-harm/harm-to-others indicator | Do not open, forward, download, or further view the content beyond what's needed to route it; follow the platform's legal/CSAM reporting process (NCMEC CyberTipline for US-hosted CSAM) via the incident-response runbook's legal/privacy contact; preserve the quarantine record for the reporting agency instead of screenshotting or copying it elsewhere | On-duty moderator → security on-call → legal/privacy leadership |
| A moderator needs support after a hard session, independent of any single ticket | No incident needed — flag to the rotation owner for a schedule adjustment or a session off; this is a normal, expected part of the job, not an exception process | Any moderator |

Nothing in the *Acute* row requires the moderator to make a judgment call about severity before
asking for help — "I don't know if this counts, but I want it looked at" is always sufficient
to trigger the escalation.

## What this runbook depends on

- ** quarantine.** Nothing a moderator reviews is public; the entire point of quarantine is
  that mistakes here have a small, contained blast radius, not a published one.
  (`packages/security/src/submissions/quarantine.ts`)
- ** consensus review.** Reviewers work independently and see agreement/disagreement state,
  not just raw content — this runbook's "context before content" guidance depends on that
  metadata existing. (`packages/domain/src/consensus-review/`)
- **Incident response.** The Acute-lane escalation path hands off into the existing incident
  process rather than inventing a parallel one. ([`incident-response.md`](./incident-response.md))

## Revisiting this runbook

Review this runbook at least once per quarter, and immediately after any Acute-lane escalation,
whether or not the escalation revealed a process gap. If a moderator raises that the batching,
warnings, or rotation cadence above is not actually protecting them in practice, that report is
the trigger to revise this document — this runbook is a starting policy, not a ceiling.
