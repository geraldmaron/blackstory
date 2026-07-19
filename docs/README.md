# BlackStory — Documentation

> Required project state. All LLMs working in this repo, including Construct, should keep this file updated.

## Purpose

Operating docs for the BlackStory monorepo: architecture, decisions, runbooks, and bead reports. Not a substitute for the execution tracker.

## Read first

| Doc | Contents |
|-----|----------|
| [`../plan.md`](../plan.md) | Bead execution plan (–) |
| [`architecture.md`](./architecture.md) | Target architecture and invariants |
| [`adr/README.md`](./adr/README.md) | Architecture decision records |
| [`security/README.md`](./security/README.md) | Threat model, abuse corpus, environment isolation (/005) |
| [`testing/README.md`](./testing/README.md) | Test layers, CI check names, harnesses |
| [`ui/README.md`](./ui/README.md) | Design system tokens, components, fixtures |
| [`research/`](./research/) | Research/evidence engine docs: discovery, adapters, query packs, relevance, confidence lineage, research-case workflow, gold corpus (–044, ) |
| [`admin/research-console.md`](./admin/research-console.md) | Administration and research console |
| [`source-spec/`](./source-spec/) | Versioned copy of the original *BlackStory Web Application Execution Beads* PDF |
| [`../infra/github/README.md`](../infra/github/README.md) | GitHub governance + OIDC/WIF operator docs (; cloud not applied) |
| [`../infra/database/README.md`](../infra/database/README.md) | Parked PostGIS / SQL Connect (Cloud SQL deferred — ADR-011) |
| [`../infra/firebase/FIRESTORE_MODEL.md`](../infra/firebase/FIRESTORE_MODEL.md) | Firestore collection map + rules ( / ADR-011) |
| [`../SECURITY.md`](../SECURITY.md) | Security policy + private vulnerability reporting |
| [`../README.md`](../README.md) | Bootstrap and developer commands |
| [`ds-001/baseline-report.md`](./ds-001/baseline-report.md) |  reconnaissance baseline |
| Product constitution | `packages/schemas/constitution/` (; shared TS + Python) |
| Env isolation matrices | `infra/gcp/`, `infra/firebase/` (single production project; apps registered in ; lower-layer GCP controls not provisioned) |

## What's here

| Path | Contents |
|------|----------|
| `architecture.md` | Canonical architecture and invariants |
| `adr/` | Formal ADRs; scaffold vs target noted; cloud not provisioned from these alone |
| `security/` |  threat model / abuse corpus; /D-013 single-project isolation design |
| `testing/` |  test layers, CI check names, guarded harness docs |
| `ui/` |  design system usage, fixtures, accessibility notes |
| `research/` | –044/047 discovery, adapters, query packs, relevance, confidence, research-case workflow, gold corpus |
| `admin/` |  administration and research console |
| `source-spec/` | Versioned source PDF |
| `../infra/github/` |  rulesets +  OIDC/WIF scripts, environments, release-metadata (not applied remotely yet) |
| `ds-001/` | Bead  reports (owned by baseline work; do not clobber) |
| `runbooks/` | Operational procedures (stubs as needed) |
| `../.cx/` | Resumable agent context, workflow state, decisions/research/reviews |
| `../packages/schemas/constitution/` | Versioned product policy JSON + fixtures |
| `../infra/gcp/` |  isolation matrices + Terraform stubs;  WIF under `infra/gcp/wif/` (not applied) |
| `../infra/firebase/` | /013 Firebase config, Firestore model/rules, App Hosting templates |
| `../infra/database/` | Parked  PostGIS / SQL Connect (not production path) |

## Ownership

Maintained by: project agents / Construct when available
Last updated: 2026-07-16 (ADR-011 Firestore pivot / )

## Upkeep

When work changes project reality, update `.cx/context.md`, `.cx/context.json`, `.cx/workflow.json`, this file, and/or `architecture.md` before calling the work done.
