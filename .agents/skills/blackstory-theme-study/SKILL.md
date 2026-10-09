---
name: blackstory-theme-study
description: Use when conducting studies for specific themes (for example redlining or urban renewal) or drafting ThemeImpactPackets. Triggers on "theme study", "write theme", "thematic study", "theme packet", "redlining study".
---

# Thematic study and Theme-Impact Packet curation

Requires the BlackStory checkout. See [loading and capabilities](../../../docs/research/README.md#skills-and-harness-portability)
for tool requirements and use from any harness.

Canonical how-to (workflow, `harness-run` invocation, curation rules) lives in
[`docs/research/research-operations.md`](../../../docs/research/research-operations.md#theme-study-harness-run),
with the full packet schema and design detail in
[`docs/research/theme-impact-packet-system.md`](../../../docs/research/theme-impact-packet-system.md).
Read both before running `harness-run`. This file is a CLI pointer. It carries no command
detail of its own.

## Working contract

**Input:** A theme question, geography/period, bounded subjects and evidence needs.

**Output:** Staged observations, interpretation and provenance with unresolved needs.

**Boundary and handoff:** Hand consequential observations to exact-assignment review before publication. Offline shape validation cannot establish corroboration.

Before acquisition, use the [shared collection-library method](../../../docs/research/research-operations.md#source-library)
for the evidence need, pin returned policy versions and explain why the collection should
contain the needed evidence. Search authorized captures, citation trails and outside sources;
the library is a starting point. Record access failures and unknown coverage. Its reviewed
status describes guidance, not the truth of a historical assertion.

**Capabilities:** Follow [capability and permission limits](../../../docs/research/README.md#capabilities-and-permissions).
Use the active harness’s available tools and report unsupported steps. Operational flags stay
in the linked operations contract; no proprietary client or model family is required.
