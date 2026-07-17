# GCP workload isolation (BB-005)

Current mode is `single-project`: the existing live project `black-book-efaaf` (number
`332234323945`) is production. Per-surface service accounts, four buckets, IAM bindings, and
Postgres roles preserve workload boundaries inside that project. These resources are design until
BB-011/012 verifies or provisions them.

| Artifact | Role |
|----------|------|
| [`isolation-matrix.json`](./isolation-matrix.json) | Machine source of truth, including current and deferred modes |
| [`isolation-matrix.schema.json`](./isolation-matrix.schema.json) | JSON Schema |
| [`projects.matrix.md`](./projects.matrix.md) | Live project and configuration scopes |
| [`service-accounts.matrix.md`](./service-accounts.matrix.md) | Per-surface identities and denials |
| [`storage-buckets.matrix.md`](./storage-buckets.matrix.md) | Four bucket boundaries |
| [`iam-boundaries.md`](./iam-boundaries.md) | Same-project IAM contract |
| [`terraform/`](./terraform/) | Unapplied single-project stubs |
| [`wif/`](./wif/) | BB-010 GitHub OIDC / Workload Identity Federation stubs (not applied) |
| [`surfaces/`](./surfaces/) | BB-021 deployable surface matrix + pipeline stubs |
| [`armor/`](./armor/) | BB-023 Cloud Armor, global external ALB, NEG, and CDN design stubs |
| [`cost-controls/`](./cost-controls/) | BB-033 scaling caps, queue/job limits, budgets, hard-stop runbook |

Validate:

```bash
cd infra/gcp
uv run --with jsonschema python -c "import json,sys; from jsonschema import Draft7Validator; \
s=json.load(open('isolation-matrix.schema.json')); d=json.load(open('isolation-matrix.json')); \
errs=list(Draft7Validator(s).iter_errors(d)); \
print('OK' if not errs else '\n'.join(e.message for e in errs)); sys.exit(1 if errs else 0)"
```

The old four-project topology is retained in the matrix and security narrative only as a deferred
migration target. Do not reserve or create those projects during BB-011.
