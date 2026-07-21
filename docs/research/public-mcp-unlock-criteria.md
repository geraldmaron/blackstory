<!--
  Public Black-history MCP unlock criteria for the data-landscape capitalization epic.
  Records gates only — does not implement an MCP server. Distinct from operator/agent MCP.
-->

# Public MCP unlock criteria

**Purpose:** Written gates before anyone builds a **public** BlackStory Model Context Protocol server that answers heritage questions with citations, confidence, and correction paths. This is **not** the operator/agent MCP workstream under entity-acquisition research tooling.

**Date:** 2026-07-21  
**Branch:** `research/data-landscape-capitalization`  
**Depends on:** [ADR-026](../adr/ADR-026-postgrest-published-read-surface.md) (PostgREST published-read surface)

---

## Why defer

Language models already answer Black history questions from training data without citations or confidence. A public MCP that returns *“Corroborated, independent sources, archived capture, correction path”* is valuable — and **dangerous** if it confidently returns wrong states, thin captures, or draft-quality claims. Sequencing from the landscape intake remains binding: quality → stable query surface → docs/license → MCP.

## Unlock criteria (all required)

| # | Gate | Evidence |
|---|---|---|
| 1 | **Geo integrity** | Publish path uses geo-integrity containment (or equivalent PostGIS check); mismatch audit of existing corpus reviewed or queued |
| 2 | **Capture completeness** | Ops bar (`CAPTURE_COMPLETENESS_BAR_RATIO`) measured on published web citations; remediation plan if below bar |
| 3 | **PostgREST published views** | ADR-026 views live with RLS; anon cannot read drafts/canonical/research |
| 4 | **Docs + license** | Developer docs for the published read surface; attribution / share-alike (or chosen license) stated |
| 5 | **Abuse bounds** | Rate limits / spend caps / soft-shutdown verified for query surface under projected traffic |
| 6 | **Operator MCP ≠ public MCP** | Public server must not share service-role credentials or research-write paths with operator tooling |

## Explicit non-goals (this document)

- Implementing or shipping an MCP server
- Replacing methodology or human review with model answers
- Exposing unpublished research cases to models

## When unlocked

File a new implementation bead that depends on this criteria doc and ADR-026. Prefer a thin MCP wrapping the published PostgREST/API surface — not a second data path.
