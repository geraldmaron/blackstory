---
name: blackstory-editorial-enrichment
description: Use when checking pending discovery or obscurity leads, running editorial or enrichment with an LLM (OpenRouter, local, or mock), weeding bad items, drafting linked prose, and staging packets for quarantine, never publish. Also covers backfill-entity and prose-run. Triggers on "check pending", "run editorial", "run enrichment", "stage for publish", "backfill this entity", "short prose draft".
---

# Editorial enrichment (staging only)

Requires the BlackStory checkout. See [loading and capabilities](../../../docs/research/README.md#skills-and-harness-portability)
for tool requirements and use from any harness.

Canonical how-to (invocation, providers, `backfill-entity`, `prose-run`, Do/Never) lives in
[`docs/research/research-operations.md`](../../../docs/research/research-operations.md#editorial-enrichment-editorial-run--enrichment-run).
Read that section before running `editorial-run`, `enrichment-run`, `backfill-entity`, or
`prose-run`. This file is a CLI pointer. It carries no command detail of its own.

Citation weight, Wikipedia, and superlatives are `blackstory-claim-corroborate`. Filling
blank public-record fields is `blackstory-entity-complete`.

Drafting and final-copy review use `blackstory-neo-voice`, `blackstory-prose-review` and
`blackstory-ringer-review`, including short entity copy. A staged packet or attached
citation is not a factual or editorial pass.

## Working contract

**Input:** Existing leads or entities, reviewed evidence and requested fields.

**Output:** Staged changes with source passages, omissions and sentence-level support.

**Boundary and handoff:** Hand factual gaps to claim corroboration and copy to prose review. Neither provider output nor a schema pass authorizes publication.

Before acquisition, use the [shared collection-library method](../../../docs/research/research-operations.md#source-library)
for the evidence need, pin returned policy versions and explain why the collection should
contain the needed evidence. Search authorized captures, citation trails and outside sources;
the library is a starting point. Record access failures and unknown coverage. Its reviewed
status describes guidance, not the truth of a historical assertion.

**Capabilities:** Follow [capability and permission limits](../../../docs/research/README.md#capabilities-and-permissions).
Use the active harness’s available tools and report unsupported steps. Operational flags stay
in the linked operations contract; no proprietary client or model family is required.
