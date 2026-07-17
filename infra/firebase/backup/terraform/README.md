# Terraform stubs — Firestore backup bucket (BB-020)

**Not applied.** Copy into `infra/gcp/terraform/` or a dedicated stack after human review.

| File | Purpose |
|------|---------|
| [`backup-bucket.tf.stub`](./backup-bucket.tf.stub) | Fifth bucket with versioning + lifecycle |
| [`backup-iam.tf.stub`](./backup-iam.tf.stub) | `backup@` scoped grants without delete |

Apply checklist:

1. Review with security; confirm bucket name `black-book-efaaf-firestore-backups`.
2. `terraform plan` only — no auto-apply from CI.
3. Update [`storage-buckets.matrix.md`](../../gcp/storage-buckets.matrix.md) provisioned status manually.
