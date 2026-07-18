# Cost controls (BB-033)

Declarative stubs for cost and resource exhaustion controls. **Not applied** to live GCP.

| Artifact | Role |
|----------|------|
| [`cost-controls-matrix.json`](./cost-controls-matrix.json) | Machine-readable scaling, queue, job, budget, and alert matrix |
| [`cost-controls.schema.json`](./cost-controls.schema.json) | JSON Schema for the matrix |
| [`hard-stop-runbook.md`](./hard-stop-runbook.md) | Manual hard-stop operator procedure |
| [`cost-controls.test.mjs`](./cost-controls.test.mjs) | Acceptance checks for matrix invariants |

## Related beads (reference only — do not duplicate)

| Bead | Owns |
|------|------|
| BB-022 | `apps/web/apphosting*.yaml` — App Hosting CPU/memory/concurrency/maxInstances |
| BB-023 | `infra/gcp/armor/` — edge throttles and WAF |
| BB-025 | `packages/security/src/rate-limits.ts` — endpoint quota matrix |

## Policy package

Runtime evaluators live in [`packages/security/src/resource-controls.ts`](../../../packages/security/src/resource-controls.ts).

## Validate

```bash
node --test infra/gcp/cost-controls/cost-controls.test.mjs
pnpm --filter @blap/security test
```

Human doc: [`docs/security/cost-resource-controls.md`](../../../docs/security/cost-resource-controls.md).
