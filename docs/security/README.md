# Security documentation (BB-004 / BB-005)

Threat model, abuse-case corpus, environment isolation design, and security test scaffolds for Blap.

| Doc | Role |
|-----|------|
| [`threat-model.md`](./threat-model.md) | Human-readable threat model (19 P0 threats, four control quadrants each) |
| [`abuse-cases.md`](./abuse-cases.md) | Abuse cases AC-01–AC-19 with bead mappings and automation mode |
| [`threat-corpus.json`](./threat-corpus.json) | Machine-readable corpus (source for tests) |
| [`threat-corpus.schema.json`](./threat-corpus.schema.json) | JSON Schema for the corpus |
| [`environment-isolation.md`](./environment-isolation.md) | BB-005/D-013 single-project production isolation and deferred migration |
| [`ingress-armor.md`](./ingress-armor.md) | BB-023 Cloud Armor + LB-only ingress design |
| [`rate-limits.md`](./rate-limits.md) | BB-025 application quota matrix and guard stubs |
| [`query-guardrails.md`](./query-guardrails.md) | BB-026 search query validation, cursors, cache keys |
| [`submission-quarantine.md`](./submission-quarantine.md) | BB-029 correction validation, quarantine, campaign detection, and moderation boundary |
| [`url-ssrf.md`](./url-ssrf.md) | BB-030 async URL evaluation, SSRF defenses, and egress-restricted fetch |
| [`promotion-controls.md`](./promotion-controls.md) | BB-032 staged promotion, lineage/corroboration gates, and release preview diffs |
| [`telemetry-anomaly.md`](./telemetry-anomaly.md) | BB-034 security telemetry, metrics, anomaly rules, alerts |
| [`cost-resource-controls.md`](./cost-resource-controls.md) | BB-033 scaling, queue/job budgets, circuit breakers, soft shutdown |
| [`ugc-compliance-layer.md`](./ugc-compliance-layer.md) | BB-077 per-source obligations registry, evidence-pointer doctrine, deletion-sync framework, living-person UGC ethics, takedown routing |
| [`ugc-legal-posture.md`](./ugc-legal-posture.md) | BB-077 CCPA/CPRA publicly-available posture and fair-use ground truth for counsel review |
| [`../infra/firebase/auth-and-app-check.md`](../../infra/firebase/auth-and-app-check.md) | BB-011 Auth plan + App Check scaffold (enforcement = BB-024) |
| [`tests/checklist.md`](./tests/checklist.md) | Manual/CI security checklist scaffold |

Assumptions: [`../adr/ADR-010-security-and-abuse-assumptions.md`](../adr/ADR-010-security-and-abuse-assumptions.md).  
Isolation matrices / IaC stubs: [`../../infra/gcp/`](../../infra/gcp/), [`../../infra/firebase/`](../../infra/firebase/).  
GitHub governance (BB-009, local): [`../../infra/github/README.md`](../../infra/github/README.md), [`../../SECURITY.md`](../../SECURITY.md).

Automated completeness: `pnpm --filter @blap/testing test`.
