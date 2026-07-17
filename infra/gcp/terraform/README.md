# Terraform single-project isolation stubs (BB-005)

These unapplied stubs target only the existing production project `black-book-efaaf`. They model
eleven per-surface SAs, four buckets with UBLA/PAP posture, and bucket-scoped IAM. They do not create
projects, apps, App Hosting backends, Cloud SQL, Armor, IAP, App Check, WIF, secrets, or standing
human access. WIF lives in a sibling module: [`../wif/`](../wif/).

Do not apply to the live project without first inventorying existing resources and importing any
matching objects into state. A plan that proposes replacing or deleting a live resource must stop
for human review.

```bash
cd infra/gcp/terraform
terraform init -backend=false
terraform validate
terraform plan -var-file=envs/prod.tfvars
```

`project_id` defaults to and validates as `black-book-efaaf`; `environment` defaults to
`production`. Dev/staging tfvars demonstrate optional naming prefixes in the same project and are
not separate security boundaries. Local development should use Firebase emulators.

Keep these files synchronized with [`../isolation-matrix.json`](../isolation-matrix.json) and the
human matrices. The deferred four-project target is documentation only and is not represented by
required Terraform variables.
