# Security documentation (BB-004 / BB-005)

Threat model, abuse-case corpus, environment isolation design, and security test scaffolds for Black Book.

| Doc | Role |
|-----|------|
| [`threat-model.md`](./threat-model.md) | Human-readable threat model (19 P0 threats, four control quadrants each) |
| [`abuse-cases.md`](./abuse-cases.md) | Abuse cases AC-01–AC-19 with bead mappings and automation mode |
| [`threat-corpus.json`](./threat-corpus.json) | Machine-readable corpus (source for tests) |
| [`threat-corpus.schema.json`](./threat-corpus.schema.json) | JSON Schema for the corpus |
| [`environment-isolation.md`](./environment-isolation.md) | BB-005/D-013 single-project production isolation and deferred migration |
| [`../infra/firebase/auth-and-app-check.md`](../../infra/firebase/auth-and-app-check.md) | BB-011 Auth plan + App Check scaffold (enforcement = BB-024) |
| [`tests/checklist.md`](./tests/checklist.md) | Manual/CI security checklist scaffold |

Assumptions: [`../adr/ADR-010-security-and-abuse-assumptions.md`](../adr/ADR-010-security-and-abuse-assumptions.md).  
Isolation matrices / IaC stubs: [`../../infra/gcp/`](../../infra/gcp/), [`../../infra/firebase/`](../../infra/firebase/).  
GitHub governance (BB-009, local): [`../../infra/github/README.md`](../../infra/github/README.md), [`../../SECURITY.md`](../../SECURITY.md).

Automated completeness: `pnpm --filter @black-book/testing test`.
