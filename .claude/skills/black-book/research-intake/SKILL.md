---
name: black-book-research-intake
description: Use when the owner hands you a URL or topic in a Claude session and wants it turned into a proposed lead — fetched safely, cited, and opened as a draft research case. Triggers on "add this lead", "look into this URL", "research this place/person", or a pasted link with a research request.
---

# Research intake (BB-085)

Takes a URL/topic from the owner and turns it into one real, auditable proposal in the
existing pipeline — nothing here is a shortcut around BB-029 quarantine or BB-044 case
creation.

## Invoke

Prefer the CLI (it prints a JSON result you can summarize back to the owner):

```bash
OPERATOR_CLI_PRIVACY_PEPPER=<pepper> node --conditions development --import tsx \
  packages/operator-cli/src/bin.ts research-intake \
  --url "https://example.org/source" \
  --description "Optional owner note — omit to use the fetched excerpt" \
  --location "City, State" \
  --era "1960s" \
  --operator-id "<your operator id>" \
  --session-id "<this session's id>" \
  --identity-source claude_session
```

That command is a thin wrapper over `runResearchIntake` in
`packages/operator-cli/src/research-intake.ts`, which itself only sequences three real,
independently tested functions:

1. `runQuickAddFetch` (`packages/operator-cli/src/fetch.ts`) — real DNS-pinned, SSRF-safe fetch
   through BB-030 (`executeSafeFetch`, `packages/security/src/url-safety/`).
2. `buildCitationPrefill` / `planSelectiveCapture` (same file) — citation metadata from what
   the fetch returned, and a note on where Wayback capture *would* attach (not wired yet).
3. `prepareLeadIntake` (`packages/operator-cli/src/intake.ts`) — the real BB-029 quarantine
   intake (`createQuarantinedSubmission`, `@black-book/security`) plus a real BB-044 draft
   research case (`createResearchCase`, `@black-book/domain`).

If you need the package function directly instead of shelling out (e.g. you're already running
TypeScript in this session), call `runResearchIntake` from `@black-book/operator-cli` with the
same shape shown above — do not re-fetch the URL yourself or hand-build a quarantine record.

Add `--commit` only after the owner has reviewed the printed result and asked you to actually
write it — it calls `commitOperatorIntake` (BB-018's real `commitWithAudit`) and needs
`GOOGLE_APPLICATION_CREDENTIALS`/`FIREBASE_PROJECT_ID` configured for the target project.

## Do

- Read the printed `fetch.reason` if the fetch was denied, and tell the owner why (e.g.
  `dns_answer_not_public`, `malware_indicator`) instead of retrying with a workaround.
- Let the owner's own words become the lead's `--description`; only fall back to the fetched
  excerpt when they didn't give you one.
- Report back the `submissionId` and `researchCaseId` from the result so the owner can look
  the proposal up later (in `triage-graylist` or the admin console).

## Never

- Never fetch the URL yourself (curl, `fetch()`, a browser tool) and paste the content into a
  submission — that bypasses BB-030's SSRF/malware protections entirely. Always go through
  `runQuickAddFetch`/`research-intake`.
- Never call `--commit` without the owner's explicit go-ahead for that specific proposal.
- Never treat a completed `research-intake` call as published. It only ever reaches
  `state: 'candidate'` in `researchCases` — publication is a separate, later, fresh-auth-gated
  action (`evaluatePromotionGate` + `assertRecentReauth`, see `docs/runbooks/operator-session.md`).
- Never construct a `SubmissionInput` or `ResearchCaseRecord` by hand — always go through
  `prepareLeadIntake`/`runResearchIntake` so BB-029/044's real validation runs.
