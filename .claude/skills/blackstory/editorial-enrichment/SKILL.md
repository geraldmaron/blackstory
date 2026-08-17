---
name: blackstory-editorial-enrichment
description: Use when checking pending discovery or obscurity leads, running editorial or enrichment with an LLM (OpenRouter, local, or mock), weeding bad items, drafting linked prose, and staging packets for quarantine, never publish. Also covers backfill-entity and prose-run. Triggers on "check pending", "run editorial", "run enrichment", "stage for publish", "backfill this entity", "short prose draft".
---

# Editorial enrichment (staging only)

Canonical how-to (invocation, providers, `backfill-entity`, `prose-run`, Do/Never) lives in
[`docs/research/research-operations.md`](../../../../docs/research/research-operations.md#editorial-enrichment-editorial-run--enrichment-run).
Read that section before running `editorial-run`, `enrichment-run`, `backfill-entity`, or
`prose-run`. This file is a CLI pointer. It carries no command detail of its own.

Citation weight, Wikipedia, and superlatives are `blackstory-claim-corroborate`. Filling
blank public-record fields is `blackstory-entity-complete`.
