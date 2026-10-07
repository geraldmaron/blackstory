---
name: blackstory-discovery-run
description: Use when the owner wants to launch a bounded adapter discovery campaign and get a yield summary (accepted/quarantined/dead-lettered counts). Triggers on "run a discovery campaign", "kick off discovery for X", "how many candidates did the last run produce".
---

# Discovery run

Requires the BlackStory checkout. See [loading and capabilities](../../../docs/research/README.md#skills-and-harness-portability)
for tool requirements and use from any harness.

Canonical how-to (invocation, guardrails, Do/Never) lives in
[`docs/research/research-operations.md`](../../../docs/research/research-operations.md#discovery-run).
Read that section before running `discovery-run`. This file is a CLI pointer. It carries
no command detail of its own.

Choosing _where_ to look next is `blackstory-coverage-target`, not this verb.
