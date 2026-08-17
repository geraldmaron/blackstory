---
name: blackstory-discovery-run
description: Use when the owner wants to launch a bounded adapter discovery campaign and get a yield summary (accepted/quarantined/dead-lettered counts). Triggers on "run a discovery campaign", "kick off discovery for X", "how many candidates did the last run produce".
---

# Discovery run

Canonical how-to (invocation, guardrails, Do/Never) lives in
[`docs/research/research-operations.md`](../../../../docs/research/research-operations.md#discovery-run).
Read that section before running `discovery-run`. This file is a CLI pointer. It carries
no command detail of its own.

Choosing *where* to look next is `blackstory-coverage-target`, not this verb.
