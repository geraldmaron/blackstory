# Black Book — Documentation

> Required project state. All LLMs working in this repo, including Construct, should keep this file updated.

## Purpose

Operating docs for the Black Book monorepo: architecture, decisions, runbooks, and bead reports. Not a substitute for the execution tracker.

## Read first

| Doc | Contents |
|-----|----------|
| [`../plan.md`](../plan.md) | Bead execution plan (BB-001–BB-066) |
| [`architecture.md`](./architecture.md) | Target architecture and invariants |
| [`adr/README.md`](./adr/README.md) | Architecture decision records (BB-002) |
| [`security/README.md`](./security/README.md) | Threat model, abuse corpus, environment isolation (BB-004/005) |
| [`testing/README.md`](./testing/README.md) | Test layers, CI check names, harnesses (BB-008) |
| [`ui/README.md`](./ui/README.md) | Design system tokens, components, fixtures (BB-007) |
| [`../infra/github/README.md`](../infra/github/README.md) | GitHub governance (BB-009) + OIDC/WIF operator docs (BB-010; cloud not applied) |
| [`../infra/database/README.md`](../infra/database/README.md) | Parked PostGIS / SQL Connect (Cloud SQL deferred — ADR-011) |
| [`../infra/firebase/FIRESTORE_MODEL.md`](../infra/firebase/FIRESTORE_MODEL.md) | Firestore collection map + rules (BB-013 / ADR-011) |
| [`../SECURITY.md`](../SECURITY.md) | Security policy + private vulnerability reporting |
| [`../README.md`](../README.md) | Bootstrap and developer commands |
| [`bb-001/baseline-report.md`](./bb-001/baseline-report.md) | BB-001 reconnaissance baseline |
| Product constitution | `packages/schemas/constitution/` (BB-003; shared TS + Python) |
| Env isolation matrices | `infra/gcp/`, `infra/firebase/` (single production project; apps registered in BB-011; lower-layer GCP controls not provisioned) |

## What's here

| Path | Contents |
|------|----------|
| `architecture.md` | Canonical architecture and invariants |
| `adr/` | Formal ADRs (BB-002); scaffold vs target noted; cloud not provisioned from these alone |
| `security/` | BB-004 threat model / abuse corpus; BB-005/D-013 single-project isolation design |
| `testing/` | BB-008 test layers, CI check names, guarded harness docs |
| `ui/` | BB-007 design system usage, fixtures, accessibility notes |
| `../infra/github/` | BB-009 rulesets + BB-010 OIDC/WIF scripts, environments, release-metadata (not applied remotely yet) |
| `bb-001/` | Bead BB-001 reports (owned by baseline work; do not clobber) |
| `runbooks/` | Operational procedures (stubs as needed) |
| `../.cx/` | Resumable agent context, workflow state, decisions/research/reviews |
| `../packages/schemas/constitution/` | Versioned product policy JSON + fixtures (BB-003) |
| `../infra/gcp/` | BB-005 isolation matrices + Terraform stubs; BB-010 WIF under `infra/gcp/wif/` (not applied) |
| `../infra/firebase/` | BB-011/013 Firebase config, Firestore model/rules, App Hosting templates |
| `../infra/database/` | Parked BB-012 PostGIS / SQL Connect (not production path) |

## Ownership

Maintained by: project agents / Construct when available  
Last updated: 2026-07-16 (ADR-011 Firestore pivot / BB-013)

## Upkeep

When work changes project reality, update `.cx/context.md`, `.cx/context.json`, `.cx/workflow.json`, this file, and/or `architecture.md` before calling the work done.
