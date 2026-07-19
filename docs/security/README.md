# Security documentation ( / )

Threat model, abuse-case corpus, environment isolation design, and security test scaffolds for BlackStory.

| Doc | Role |
|-----|------|
| [`threat-model.md`](./threat-model.md) | Human-readable threat model (19 P0 threats, four control quadrants each) |
| [`abuse-cases.md`](./abuse-cases.md) | Abuse cases AC-01–AC-19 with bead mappings and automation mode |
| [`threat-corpus.json`](./threat-corpus.json) | Machine-readable corpus (source for tests) |
| [`threat-corpus.schema.json`](./threat-corpus.schema.json) | JSON Schema for the corpus |
| [`environment-isolation.md`](./environment-isolation.md) | /D-013 single-project production isolation and deferred migration |
| [`ingress-armor.md`](./ingress-armor.md) |  Cloud Armor + LB-only ingress design |
| [`rate-limits.md`](./rate-limits.md) |  application quota matrix and guard stubs |
| [`query-guardrails.md`](./query-guardrails.md) |  search query validation, cursors, cache keys |
| [`submission-quarantine.md`](./submission-quarantine.md) |  correction validation, quarantine, campaign detection, and moderation boundary |
| [`url-ssrf.md`](./url-ssrf.md) |  async URL evaluation, SSRF defenses, and egress-restricted fetch |
| [`promotion-controls.md`](./promotion-controls.md) |  staged promotion, lineage/corroboration gates, and release preview diffs |
| [`telemetry-anomaly.md`](./telemetry-anomaly.md) |  security telemetry, metrics, anomaly rules, alerts |
| [`cost-resource-controls.md`](./cost-resource-controls.md) |  scaling, queue/job budgets, circuit breakers, soft shutdown |
| [`ugc-compliance-layer.md`](./ugc-compliance-layer.md) |  per-source obligations registry, evidence-pointer doctrine, deletion-sync framework, living-person UGC ethics, takedown routing |
| [`ugc-legal-posture.md`](./ugc-legal-posture.md) |  CCPA/CPRA publicly-available posture and fair-use ground truth for counsel review |
| [`../infra/firebase/auth-and-app-check.md`](../../infra/firebase/auth-and-app-check.md) |  Auth plan + App Check scaffold (enforcement = ) |
| [`tests/checklist.md`](./tests/checklist.md) | Manual/CI security checklist scaffold |

Assumptions: [`../adr/ADR-010-security-and-abuse-assumptions.md`](../adr/ADR-010-security-and-abuse-assumptions.md).
Isolation matrices / IaC stubs: [`../../infra/gcp/`](../../infra/gcp/), [`../../infra/firebase/`](../../infra/firebase/).
GitHub governance (, local): [`../../infra/github/README.md`](../../infra/github/README.md), [`../../SECURITY.md`](../../SECURITY.md).

Automated completeness: `pnpm --filter @repo/testing test`.
