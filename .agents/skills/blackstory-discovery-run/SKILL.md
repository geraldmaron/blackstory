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

## Working contract

**Input:** A bounded campaign, assembled source batch and declared limits.

**Output:** Staged candidates and reconciled yield, failures and unknowns.

**Boundary and handoff:** Hand candidates to intake and identity review. Discovery counts are not accepted historical claims.

Before acquisition, use the [shared collection-library method](../../../docs/research/research-operations.md#source-library)
for the evidence need, pin returned policy versions and explain why the collection should
contain the needed evidence. Search authorized captures, citation trails and outside sources;
the library is a starting point. Record access failures and unknown coverage. Its reviewed
status describes guidance, not the truth of a historical assertion.

**Capabilities:** Follow [capability and permission limits](../../../docs/research/README.md#capabilities-and-permissions).
Use the active harness’s available tools and report unsupported steps. Operational flags stay
in the linked operations contract; no proprietary client or model family is required.
