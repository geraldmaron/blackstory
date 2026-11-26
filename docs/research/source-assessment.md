# Source assessment

A host the pipeline does not recognize blocks every claim that cites it: `research-batch.ts` only
auto-captures tier-1 hosts, hosts on `REPUTABLE_SECONDARY_HOST_SUFFIXES`, and hosts in the source
register. Before 2026-11-25 the remedy was an owner decision per URL. The owner then decided the
framework should assess the source itself. This is that assessment.

## When it runs

After `source-register.ts propose` returns `review` or `reject` for a host. An `accept` still goes
through `apply`: a Wikidata item with an authority identifier is the stronger basis and stays
preferred. Wikipedia is out of scope; it stays a bridge source and is never registered.

## How

1. **Brief.** `source-assess.ts brief --host=<host>` prints the brief and output schema. Both
   assessors get the same text.
2. **Isolation.** Neither assessor is told which record or claim the host would unblock. It judges
   the publisher on the open web, so it has no reason to want a pass.
3. **Claude.** A fresh Sonnet subagent per batch of hosts follows the brief and writes one JSONL
   line per host (`actorId: claude-session:<model>`, `family: anthropic`).
4. **Sol.** `source-assess.ts sol --hosts=a,b --out=<jsonl> --work-dir=<dir outside repo>` runs
   `codex exec` with live web search, read-only, one host per call.
5. **Pair.** `source-assess.ts combine --claude=<jsonl> --sol=<jsonl> --out=<json>`.
6. **Apply.** `source-register.ts apply-assessment --file <json> [--dry-run]`.

## The acceptance rule (`entryFromAssessments`)

- Exactly two assessments, from different model vendors.
- Both recommend `register`.
- Each cites at least one https page about the publisher **from another host that is not
  Wikipedia**. A publisher describing itself is not an assessment of it, and Wikipedia is a bridge
  source here as everywhere else.
- The class follows from each assessor's organization type (`ORG_TYPE_SOURCE_CLASS`), and the entry
  takes the **lower** of the two: a newspaper is `news_reportage` (0.55), never promoted.
- Government authority is never granted this way, and government-TLD hosts are refused outright.

The entry records both assessments as its basis and names both assessors in `reviewedBy`.
`source-register.ts verify` checks only liveness for these entries, since there is no Wikidata
item to re-read. The register-file test rebuilds every assessed entry under today's rule, so a
later tightening of the rule fails loudly on entries that no longer meet it.

## What it does not do

- It does not create a narrower "facts about itself only" tier for self-published sites. Those are
  refused today. If the long tail shows many subjects documented only on their own sites, that tier
  is the next decision.
- It does not change any per-URL preservation decision already recorded.
