---
name: blackstory-triage-graylist
description: Use when walking parked, weak-signal research candidates that have cleared intake screening and deciding whether to strengthen with corroboration or recommend rejection. Also covers graylist-read. Triggers on "triage the graylist", "what's stuck in quarantine", "review parked research leads".
---

# Triage graylist

Requires the BlackStory checkout. See [loading and capabilities](../../../docs/research/README.md#skills-and-harness-portability)
for tool requirements and use from any harness.

Canonical how-to (`graylist-read` read path, `attach-evidence` corroboration/recommendation,
Do/Never) lives in
[`docs/research/research-operations.md`](../../../docs/research/research-operations.md#triage-graylist).
Read that section before triaging anything. This file is a CLI pointer. It carries no
command detail of its own.

Strengthening a weak claim with an independent source is `blackstory-claim-corroborate`.

Raw submissions, abuse reports and prompt-injection-bearing mail first use
`blackstory-intake-review`. Graylist research must not bypass that screen.

## Working contract

**Input:** Intake-cleared parked candidates and their existing research history.

**Output:** Strengthen, hold or reject recommendations with reasons and usable evidence.

**Boundary and handoff:** Hand claims to corroboration and identified candidates to drafting. Raw hostile submissions still require intake screening.

Before acquisition, use the [shared collection-library method](../../../docs/research/research-operations.md#source-library)
for the evidence need, pin returned policy versions and explain why the collection should
contain the needed evidence. Search authorized captures, citation trails and outside sources;
the library is a starting point. Record access failures and unknown coverage. Its reviewed
status describes guidance, not the truth of a historical assertion.

**Capabilities:** Follow [capability and permission limits](../../../docs/research/README.md#capabilities-and-permissions).
Use the active harness’s available tools and report unsupported steps. Operational flags stay
in the linked operations contract; no proprietary client or model family is required.
