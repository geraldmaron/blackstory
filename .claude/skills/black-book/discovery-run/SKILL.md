---
name: black-book-discovery-run
description: Use when the owner wants to launch a bounded adapter discovery campaign and get a yield summary (accepted/quarantined/dead-lettered counts). Triggers on "run a discovery campaign", "kick off discovery for X", "how many candidates did the last run produce".
---

# Discovery run (BB-085)

Runs an already-assembled batch of adapter candidates through the real BB-039 bounded
campaign gate and reports yield — it does not fetch anything from a source itself.

## Invoke

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts discovery-run \
  --batch path/to/batch.json \
  --campaign-id "campaign-2026-07-17-01" \
  --countries US \
  --max-candidates 100 --max-quarantined 10 --max-dead-letter 5 --max-retries 2 \
  --continue-on-quarantine
```

`--batch` points at a JSON file shaped `{ "pack": QueryPack, "records":
AdapterCandidateRecord[], "runContext": DiscoveryRunContext }`. This is a thin wrapper —
`runBoundedDiscoveryCampaign` (`packages/operator-cli/src/discovery-run.ts`) only calls
`createDiscoveryCampaignConfig` + `runDiscoveryCampaign`
(`packages/domain/src/discovery/campaign.ts` / `pipeline.ts`), the same bounded, quarantine-
aware gate every other discovery caller in this repo uses.

**Where the batch file comes from is out of scope for this skill.** Adapter fetching
(actually calling an archive/registry API to produce `AdapterCandidateRecord`s) lives in
`packages/domain/src/adapters/**` and its worker callers — this lane never performs that I/O.
If the owner wants a *new* source queried, that's an adapter/worker concern, not this skill.
Use this skill when candidates already exist (e.g. from a worker's own batch export) and you
need to run the gate and summarize what happened.

## Do

- Report the printed summary in plain terms: how many accepted, how many quarantined (and
  why, from `result.candidates[].failureReason`), how many dead-lettered.
- Keep `--max-quarantined`/`--max-dead-letter` conservative for a first run against an
  unfamiliar batch — they're the circuit breaker, not a formality.
- Point the owner at `triage-graylist` for anything that landed `quarantined` — that's exactly
  the weak-signal parked state that skill walks.

## Never

- Never fetch candidates yourself and hand-build the batch file's `records` to "make the run
  work" — every record must come from a real adapter run with real BB-016 provenance
  (`AdapterCandidateProvenance`), or the campaign's identity/dedup guarantees are meaningless.
- Never treat an `accepted` discovery candidate as published, or even as a research case.
  Discovery only ever produces *private research candidates* — `assertDiscoveryCannotPublish`
  (`packages/domain/src/discovery/guard.ts`) is a hard gate in the domain layer for exactly
  this reason. A candidate becomes a research case (via `research-intake`/`submit-lead`) and a
  publishable claim only much later, through their own gates.
- Never widen `--max-candidates`/budgets mid-run to "push through" a stall — a stalled or
  heavily quarantined run is a signal to investigate the source or query pack, not a limit to
  raise.
