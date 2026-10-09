---
name: blackstory-case-drafting
description: Use when checking whether a research case is review-ready, or assembling claims, evidence, and confidence toward the minimum publishable record. Triggers on "is this case ready", "what's missing on this case", "help me draft this case for review".
---

# Case drafting

Requires the BlackStory checkout. See [loading and capabilities](../../../docs/research/README.md#skills-and-harness-portability)
for tool requirements and use from any harness.

Canonical how-to (evaluation functions, `attach-evidence` invocation, Do/Never) lives in
[`docs/research/research-operations.md`](../../../docs/research/research-operations.md#case-drafting).
Read that section before evaluating or filling a research case. This file is a CLI
pointer. It carries no command detail of its own.

## Working contract

**Input:** A case or reviewed assertion set and the intended public record.

**Output:** A saved draft, evidence map, supported sparse fields and unresolved needs.

**Boundary and handoff:** Claim corroboration owns factual decisions; publish preview owns the release handoff.

Before acquisition, use the [shared collection-library method](../../../docs/research/research-operations.md#source-library)
for the evidence need, pin returned policy versions and explain why the collection should
contain the needed evidence. Search authorized captures, citation trails and outside sources;
the library is a starting point. Record access failures and unknown coverage. Its reviewed
status describes guidance, not the truth of a historical assertion.

**Capabilities:** Follow [capability and permission limits](../../../docs/research/README.md#capabilities-and-permissions).
Use the active harness’s available tools and report unsupported steps. Operational flags stay
in the linked operations contract; no proprietary client or model family is required.
