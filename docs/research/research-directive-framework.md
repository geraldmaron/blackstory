# Research directive adapter

The shared method is defined in [Research framework](./README.md). This page describes the
smaller `runResearchDirective` code adapter, not a complete autonomous research engine.

`packages/operator-cli/src/research-directive.ts` executes plan → gather → extract → decide.
Callers provide extraction and decision handlers. Default gathering safe-fetches the plan's
seed URLs through `research-source-gather.ts`. It does not automatically execute `searchQueries`,
lease ledger tasks, enforce a paid-model budget, or persist a resumable case.

Targeted-brief and sundown-town handlers use this adapter. Story source gathering uses the same
safe-fetch module. Use `search-routing.ts` when a lane must discover URLs, then fetch those leads
before using them as evidence. Decisions are private `stage_for_review`, `hold`, or `reject`.

Do not create another generic loop beside the research kernel and this adapter. Durable execution
must integrate the existing evidence needs, frontier policy, safe-fetch and provider ports. A
finished brief does not establish completed research or authorize publication.
